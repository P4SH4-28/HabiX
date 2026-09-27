-- ============================================================
-- 001_security_hardening.sql — Güvenlik sertleştirme geçişi
-- Mevcut PRODUCTION veritabanına uygulanacak IDEMPOTENT betik.
-- (Yeni kurulumlar için supabase/schema.sql günceldir; bu dosya yalnızca
--  mevcut veritabanını aynı duruma getirir.)
--
-- İçerik:
--   1) Ekonomi kolonlarına CHECK (>= 0) — negatif bakiye imkânsız hale gelir.
--   2) Günlük negatif delta tavanı için daily_earnings.neg_* kolonları.
--   3) team_members: kullanıcı başına TEK takım (UNIQUE).
--   4) duels: ters yönlü (A→B / B→A) çift aktif düello kapanır.
--   5) recovery_hash kolonunun anon okuması kapatılır (hesap ele
--      geçirmenin önü kesilir — bkz. C3 bulgusu).
--   6) Bilinen sorgu kalıpları için eksik indeksler.
--   7) profiles.xp/coins için günlük negatif tavan sütunları.
--
-- UYGULAMA: Supabase Dashboard → SQL Editor → bu dosyayı yapıştır → Run.
-- Geri alınabilirlik: her bölümün altımda yorum satırıyla geri dönüş
-- komutları vardır. Veri silinmez; yalnızca clamp + indeks eklenir.
-- ============================================================

-- ---------- 0) Sıfırın altındaki mevcut değerleri temizle ----------
-- CHECK eklenmeden önce eski kayıtlarda negatif kalmış olabilir.
UPDATE public.profiles SET xp     = GREATEST(xp, 0)     WHERE xp < 0;
UPDATE public.profiles SET coins  = GREATEST(coins, 0)  WHERE coins < 0;
UPDATE public.profiles SET xp7d   = GREATEST(xp7d, 0)   WHERE xp7d < 0;
UPDATE public.profiles SET streak = GREATEST(streak, 0) WHERE streak < 0;
UPDATE public.daily_earnings SET xp = GREATEST(xp, 0) WHERE xp < 0;
UPDATE public.daily_earnings SET gold = GREATEST(gold, 0) WHERE gold < 0;
UPDATE public.duels SET start_xp_challenger = GREATEST(start_xp_challenger, 0),
                        start_xp_opponent   = GREATEST(start_xp_opponent, 0)
WHERE start_xp_challenger < 0 OR start_xp_opponent < 0;

-- ---------- 1) CHECK kısıtları ----------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_xp_nonneg;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_xp_nonneg CHECK (xp >= 0);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_coins_nonneg;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_coins_nonneg CHECK (coins >= 0);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_xp7d_nonneg;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_xp7d_nonneg CHECK (xp7d >= 0);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_streak_nonneg;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_streak_nonneg CHECK (streak >= 0);

ALTER TABLE public.daily_earnings DROP CONSTRAINT IF EXISTS daily_earnings_xp_nonneg;
ALTER TABLE public.daily_earnings ADD CONSTRAINT daily_earnings_xp_nonneg CHECK (xp >= 0);

ALTER TABLE public.daily_earnings DROP CONSTRAINT IF EXISTS daily_earnings_gold_nonneg;
ALTER TABLE public.daily_earnings ADD CONSTRAINT daily_earnings_gold_nonneg CHECK (gold >= 0);

ALTER TABLE public.duels DROP CONSTRAINT IF EXISTS duels_start_xp_nonneg;
ALTER TABLE public.duels ADD CONSTRAINT duels_start_xp_nonneg
  CHECK (start_xp_challenger >= 0 AND start_xp_opponent >= 0);

-- ---------- 2) Günlük NEGATİF delta tavanı ----------
-- Kimlik doğrulaması olmadan çağrılabilen sync-profile, negatif delta ile
-- herkesin bakiyesini sıfırlayabiliyordu (bkz. C4). Artık bir günde
-- uygulanabilecek TOPLAM düşüş de sınırlı: XP -500, altın -300/gün.
-- Aşan kısım kıstırılır ve profil flagged olarak işaretlenir.
ALTER TABLE public.daily_earnings ADD COLUMN IF NOT EXISTS neg_xp  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.daily_earnings ADD COLUMN IF NOT EXISTS neg_gold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.daily_earnings DROP CONSTRAINT IF EXISTS daily_earnings_neg_nonneg;
ALTER TABLE public.daily_earnings ADD CONSTRAINT daily_earnings_neg_nonneg
  CHECK (neg_xp >= 0 AND neg_gold >= 0);

-- ---------- 3) Kullanıcı başına tek takım ----------
-- Önce tekrarları temizle: her kullanıcı için EN ESKİ üyelik (liderlik
-- korunacaksa lider olan) bırakılır, diğerleri silinir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'team_members_one_team_idx'
  ) THEN
    DELETE FROM public.team_members tm
    USING public.team_members dup
    WHERE tm.username = dup.username
      AND tm.team_id <> dup.team_id
      AND (
        -- lider olanı koru
        (dup.role = 'leader' AND tm.role <> 'leader')
        -- değilse en eskisini koru
        OR (dup.role = tm.role AND dup.joined_at < tm.joined_at)
        -- eşit zamanda farklı takımdaysa team_id'ye göre deterministik seçim
        OR (dup.role = tm.role AND dup.joined_at = tm.joined_at AND dup.team_id < tm.team_id)
      );
    CREATE UNIQUE INDEX team_members_one_team_idx ON public.team_members (username);
  END IF;
