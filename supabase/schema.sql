-- ============================================================
-- Habit Tracker — TEK PARÇA ŞEMA (setup.sql)
-- Eski dağınık yamaların (anti-farm / admin / duel / recovery /
-- social / quest-claims) tamamını TEK betikte toplar + eksik taban
-- tablolarını (profiles, friendships) oluşturur.
--
-- Kurulum: Supabase Dashboard → SQL Editor → bu dosyayı yapıştır → Run
-- Betik idempotent'tir: hatalara takılmadan tekrar çalıştırılabilir.
--
-- Güvenlik modeli:
--   - profiles / daily_earnings / quest_claims / duels / admin_logs:
--     OKUMA herkese açık (liderlik/arkadaş listeleri anon key ile okur),
--     YAZMA yalnızca servis rolü (Edge Function'lar RLS'yi bypass eder).
--   - friendships: yazma işlemleri UYGULAMADAN doğrudan yapılır
--     (kimlik kullanıcı adıyla yürür; Supabase Auth oturumu yoktur),
--     bu yüzden bu tabloda anon INSERT/UPDATE/DELETE izinlidir.
--   - chat_messages / pomodoro_rooms / pomodoro_room_members:
--     okuma herkese açık, yazma yalnızca chat-action (servis rolü).
-- ============================================================

-- ---------- 1) PROFİLLER (taban tablo — eski dosyalarda YOKTU) ----------
-- Kimlik: username (uygulama Supabase Auth kullanmaz). id, arkadaşlık
-- ilişkileri için uuid olarak ayrıca tutulur (gen_random_uuid ile üretilir).
CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username       TEXT NOT NULL UNIQUE,
  name           TEXT,
  emoji          TEXT DEFAULT '😀',
  streak         INTEGER NOT NULL DEFAULT 0,
  xp             INTEGER NOT NULL DEFAULT 0,
  coins          INTEGER NOT NULL DEFAULT 0,
  xp7d           INTEGER NOT NULL DEFAULT 0,
  avatar_id      TEXT,
  frame_id       TEXT,
  last_active    TIMESTAMPTZ,
  vip_until      TIMESTAMPTZ,
  last_sync_at   TEXT,
  flagged        BOOLEAN NOT NULL DEFAULT false,
  flagged_reason TEXT,
  banned         BOOLEAN NOT NULL DEFAULT false,
  ban_reason     TEXT,
  granted_items  JSONB NOT NULL DEFAULT '[]'::jsonb,
  recovery_hash  TEXT,
  bio            TEXT NOT NULL DEFAULT '',
  photo_url      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profil fotoğrafı ve bio (mevcut veritabanlarına eksik sütunlar eklenir).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;
-- Offline-First delta senkronu için değişiklik zaman damgası.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS profiles_updated_at_idx ON public.profiles (updated_at);

-- ---------- 1.5) EKONOMİ BÜTÜNLÜĞÜ ----------
-- Sıfırın altındaki bakiye veritabanında imkânsızdır (istemci manipülasyonuna
-- ve servis rolü hatalarına karşı son savunma hattı).
UPDATE public.profiles SET xp = GREATEST(xp, 0) WHERE xp < 0;
UPDATE public.profiles SET coins = GREATEST(coins, 0) WHERE coins < 0;
UPDATE public.profiles SET xp7d = GREATEST(xp7d, 0) WHERE xp7d < 0;
UPDATE public.profiles SET streak = GREATEST(streak, 0) WHERE streak < 0;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_xp_nonneg;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_xp_nonneg CHECK (xp >= 0);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_coins_nonneg;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_coins_nonneg CHECK (coins >= 0);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_xp7d_nonneg;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_xp7d_nonneg CHECK (xp7d >= 0);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_streak_nonneg;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_streak_nonneg CHECK (streak >= 0);

-- Kullanıcı profil fotoğrafları (public bucket + anon yazma — uygulama
-- Supabase Auth kullanmaz, kimlik kullanıcı adıyla yürür).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "avatars_read"   ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY IF NOT EXISTS "avatars_insert" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'avatars');
CREATE POLICY IF NOT EXISTS "avatars_update" ON storage.objects FOR UPDATE TO anon USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');
CREATE POLICY IF NOT EXISTS "avatars_delete" ON storage.objects FOR DELETE TO anon USING (bucket_id = 'avatars');

