-- ============================================================
-- 002_reconciled_baseline.sql  —  DRAFT (ÜRETİLDİ, HİÇBİR ŞEKİLDE
-- UYGULANMADI). Amaç: bozuk 001_security_hardening.sql yerine,
-- salt-okunur canlı audit (2026-09-28) + schema.sql üçlü
-- karşılaştırmasından çıkarılan DÜZELTİLMİŞ sıra.
--
-- KURAL: Bu dosya yalnızca kullanıcı onayı + yedek + Dashboard
--        SQL Editor (tek transaction) ile çalıştırılır.
--        Bu oturumda DEVRİYE ALINMADI, çalıştırılmadı.
--
-- PRE-FLIGHT ÖLÇÜM (salt-SELECT, 2026-09-28 — çalıştırma anında
-- yeniden doğrulanmalıdır; değişmişse DUR):
--   profiles 8 · daily_earnings 25 · duels 1 · friendships 3
--   chat 1 · rooms 2 · members 1 · quest_claims 0 · admin_logs 0
--   clamp hedefi (xp/coins/xp7d/streak/daily xp/gold/start_xp) : 0 satır
--   duels status<>done : 1, benzersiz çift 1, tekrarlı çift 0
--   friendships: pending 0 / accepted 3 / rejected 0, self-pair 0
--   teams, team_members, sync_requests, avatars bucket : YOK
--   eksik profiles kolonu : 11  · eksik index : 12 · eksik CHECK : 8
-- ============================================================


-- ============================================================
-- FAZ 0 — EKSİK KOLONLAR (yıkıcı değil; schema.sql §1 ile birebir)
-- 001'in 26/27/41-45 ve §5 GRANT satırları bu kolonlara BAĞLI
-- olduğu için BUNLARDAN ÖNCE gelmek zorunda.
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name        TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emoji       TEXT DEFAULT '😀';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp7d        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_id   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS frame_id    TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_until   TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio         TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_url   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT now();