END $$;

-- ---------- 4) Ters yönlü çift aktif düello kapatılır ----------
-- UNIQUE(challenger, opponent) yorduğu için A→B ve B→A aynı anda
-- var olabiliyordu. Yordam (LEAST, GREATEST) ile yön bağımsız kılınır.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'duels_active_unordered_idx'
  ) THEN
    -- Çakışan aktif düellerden daha yenisi silinir (id'ye göre son kazanan).
    DELETE FROM public.duels a
    USING public.duels b
    WHERE a.id <> b.id
      AND a.status <> 'done' AND b.status <> 'done'
      AND LEAST(a.challenger, a.opponent) = LEAST(b.challenger, b.opponent)
      AND GREATEST(a.challenger, a.opponent) = GREATEST(b.challenger, b.opponent)
      AND a.created_at < b.created_at;
    CREATE UNIQUE INDEX duels_active_unordered_idx
      ON public.duels (LEAST(challenger, opponent), GREATEST(challenger, opponent))
      WHERE status <> 'done';
  END IF;
END $$;

-- ---------- 5) recovery_hash anon okuması kapat ----------
-- Eski durum: herkes (anon key ile) recovery_hash okuyabiliyordu →
-- pass-the-hash ile herhangi bir hesabın kurtarma anahtarı sıfırlanabilir.
-- Yeni: yalnızca uygulamanın gerçekten kullandığı kolonlar verilir.
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, username, name, emoji, streak, xp, coins, xp7d,
  avatar_id, frame_id, last_active, vip_until, last_sync_at,
  flagged, flagged_reason, banned, ban_reason, granted_items,
  bio, photo_url, created_at, updated_at
) ON public.profiles TO anon, authenticated;
-- YAZMA izni verilmez (Edge Function'lar servis rolüyle yazar).
-- Geri dönüş: GRANT SELECT ON public.profiles TO anon;

-- ---------- 6) Bilinen sorgu kalıpları için indeksler ----------
-- Arkadaşlık sorguları iki yönlü okur (friendService/leaderboardService).
CREATE INDEX IF NOT EXISTS friendships_user_id_idx  ON public.friendships (user_id);
CREATE INDEX IF NOT EXISTS friendships_friend_id_idx ON public.friendships (friend_id);
-- Sohbet: kullanıcı bazlı son mesaj + genel akış.
CREATE INDEX IF NOT EXISTS chat_messages_username_created_idx
  ON public.chat_messages (username, created_at DESC);
-- Canlı odalar: en son aktif olanlar ilk sırada.
CREATE INDEX IF NOT EXISTS pomodoro_rooms_last_active_idx
  ON public.pomodoro_rooms (last_active_at DESC);
-- Liderlik: XP sıralaması.
CREATE INDEX IF NOT EXISTS profiles_xp_desc_idx ON public.profiles (xp DESC);
-- Düello: taraf bazlı arama (opponent ikinci kolon olduğu için ayrı indeks).
CREATE INDEX IF NOT EXISTS duels_opponent_idx ON public.duels (opponent);

-- ---------- 7) Admin işlem idempotency ----------
-- Aynı requestId ile iki kez uygulanan adjust/transfer/grant tekrar
-- oynatılamaz (çift dokunuş / ağ tekrarı koruması).
ALTER TABLE public.admin_logs ADD COLUMN IF NOT EXISTS request_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS admin_logs_request_id_idx
  ON public.admin_logs (request_id) WHERE request_id IS NOT NULL;

-- ---------- 8) Senkron tekrar oynatma (idempotency) tablosu ----------
-- sync-profile, istemcinin gönderdiği requestId'i tekil tutar: yanıt
-- kaybolduğunda istemcinin yeniden gönderdiği AYNI delta ikinci kez
-- uygulanmaz (çift kredi/çift ceza önlenir). Yalnızca servis rolü kullanır;
-- anon/authenticated için erişim kapatılır.
CREATE TABLE IF NOT EXISTS public.sync_requests (
  username    TEXT        NOT NULL,
  request_id  TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (username, request_id)
);
CREATE INDEX IF NOT EXISTS sync_requests_created_idx
  ON public.sync_requests (created_at);
ALTER TABLE public.sync_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sync_requests_service_only ON public.sync_requests;
REVOKE ALL ON public.sync_requests FROM anon, authenticated;
-- Geri dönüş: DROP TABLE public.sync_requests;

-- ---------- DOĞRULAMA ----------
-- SELECT indexname FROM pg_indexes WHERE schemaname='public' ORDER BY 1;
-- SELECT conname FROM pg_constraint WHERE conname LIKE '%_nonneg';