-- ---------- 2) GÜNLÜK KAZANÇ DEFTERİ (sync-profile tavanı) ----------
CREATE TABLE IF NOT EXISTS public.daily_earnings (
  username   TEXT NOT NULL,
  day        TEXT NOT NULL,
  xp         INTEGER NOT NULL DEFAULT 0,
  gold       INTEGER NOT NULL DEFAULT 0,
  -- Gün içinde uygulanan TOPLAM düşüş (geri alma/ceza): günlük negatif tavan.
  neg_xp     INTEGER NOT NULL DEFAULT 0,
  neg_gold   INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (username, day)
);
ALTER TABLE public.daily_earnings ADD COLUMN IF NOT EXISTS neg_xp  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.daily_earnings ADD COLUMN IF NOT EXISTS neg_gold INTEGER NOT NULL DEFAULT 0;
UPDATE public.daily_earnings SET xp = GREATEST(xp, 0) WHERE xp < 0;
UPDATE public.daily_earnings SET gold = GREATEST(gold, 0) WHERE gold < 0;
ALTER TABLE public.daily_earnings DROP CONSTRAINT IF EXISTS daily_earnings_xp_nonneg;
ALTER TABLE public.daily_earnings ADD CONSTRAINT daily_earnings_xp_nonneg CHECK (xp >= 0);
ALTER TABLE public.daily_earnings DROP CONSTRAINT IF EXISTS daily_earnings_gold_nonneg;
ALTER TABLE public.daily_earnings ADD CONSTRAINT daily_earnings_gold_nonneg CHECK (gold >= 0);
ALTER TABLE public.daily_earnings DROP CONSTRAINT IF EXISTS daily_earnings_neg_nonneg;
ALTER TABLE public.daily_earnings ADD CONSTRAINT daily_earnings_neg_nonneg
  CHECK (neg_xp >= 0 AND neg_gold >= 0);

-- ---------- 3) GÖREV ÖDÜL ALIMLARI (sync-quest) ----------
CREATE TABLE IF NOT EXISTS public.quest_claims (
  username   TEXT NOT NULL,
  quest_id   TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  day        TEXT NOT NULL,
  PRIMARY KEY (username, quest_id)
);

-- ---------- 4) YÖNETİCİ DENETİM GÜNLÜĞÜ (admin-action) ----------
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id         BIGSERIAL PRIMARY KEY,
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,
  target     TEXT,
  detail     TEXT,
  created_at TEXT NOT NULL
);
-- admin-action tekrar oynatma korumasi: ayni requestId ikinci kez uygulanmaz.
-- (001_security_hardening.sql ile birebir ayni; mevcut kurulumlarda da var.)
ALTER TABLE public.admin_logs ADD COLUMN IF NOT EXISTS request_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS admin_logs_request_id_idx
  ON public.admin_logs (request_id) WHERE request_id IS NOT NULL;

-- ---------- 4b) SENKRON TEKRAR OYNATMA KAYDI (sync-profile idempotency) ----------
-- İstemci aynı delta'yı (yanıt kaybı sonrası) yeniden gönderirken AYNI
-- requestId'i kullanır; sunucu bu anahtarı ikinci kez uygulamaz.
-- Yalnızca servis rolü kullanır (anon/authenticated kapalı).
CREATE TABLE IF NOT EXISTS public.sync_requests (
  username    TEXT        NOT NULL,
  request_id  TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (username, request_id)
);
CREATE INDEX IF NOT EXISTS sync_requests_created_idx ON public.sync_requests (created_at);

-- ---------- 5) ARKADAŞLIKLAR (friendService — anon key ile yazar) ----------
-- İki yönlü ilişki: user_id isteği gönderen, friend_id isteği alandır.
-- status: pending (beklemede) → accepted (arkadaş). Reddetme/arkadaşlığı
-- silme = satırı silme. Aynı çift arasında yalnızca BİR aktif ilişki.
CREATE TABLE IF NOT EXISTS public.friendships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  friend_id  UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id <> friend_id)
);