-- chat-action avatar kolonu (001'de YOK; schema.sql:216/221 var)
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS avatar_photo TEXT;


-- ============================================================
-- FAZ 1 — 7 CLAMP/UPDATE (veri değiştiren; ölçüm: 0 satır etki)
-- Sıra: FAZ 0'tan SONRA — xp7d/streak artık var.
-- ============================================================
UPDATE public.profiles SET xp     = GREATEST(xp, 0)     WHERE xp < 0;
UPDATE public.profiles SET coins  = GREATEST(coins, 0)  WHERE coins < 0;
UPDATE public.profiles SET xp7d   = GREATEST(xp7d, 0)   WHERE xp7d < 0;
UPDATE public.profiles SET streak = GREATEST(streak, 0) WHERE streak < 0;
UPDATE public.daily_earnings SET xp   = GREATEST(xp, 0)   WHERE xp < 0;
UPDATE public.daily_earnings SET gold = GREATEST(gold, 0) WHERE gold < 0;
UPDATE public.duels SET start_xp_challenger = GREATEST(start_xp_challenger, 0),
                        start_xp_opponent   = GREATEST(start_xp_opponent, 0)
WHERE start_xp_challenger < 0 OR start_xp_opponent < 0;


-- ============================================================
-- FAZ 2 — 8 EKSİK CHECK (idempotent: DROP IF EXISTS + ADD)
-- Doğrulama: clamp sonrası tüm satırlar >= 0 → validation geçer.
-- ============================================================
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
ALTER TABLE public.daily_earnings ADD COLUMN IF NOT EXISTS neg_xp  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.daily_earnings ADD COLUMN IF NOT EXISTS neg_gold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.daily_earnings DROP CONSTRAINT IF EXISTS daily_earnings_neg_nonneg;
ALTER TABLE public.daily_earnings ADD CONSTRAINT daily_earnings_neg_nonneg
  CHECK (neg_xp >= 0 AND neg_gold >= 0);

ALTER TABLE public.duels DROP CONSTRAINT IF EXISTS duels_start_xp_nonneg;
ALTER TABLE public.duels ADD CONSTRAINT duels_start_xp_nonneg
  CHECK (start_xp_challenger >= 0 AND start_xp_opponent >= 0);


-- ============================================================
-- FAZ 3 — ADMIN IDEMPOTENCY KOLONU (001 §7)
-- ============================================================
ALTER TABLE public.admin_logs ADD COLUMN IF NOT EXISTS request_id TEXT;


-- ============================================================
-- FAZ 4 — OLMAYAN TABLOLAR (001 bunları varsayar; canlıda YOK)
-- Üçü de CREATE TABLE IF NOT EXISTS → mevcut veriye dokunmaz.
-- YENİ tablolar Supabase default privilege'ıyla anon'a TAM yetki
-- alır → RLS + policy HEMEN aynı blokta açılmazsa tablo açık kalır.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sync_requests (
  username    TEXT        NOT NULL,
  request_id  TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (username, request_id)
);

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

-- RLS: sync_requests politikasız (yalnızca servis rolü),
--      teams/team_members friendships ile aynı anon-yazma modeli.
ALTER TABLE public.sync_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_requests_service_only ON public.sync_requests;
REVOKE ALL ON public.sync_requests FROM anon, authenticated;

DROP POLICY IF EXISTS read_teams        ON public.teams;
DROP POLICY IF EXISTS write_teams       ON public.teams;
DROP POLICY IF EXISTS read_team_members ON public.team_members;
DROP POLICY IF EXISTS write_team_members ON public.team_members;
CREATE POLICY "read_teams"        ON public.teams         FOR SELECT USING (true);
CREATE POLICY "write_teams"       ON public.teams         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_team_members" ON public.team_members  FOR SELECT USING (true);
CREATE POLICY "write_team_members" ON public.team_members FOR ALL USING (true) WITH CHECK (true);

-- Deterministik yetki (default privilege'a bağımlı kalmamak için;
-- friendships'in canlıda anon/authenticated/service_role tam yetkisiyle aynı)
GRANT ALL ON public.teams        TO anon, authenticated, service_role;
GRANT ALL ON public.team_members TO anon, authenticated, service_role;


-- ============================================================
-- FAZ 5 — VERİ TEMİZLİĞİ (2 DELETE; ölçüm: ikisi de 0 satır)
-- Tablo/index yokluğuna bağlı DO korumaları korunur (idempotent).
-- ============================================================
-- 5a) team_members: FAZ 4'te yeni ve boş → 0 satır (garanti)
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

-- 5b) duels: ölçüm → 1 satır (Alttantre vs P4SH4, pending),
--     benzersiz çift 1, tekrarlı çift 0 → DELETE 0 satır.
--     NOT: koşul a.created_at < b.created_at → eskisini siler,
--     yeniyi tutar (001:102 yorumu "yenisi silinir" DER — yanlıştır).
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