-- Aynı çift arasında çift istek/çift arkadaşlık engellenir (yönden bağımsız).
CREATE UNIQUE INDEX IF NOT EXISTS friendships_active_pair_idx
  ON public.friendships (least(user_id, friend_id), greatest(user_id, friend_id))
  WHERE status IN ('pending', 'accepted');

-- ---------- 6) DÜELLOLAR (duel-action) ----------
CREATE TABLE IF NOT EXISTS public.duels (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger         TEXT NOT NULL,
  opponent           TEXT NOT NULL,
  start_xp_challenger INTEGER NOT NULL DEFAULT 0,
  start_xp_opponent  INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'done')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at            TIMESTAMPTZ NOT NULL,
  winner             TEXT,
  reward_claimed     BOOLEAN NOT NULL DEFAULT false,
  CHECK (challenger <> opponent)
);

-- Bakiye tavanlari gibi duel baslangic XP de negatif olamaz
-- (001_security_hardening.sql ile birebir ayni).
ALTER TABLE public.duels DROP CONSTRAINT IF EXISTS duels_start_xp_nonneg;
ALTER TABLE public.duels ADD CONSTRAINT duels_start_xp_nonneg
  CHECK (start_xp_challenger >= 0 AND start_xp_opponent >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS duels_active_pair_idx
  ON public.duels (challenger, opponent)
  WHERE status <> 'done';

-- Yön bağımsız tek aktif düello: A→B varken B→A açılamaz.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'duels_active_unordered_idx'
  ) THEN
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

-- Düello tarafı aramaları (challenger ikinci sütanda kalmasın diye).
CREATE INDEX IF NOT EXISTS duels_opponent_idx ON public.duels (opponent);

-- ---------- 7) GENEL SOHBET (chat-action) ----------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username     TEXT NOT NULL,
  name         TEXT NOT NULL,
  avatar_id    TEXT,
  avatar_photo TEXT,
  message      TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS avatar_photo TEXT;

CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx
  ON public.chat_messages (created_at DESC);

-- ---------- 8) CANLI POMODORO ODALARI (chat-action) ----------
CREATE TABLE IF NOT EXISTS public.pomodoro_rooms (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 40),
  host           TEXT NOT NULL,
  participants   INTEGER NOT NULL DEFAULT 0 CHECK (participants >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pomodoro_room_members (
  room_id   UUID NOT NULL REFERENCES public.pomodoro_rooms (id) ON DELETE CASCADE,
  username  TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, username)
);

-- ---------- 9) İNDEKSLER ----------
CREATE INDEX IF NOT EXISTS quest_claims_username_day_idx
  ON public.quest_claims (username, day);
CREATE INDEX IF NOT EXISTS quest_claims_day_idx
  ON public.quest_claims (day);

-- ---------- 9.5) TAKIMLAR (kulüpler — teamService, anon key ile yazar) ----------
-- Kulüp tabanı + üyeler. Kimlik kullanıcı adıyla yürür; yazma işlemleri
-- (takım kurma/katılma/ayrılma) arkadaşlıklar gibi uygulamadan doğrudan
-- yapılır. Takım lideri ayrılınca takım silinir (üyeler cascade ile gider).
CREATE TABLE IF NOT EXISTS public.teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 30),
  emoji      TEXT NOT NULL DEFAULT '🏳️',
  leader     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id   UUID NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  username  TEXT NOT NULL,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, username)
);

CREATE INDEX IF NOT EXISTS team_members_username_idx ON public.team_members (username);

-- Kullanıcı başına TEK takım (uygulama kuralı artık veritabanında da var).
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
        (dup.role = 'leader' AND tm.role <> 'leader')
        OR (dup.role = tm.role AND dup.joined_at < tm.joined_at)
        OR (dup.role = tm.role AND dup.joined_at = tm.joined_at AND dup.team_id < tm.team_id)
      );
    CREATE UNIQUE INDEX team_members_one_team_idx ON public.team_members (username);
  END IF;
END $$;

-- ---------- 9.6) BİLİNEN SORGU KALIPLARI İÇİN İNDEKSLER ----------
CREATE INDEX IF NOT EXISTS friendships_user_id_idx   ON public.friendships (user_id);
CREATE INDEX IF NOT EXISTS friendships_friend_id_idx ON public.friendships (friend_id);
CREATE INDEX IF NOT EXISTS chat_messages_username_created_idx
  ON public.chat_messages (username, created_at DESC);