-- ============================================================
-- FAZ 6 — 001'in ATLADIĞI + MEVCUT 12 EKSİK İNDEX
-- (001 §6/§7/§8'deki 10 index + 001'de OLMAYAN 2'si)
-- ============================================================
-- 001'de olmayan (J maddesi):
CREATE INDEX IF NOT EXISTS profiles_updated_at_idx  ON public.profiles (updated_at);
CREATE INDEX IF NOT EXISTS team_members_username_idx ON public.team_members (username);
-- 001 §6:
CREATE INDEX IF NOT EXISTS friendships_user_id_idx     ON public.friendships (user_id);
CREATE INDEX IF NOT EXISTS friendships_friend_id_idx   ON public.friendships (friend_id);
CREATE INDEX IF NOT EXISTS chat_messages_username_created_idx
  ON public.chat_messages (username, created_at DESC);
CREATE INDEX IF NOT EXISTS pomodoro_rooms_last_active_idx
  ON public.pomodoro_rooms (last_active_at DESC);
CREATE INDEX IF NOT EXISTS profiles_xp_desc_idx ON public.profiles (xp DESC);
CREATE INDEX IF NOT EXISTS duels_opponent_idx   ON public.duels (opponent);
-- 001 §7/§8:
CREATE UNIQUE INDEX IF NOT EXISTS admin_logs_request_id_idx
  ON public.admin_logs (request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sync_requests_created_idx ON public.sync_requests (created_at);
-- mevcut (001 §9 doğrulandı): friendships_active_pair_idx,
-- duels_active_pair_idx, chat_messages_created_at_idx,
-- quest_claims_{day,username_day}_idx — tekrar eklenmez.


-- ============================================================
-- FAZ 7 — recovery_hash ANON ERİŞİMİ KAPAT (001 §5, 001'deki
-- 22 kolon listesi schema.sql §10.5 ile birebir aynı → doğrulandı)
-- ÖN ŞART: FAZ 0 (11 kolon yoksa GRANT HATA VERİR).
-- ============================================================
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, username, name, emoji, streak, xp, coins, xp7d,
  avatar_id, frame_id, last_active, vip_until, last_sync_at,
  flagged, flagged_reason, banned, ban_reason, granted_items,
  bio, photo_url, created_at, updated_at
) ON public.profiles TO anon, authenticated;
-- Teyit: recovery_hash bu listede YOK. İstemcide profiles'a yazma yok,
-- select('*') yok, recovery_hash okuma yok (grep 0) → kırılma yok.


-- ============================================================
-- FAZ 8 — STORAGE: avatars bucket + 4 politika
-- (canlıda bucket = [] → hiç oluşmamış)
-- NOT: schema.sql:79-82'deki `CREATE POLICY IF NOT EXISTS`
--      GEÇERSİZ SÖZDİZİMİDİR (PostgreSQL'de yok) → burada DO bloğu.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN ('avatars_read', 'avatars_insert', 'avatars_update', 'avatars_delete')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "avatars_read"   ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE TO anon
  USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE TO anon USING (bucket_id = 'avatars');


-- ============================================================
-- FAZ 9 (OPSIYONEL — varsayılan KAPALI, onay ister)
-- friendships user_id <> friend_id CHECK: canlıda YOK, ölçümde
-- ihlal 0 satır. Eklemek güvenlik kazandırır; ek DDL'dir.
-- ============================================================
-- ALTER TABLE public.friendships DROP CONSTRAINT IF EXISTS friendships_no_self;
-- ALTER TABLE public.friendships ADD CONSTRAINT friendships_no_self CHECK (user_id <> friend_id);
--
-- friends/duel/chat/rooms tablolarında anon WRITE grant'ı RLS ile
-- zaten engelleniyor; derinlik savunması olarak kapatılabilir
-- (schema.sql'e de eklenmeli — tek kaynak korunur):
-- REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.admin_logs,
--   public.quest_claims, public.daily_earnings, public.duels,
--   public.chat_messages, public.pomodoro_rooms,
--   public.pomodoro_room_members FROM anon, authenticated;


-- ============================================================
-- FAZ 10 — DOĞRULAMA (salt-SELECT; uygulama sonrası çalıştırılır)
-- ============================================================
-- SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' ORDER BY 1;
-- SELECT conname, conrelid::regclass FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 2,1;
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY 1,2;
-- SELECT table_name, grantee, privilege_type FROM information_schema.table_privileges
--   WHERE table_schema='public' AND grantee IN ('anon','authenticated') AND table_name='profiles';
-- SELECT column_name FROM information_schema.column_privileges
--   WHERE table_name='profiles' AND grantee='anon' ORDER BY 1;   -- 22 satır, recovery_hash YOK
-- SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--   WHERE n.nspname='public' AND c.relkind='r' ORDER BY 1;       -- 12 tablo, hepsi true
-- REST: GET /rest/v1/profiles?select=recovery_hash  -> 200 OLMAMALI (4xx)
-- REST: GET /rest/v1/profiles?select=photo_url,xp7d,streak -> 200
-- REST: GET /storage/v1/bucket -> [avatars]