CREATE INDEX IF NOT EXISTS pomodoro_rooms_last_active_idx
  ON public.pomodoro_rooms (last_active_at DESC);
CREATE INDEX IF NOT EXISTS profiles_xp_desc_idx ON public.profiles (xp DESC);

-- ---------- 10) RLS + POLİTİKALAR ----------
-- Tüm eski/izinli politika adlarını isimden bağımsız temizle (panel yerel
-- dilde adlar üretebildiği için sabit isimli DROP yetersiz kalır).
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles', 'daily_earnings', 'quest_claims', 'admin_logs',
        'friendships', 'duels', 'chat_messages', 'pomodoro_rooms',
        'pomodoro_room_members', 'teams', 'team_members'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_earnings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_claims         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duels                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pomodoro_rooms       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pomodoro_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members         ENABLE ROW LEVEL SECURITY;
-- sync_requests: politika YOK + RLS açık → yalnızca servis rolü okur/yazar.
ALTER TABLE public.sync_requests        ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sync_requests FROM anon, authenticated;

-- Okuma herkese açık (anon key ile liderlik/arkadaş/sohbet çekilir).
CREATE POLICY "read_profiles"           ON public.profiles             FOR SELECT USING (true);
CREATE POLICY "read_daily_earnings"     ON public.daily_earnings       FOR SELECT USING (true);
CREATE POLICY "read_duels"              ON public.duels                FOR SELECT USING (true);
CREATE POLICY "read_chat"               ON public.chat_messages        FOR SELECT USING (true);
CREATE POLICY "read_rooms"              ON public.pomodoro_rooms       FOR SELECT USING (true);
CREATE POLICY "read_room_members"       ON public.pomodoro_room_members FOR SELECT USING (true);
CREATE POLICY "read_friendships"        ON public.friendships          FOR SELECT USING (true);
CREATE POLICY "read_teams"              ON public.teams                FOR SELECT USING (true);
CREATE POLICY "read_team_members"       ON public.team_members         FOR SELECT USING (true);

-- friendships: yazma işlemleri uygulamadan doğrudan yapılır (kimlik
-- kullanıcı adıyla; Supabase Auth yok). Bu tabloda anon yazma izinli.
CREATE POLICY "write_friendships"       ON public.friendships
  FOR ALL USING (true) WITH CHECK (true);

-- teams / team_members: takım kurma, katılma ve ayrılma da uygulamadan
-- doğrudan yapılır — anon yazma izinli (arkadaşlıklarla aynı model).
CREATE POLICY "write_teams"             ON public.teams
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "write_team_members"      ON public.team_members
  FOR ALL USING (true) WITH CHECK (true);

-- quest_claims / admin_logs: istemcilere TAMAMEN kapalı (servis rolü yazar).
CREATE POLICY "no_public_quest_claims"  ON public.quest_claims FOR ALL USING (false) WITH CHECK (false);

-- ---------- 10.5) KOLON BAZLI İZİNLER (recovery_hash gizliliği) ----------
-- RLS "herkes okuyabilir" derken TÜM kolonları da açıyordu. Kurtarma
-- anahtarı hash'i böylece her anon istemcinin eline geçiyordu (pass-the-hash
-- ile hesap ele geçirme). Burada yalnızca uygulamanın kullandığı kolonlar
-- verilir; recovery_hash YALNIZCA servis rolünce okunur.
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, username, name, emoji, streak, xp, coins, xp7d,
  avatar_id, frame_id, last_active, vip_until, last_sync_at,
  flagged, flagged_reason, banned, ban_reason, granted_items,
  bio, photo_url, created_at, updated_at
) ON public.profiles TO anon, authenticated;

-- ---------- 11) REALTIME: sohbet + canlı odalar anında yayınlanır ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pomodoro_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pomodoro_rooms;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pomodoro_room_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pomodoro_room_members;
  END IF;
END $$;

-- ---------- DOĞRULAMA (opsiyonel) ----------
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- Beklenen: admin_logs, chat_messages, daily_earnings, duels, friendships,
--           pomodoro_room_members, pomodoro_rooms, profiles, quest_claims,
--           team_members, teams
