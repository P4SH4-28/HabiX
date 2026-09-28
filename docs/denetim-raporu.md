# Denetim ve Dönüşüm Raporu — HabitTracker

Tarih: 2026-09-27 · Kapsam: denetim → güvenlik → senkron güvenilirliği → test/derleme

---

## 1. Keşif (inspected — kod okunarak doğrulandı)

| Bulgu | Kanıt |
|---|---|
| 104 kaynak dosya / ~683 KB; `src/context/DataContext.js` 2341 satırlık “god object” | dizin sayımı + okuma |
| Kimlik modeli: **Supabase Auth yok**, kimlik = kullanıcı adı; her şey Edge Function'larda servis rolüyle | `src/config/supabase.js`, 7 Edge Function |
| Edge Function'larda “Verify JWT” **kapalı** (kamuya açık uçlar) | fonksiyon yorum satırları + istemci çağrıları |
| Baseline: `tsc --noEmit` = **76 hata** (tamamı `supabase/functions/*`, Deno ortamı), lint yok, test dosyası yok | komut çıktısı |
| Kritik güvenlik bulguları (3 paralel kod denetimi) | §3 |
| Kritik senkron bulguları | §4 |

## 2. Yapılan değişiklikler (implemented)

### 2.1 Güvenlik (Faz 4)

| # | Değişiklik | Dosya |
|---|---|---|
| 1 | **İstemcide gizli anahtar kalmadı**: `src/config/admin.js` silindi (içindeki sabit admin anahtarı), gömülü admin şifresi `AuthContext`'ten silindi (gerçek değerler gizli tutulur; bkz. §3) | `src/config/admin.js` (D), `src/context/AuthContext.js` |
| 2 | Admin kimliği artık **sunucuda** doğrulanır: `login` → `ADMIN_PASSWORD_HASH` karşılaştırması (sabit-zamanlı) + `ADMIN_TOKEN_SECRET` ile HMAC imzalı **12 saatlik token**; tüm işlemler `x-admin-token` ister; hız sınırı (5/dk login, 60/dk işlem), `requestId` ile ayarlama/transfer/idempotency, tutar kırpmaları, bakiye sızıntısı yok, `recovery_hash` sorguda yok | `supabase/functions/admin-action/index.ts` |
| 3 | `recovery_hash` anon okuması **kapatıldı** (kolon bazlı `GRANT`) → pass-the-hash hesap ele geçirme kapandı | `001_security_hardening.sql` §5, `schema.sql` §10.5 |
| 4 | Negatif delta günlük tavanı: **-500 XP / -300 🪙 günde** (kimliksiz istemci bakiye sıfırlayamaz); `daily_earnings.neg_xp/neg_gold` ile biriktirilir | `sync-profile/index.ts`, migration §2 |
| 5 | `sync_requests` + istemcinin sabit `requestId`'si → **yanıt kaybında çift kredi yok** (yazılamazsa akış bozulmaz, 15 dk sonra yeniden denenir) | `sync-profile`, `syncService`, `DataContext` |
| 6 | Görev ödülü alımı **atomik**: SELECT→UPSERT yarışması kapatıldı (eşzamanlı iki istek tek ödül alır) | `sync-quest/index.ts` |
| 7 | Düello `finish` atomik (`active→done` iddiası), ham `.or()` sorgu kalıbı kaldırıldı (filtre enjeksiyonu), bakiye artışı koşullu (ezme yok), hız sınırları | `duel-action/index.ts` |
| 8 | VIP satın alımında **etkilenen satır** kontrolü (0 satır → 409, indirim uygulanmaz) | `vip-action/index.ts` |
| 9 | Kurtarma eylemi için **ayrı** hız sınırı (artık normal senkronu kilitlemiyor) | `recovery-action/index.ts` |
| 10 | Sohbet: kullanıcı adı uzunluk doğrulaması, IP/kullanıcı/oda hız sınırları | `chat-action/index.ts` |
| 11 | Tüm uçlarda `username` 2–64 karakter doğrulaması; ekonomi kolonlarına `CHECK (>=0)`; tek takım / tek aktif düello kısıtları; eksik indeksler | migration §0–§6 |

### 2.2 Senkron güvenilirliği (Faz 5)

| # | Hata | Düzeltme |
|---|---|---|
| 1 | `runSync`, `drainQueue(...)` sonucu hep truthy olduğu için **erken dönüyor** → yayın/ban/çek/son-senkron adımları hiç çalışmıyordu | ayrı `bannedDuringDrain`/`earningsPushed` bayrakları |
| 2 | Köprü (anchor) okunamadığında 0'dan başlıyordu → sunucu XP'si “yeni kazanç” olarak tekrar gönderilirdi | `profile_unreachable` ile durdurma |
| 3 | **Hesap değişiminde köprü sıfırlanmıyordu** → A'nın toplamı B'nin deltasına karışıyordu | yüklemede + `resetAll`'da sıfırlama, `await` sonrası hesap bekçisi |
| 4 | `enqueueMutation` eşzamanlı yazmalarda **kuyruk kaybediyordu**; `mergeKey` hiç eşleşmiyordu (çağıranlar `payload.mergeKey` veriyor, kod `input.mergeKey` bakıyordu) → LWW birleşim ölü koddu; birleşince **yanlış id** dönüyordu | anahtar bazlı kuyruk kilidi, iki mergeKey biçimi de kabul, `{id, timestamp}` dönüşü |
| 5 | Drain sırasında güncellenen satır silinebiliyordu (yeni değer kaybı) | `removeFromQueue(name, ids, expectedTimestamps)` |
| 6 | Widget “tamamla” tıklaması `pendingWidgetTasks` listesine yazılıp **hiç okunmuyordu** (sessiz veri kaybı) | `claimQuest` sonuç kodları + açılışta kuyruk boşaltma |
| 7 | `refreshServerMeta`, `getServerProfile`'ün yeni `{ok, profile}` biçimini eski nesne gibi okuyordu → ban/ödül/bio hiç uygulanmıyordu | biçim düzeltildi + `ok=false` ayrımı |
| 8 | `syncService.js` (`.ts` gölgesi) kırık `checkServerConnection` | `connectionService.js` olarak ayrıştırıldı; `edgeFetch` tüm uçlarda ortak (sunucu saati `Date` başlığından tazelenir) |

### 2.3 Kod kalitesi / altyapı

- Ölü kod silindi: `src/services/api.js` (kullanılmıyordu).
- `tsconfig.json` uygulamaya odaklandı; Deno'lular için `supabase/functions/tsconfig.json` ayrıldı → **76 tip hatası → 0**.
- `jest.config.js` + `package.json` betikleri: `test`, `test:watch`, `typecheck`.
- CI: APK derlemesinden **önce** `jest --ci` + `tsc --noEmit` (hatalı kod derlenemez).
- Belgeler: `docs/guvenlik-ve-dagitim.md` (sıra, secret üretimi/çevrilmesi, doğrulama listesi), `TESTING.md` güncellendi.

## 3. Güvenlik durumu

- **Kapatılan**: istemcide gizli anahtar/şifre; `recovery_hash` anon okuması; kimliksiz negatif delta ile bakiye sıfırlama; çift ödül/çift işlem (idempotency + atomik geçişler); sorgu kalıbı enjeksiyonu riski (`.or()`); eşzamanlı yarışmalar (kuyruk, finish, quest).
- **Koruma katmanları**: günlük pozitif tavan (500 XP/150 🪙), günlük negatif tavan (500/300), `flagged` bayrağı, sunucu günü ±1 gün tolerans, hız sınırları, `admin_logs` denetimi.
- **Döndürülmesi gereken sırlar** (eski sürümlerde APK'daydı): sabit admin anahtarı ve sabit admin şifresi → gerçek değerler belgelerde **yazılmaz**; yalnızca `HabitTracker.apk` içinde (repo history dahil) bulunur → `docs/guvenlik-ve-dagitim.md` §3 adımları.

## 4. UX / performans (denetlenen, sınırlı değişiklik)

- **UX**: Ayarlar’daki senkron düğmesi gerçek `refreshServer` çağırıyor + hata yakalıyor (önceki kod yanlış fonksiyona bağlıydı ve hata yutuluyordu); görev ret mesajları korundu; saat-ileri uyarısı toast'ı; admin hataları Türkçe, teknik kod arayüze sızmıyor.
- **Veritabanı**: bilinen sorgu kalıpları için 7 indeks (arkadaşlık iki yönlü, sohbet, oda, liderlik, düello) → N+1 yükü azalır.
- **Yapılmayan (dürüstçe)**: bileşen/seviye render optimizasyonu ve büyük çaplı `DataContext` parçalama yapılmadı (yüksek risk/geri dönüş); UI tasarımsal yenileme yapılmadı.

## 5. Testler ve doğrulama

| Komut | Sonuç |
|---|---|
| `npx jest` | **65/65 yeşil** (49 saf mantık + 16 senkron kuyruk) |
| `npx tsc --noEmit` | **0 hata** (önce: 76) |
| `npx expo export --platform android` | ✅ Hermes bundle üretildi (4.7 MB) — tüm değişiklikler derleniyor |
| `git status` | 23 dosya değişti, 9 yeni, 3 silindi; kullanıcı değişiklikleri (`package.json`, `logic.js` vb.) korundu |

Test kapsamı: tarih/seri/ekonomi/hash saf fonksiyonları; kuyruk yarışması, LWW birleşim, drain başarı/hata, beklenen-timestamp koruması, `localWins`.
**Test edilmeyen**: Edge Functions (Deno, yerelde çalıştırılamadı — doğrulama statik inceleme + kılavuzdaki liste), UI bileşenleri, E2E.

## 6. Derleme / dağıtım

- APK CI hattı: `npm ci` → test → tsc → prebuild → Gradle (imza Secret'lardan) → artifact + release.
- ~~**Dağıtım sırası (zorunlu)**: ① `001_security_hardening.sql` → ② 7 Edge Function yeniden deploy (Verify JWT kapalı) → ③ Secrets (`ADMIN_TOKEN_SECRET`, `ADMIN_PASSWORD_HASH`, `ADMIN_KEY` kaldır) → ④ kılavuzdaki doğrulama listesi.~~
- **Güncelleme (2026-09-28, §8):** `001_security_hardening.sql` **DEPRECATED — canlıda hata verir, çalıştırma**. Yerine ① `supabase/migrations/002_reconciled_baseline.sql` (FAZ 0-10, henüz uygulanmadı) → ② 7 Edge Function deploy → ③ Secrets → ④ doğrulama listesi. Ayrıntı: §8.

## 7. Sınırlılıklar ve sonraki adımlar

1. **Supabase Auth yok** — kimlik hâlâ kullanıcı adı beyanı; tüm koruma fonksiyon içi tavan/atomiklik/idempotency ile kuruldu. Tam geçiş (email+password, `auth_user_id`, tüm uçlarda JWT doğrulama) ayrı bir göç projesidir; kullanıcı verisi etkilediği için bu oturumda bilinçli olarak yapılmadı.
2. **Verify JWT kapalı** — uçlar kamuya açık; oran sınırı için ağ geçidi katmanı önerilir.
3. **Hız sınırları bellek içi/instance başına** — soğuk start'ta sıfırlanır.
4. **Negatif tavan kasıtlı** — yedekten çok büyük XP düşüşü sunucuya tam yansımayabilir (cihaz yerel değeri korur).
5. Bileşen/E2E testi, ESLint ve `pullDeltaProfiles`/`localWins` gibi henüz çağrılmayan yardımcılar için net karar (bağla veya sil) sonraki iş kalemidir.
6. Edge Functions yerelde çalıştırılıp **deploy edilemedi** — canlı doğrulama dağıtımdan sonra yapılmalıdır.

---

## 8. Canlı Şema Denetimi — Live / 001 / schema.sql Üçlü Reconciliation (2026-09-28)

> **Kapsam ve kısıt:** yalnızca salt-okunur REST/SELECT. Bu bölüm üretilirken **hiçbir mutation yok**: migration çalıştırılmadı, Edge Function deploy edilmedi, secret döndürülmedi, push yapılmadı. Hedef: `abqvphwuafsnfpgfppme` (anon key üzerinden).
>
> **Ölçüm özet (2026-09-28):** profiles 8 · daily_earnings 25 · friendships 3 (pending 0 / accepted 3 / rejected 0, self-pair 0) · duels 1 (`Alttantre vs P4SH4`, `pending`, benzersiz çift 1, tekrarlı çift 0) · chat 1 · rooms 2 · members 1 · quest_claims 0 · admin_logs 0 · storage bucket `[]` · teams/team_members/sync_requests **YOK** (6 bağımsız kanıt: REST 404 `PGRST205`, columns, table_privileges, pg_indexes, pg_constraint, pg_policies).

### A) Live → expected farkları

| Alan | Live (2026-09-28) | Beklenen (schema.sql) | 001 kapatıyor mu? |
|---|---|---|---|
| Tablo | 9 | 12 | **Hayır** (`teams`,`team_members`,`sync_requests` CREATE yok) |
| `profiles` kolon | **11 eksik** (name, emoji, streak, xp7d, avatar_id, frame_id, last_active, vip_until, bio, photo_url, updated_at) | 23 | **Hayır** |
| `daily_earnings.neg_*` | yok | var | ✅ |
| `admin_logs.request_id` | yok | var | ✅ |
| `chat_messages.avatar_photo` | yok (canlı REST 400) | var | **Hayır** |
| Index | 17 beklenen → 5 var, **12 eksik** | 17 | 10/12 (eksik: `profiles_updated_at_idx`, `team_members_username_idx`) |
| CHECK | 6 var, **8 eksik** | 14 | ✅ tamamı 001'de |
| RLS | 9/9 açık ✅ | 12 tablo | tablo yokluğundan 9 |
| Policy | 9/13 (eksik 4'ü team politikası) | 13 | **Hayır** (001 policy üretmez) |
| GRANT `profiles` | anon tam yetki; `recovery_hash` REST 200 = **AÇIK** | REVOKE + 22 kolonluk SELECT | ⚠️ §5 var ama 11 kolon eksik → hata verir |
| Storage | bucket `[]` | `avatars` + 4 policy | **Hayır** |
| Drift | `friendships_status_check` = pending/accepted/**rejected**; `user_id<>friend_id` CHECK **yok** | pending/accepted + self-check | **Hayır** |

### B) 001 migration risk analizi (satır bazlı)

| Bölüm | Sınıf | Live durumu |
|---|---|---|
| 24–25 (`xp`,`coins` clamp) | veri değiştiren + idempotent | **0 satır** → güvenli |
| **26–27 (`xp7d`,`streak` clamp)** | **canlıda olmayan kolona bağlı** | **İLK HATA 42703** → Dashboard tek transaction → **tüm script geri alınır, hiçbir şey uygulanmaz** |
| 35–39 CHECK | güvenli | ✅ |
| **41–45 (`xp7d`,`streak` CHECK)** | **kolon bağımlı → hata** | çalışmazdı |
| 47–55 CHECK | idempotent (DROP+ADD), ölçüm 0 ihlal | ✅ |
| 62–66 `neg_*` + CHECK | güvenli, sıra doğru | ✅ |
| **71–91 `team_members` DO** | **olmayan tabloya bağlı → hata** | tablo yok |
| 96–114 `duels` DO | veri değiştiren (DELETE) + idempotent koruma | ölçüm: 1 satır, 0 çakışma → **DELETE 0 satır**, index güvenli |
| 121–125 GRANT | **ön koşul gerektiren** (11 kolon yok → hata) | FAZ 0'dan sonra |
| 132–143 index | güvenli/idempotent | ✅ |
| 148–150 `request_id` + partial unique | güvenli (admin_logs **0 satır**) | ✅ |
| 157–167 `sync_requests` | güvenli (CREATE + RLS + REVOKE) | ✅ |
| **Eksik kalanlar** | `profiles_updated_at_idx`, `team_members_username_idx`, `chat.avatar_photo`, `teams`/`team_members` CREATE + RLS + 4 policy, storage, friendships drift | — |

Ek bulgular: 001'de BEGIN/COMMIT yok (Dashboard tek gönderimde transaction'a alır; `psql` ile parça parça uygulanırsa 24–25 kalıp sonrası uygulanmaz). Satır 102 yorumu **yanlış**: "daha yenisi silinir" derken koşul `a.created_at < b.created_at` → **eskisini siler** ("id'ye göre" ifadesi de yanlış, `created_at`).
**schema.sql'i de aynı audit göçertiyordu:** §1 mevcut tabloya yalnızca bio/photo_url/updated_at ekliyordu (diğer 8 kolon yalnızca `CREATE TABLE` içindeydi) → §1.5'teki `xp7d` clamp'i orada da hata verirdi; §1.5'teki `CREATE POLICY IF NOT EXISTS` **PostgreSQL'de geçersiz sözdizimi** (4 satır) → "idempotent" iddiası tutmuyordu.

### C) 2 DELETE + 7 UPDATE etkisi (yalnızca SELECT ile ölçüldü)

| İfadeler | Etkilenen satır |
|---|---|
| `profiles.xp<0` / `coins<0` | **0 / 0** |
| `profiles.xp7d<0` / `streak<0` | ölçülemedi (kolon yok) → eklendikten sonra `DEFAULT 0` → **0** |
| `daily_earnings.xp<0` / `gold<0` | **0 / 0** (25 satır üzerinden) |
| `duels.start_xp_*<0` | **0 / 0** |
| **DELETE `team_members`** | **0** (tablo yok; 002 FAZ 4'te boş oluşur) |
| **DELETE `duels` (dedup)** | **0** (1 satır; status<>done=1, benzersiz çift=1, tekrar=0, eşit created_at=0) |

### D) Gerekli migration sırası

`FAZ 0 kolonlar` → `FAZ 1 clamp` → `FAZ 2 CHECK + neg_*` → `FAZ 3 request_id` → `FAZ 4 tablolar + RLS + policy + GRANT` → `FAZ 5 dedup DELETE + unique index` → `FAZ 6 index` → `FAZ 7 profiles REVOKE/GRANT` → `FAZ 8 storage` → `FAZ 9 (opsiyonel)` → `FAZ 10 doğrulama`.
Kritik sıra kuralları: kolonlar clamp/CHECK/GRANT'ten önce; tablolar `team_members` DO ve `team_members_username_idx`'den önce; unique index'ler dedup DELETE'ten sonra; `profiles_updated_at_idx` `updated_at`'ten sonra.

### E) 001'de değiştirilmesi gereken bölümler

1. 26–27 ve 41–45 → FAZ 0'a taşınmalı (11 kolon `ADD COLUMN IF NOT EXISTS`).
2. §3 (71–91): `teams`/`team_members` CREATE + RLS + `read/write_teams` + `read/write_team_members` + GRANT eklenmeli.
3. §5 (121–125): FAZ 0'dan **sonraya** taşınmalı (liste schema.sql §10.5 ile birebir ✅, `recovery_hash` hariç ✅).
4. §6'ya ek: `profiles_updated_at_idx`, `team_members_username_idx`.
5. Yeni bölüm: `chat_messages.avatar_photo ADD COLUMN`.
6. Yeni bölüm: storage `avatars` + 4 policy (DO drop/create ile; `CREATE POLICY IF NOT EXISTS` sözdizimi bug).
7. 102/104 yorumu düzelt (eskisini siler; `created_at`).
8. friendships drift kararı (I).
9. schema.sql §1'e 8 eksik ALTER + §1.5 sözdizimi düzeltilmeli → **bu bölümde yapıldı**.

### F) Storage / avatar planı

1. `INSERT INTO storage.buckets (...) ON CONFLICT DO NOTHING` — idempotent (canlıda 0 bucket).
2. `avatars_{read,insert,update,delete}` 4 politika (DO drop/create) — `avatarService` `upsert:true` kullandığı için **update politikası şart**.
3. Sıra: bucket → policy → `GET /storage/v1/bucket` = `[avatars]`.
4. **Önceden var olan tasarım riski (migration'dan bağımsız):** yol `${username}.${ext}` + anon `INSERT/UPDATE` → her anon istemci başka kullanıcının fotoğrafını **ezabilir**. Kabul edilecekse dokümante et; kapatmak yükleme işini Edge Function'a taşımak gerekir (deploy = ayrı, BLOCKED adım).

### G) RLS / GRANT planı

- `profiles`: `REVOKE ALL FROM anon, authenticated` → 22 kolonluk `GRANT SELECT`. **Ön koşul FAZ 0.** Doğrulama: `column_privileges` = 22 satır, `recovery_hash` YOK; REST `select=recovery_hash` 200 dönmemeli.
- İstemci güvenliği ölçüldü: `src/` içinde `profiles` yazması 0, `select('*')` 0, `recovery_hash` okuma 0 → REVOKE kırılma yaratmaz; Edge Function'lar `service_role`.
- Yeni tablolar: RLS + policy + explicit GRANT aynı blokta (aksi halde default privilege ile anon tam yetkili, policiesiz açık kalır).
- `sync_requests`: RLS açık + politika yok + REVOKE → yalnızca servis rolü ✅.
- Mevcut 9 tabloda anon yazma grant'ı RLS ile zaten etkisiz (kanıt: 401 RLS + read-only policy); derinlik için `REVOKE` opsiyonel (002 FAZ 9, kapalı).

### H) Index / constraint planı

- **12 eksik index:** 001'in zaten eklediği 10 (`admin_logs_request_id_idx`, `duels_active_unordered_idx`, `duels_opponent_idx`, `friendships_{user,friend}_id_idx`, `chat_messages_username_created_idx`, `pomodoro_rooms_last_active_idx`, `profiles_xp_desc_idx`, `sync_requests_created_idx`, `team_members_one_team_idx`) + **001'de olmayan 2 → 002 ekliyor:** `profiles_updated_at_idx`, `team_members_username_idx`. Mevcut 5'e dokunma.
- **8 eksik CHECK:** `profiles_{xp,coins,xp7d,streak}_nonneg`, `daily_earnings_{xp,gold,neg}_nonneg`, `duels_start_xp_nonneg` → 002 FAZ 2; clamp 0 satır + `neg_*` `DEFAULT 0` → validation geçer.

### I) `friendships_status_check` drift çözümü

- Ölçüm: `rejected` **0 satır**, schema-dışı status 0, `user_id = friend_id` **0**; uygulama yalnızca `pending`/`accepted` (`friendService` sabitleri).
- **Karar (0 risk):** canlıya dokunmadı → `schema.sql`'e `rejected` eklenerek drift kapatıldı (§5, bu bölümde). Canlı daha geniş olduğu için dar DDL gerekmedi.
- `user_id <> friend_id` CHECK canlıda yok, ihlal 0 → 002 FAZ 9'da **kapalı/opsiyonel**.

### J) Production öncesi son kontroller

1. Yedek (Dashboard → Backups) — şart.
2. C1–C3 sayım/anahtarları **çalıştırma anında yeniden ölç**; değişmişse DUR.
3. Tek gönderim = tek transaction (Dashboard); `psql` ile `--single-transaction`.
4. Hata → tam rollback → FAZ'ları tek tek çalıştırıp ilk hata noktasını izole et.
5. Sonrası 002 FAZ 10 doğrulama (index/policy/grant + 2 REST probe).
6. PostgREST şema önbelleği yenilenmezse 400 devam eder → `NOTIFY pgrst, 'reload schema'`.
7. Edge Function deploy, secret rotation, push **[BLOCKED]** (credential yok) — bu rapor kapsamaz.
8. Realtime publication (`supabase_realtime`) salt-SELECT ile doğrulanamadı → `pg_publication_tables`.
9. Bilinçli kararlar: storage anon `upsert` riski (F4), FAZ 9 opsiyonel REVOKE'lar.

### K) Önerilen migration dosyası

**`supabase/migrations/002_reconciled_baseline.sql`** (DRAFT, 294 satır, **uygulanmadı, değişmedi**) — 001'i çalıştırmak yerine bu kullanılır: FAZ 0 (11 kolon + avatar_photo) · FAZ 1 (7 clamp) · FAZ 2 (8 CHECK + `neg_*`) · FAZ 3 (`request_id`) · FAZ 4 (sync_requests/teams/team_members + RLS + 4 policy + GRANT) · FAZ 5 (2 dedup DELETE, DO korumalı, ölçüm yorumlu) · FAZ 6 (12 index) · FAZ 7 (`recovery_hash` REVOKE/GRANT) · FAZ 8 (storage, DO'lu politika) · FAZ 9 (opsiyonel/kapalı) · FAZ 10 (salt-SELECT doğrulama). Başlıkta PRE-FLIGHT ölçüm bloğu ve DUR koşulu var.

**Bu bölümde yapılan repo değişiklikleri (DB'ye uygulanmadı):** `schema.sql` §1 11 ALTER + §1.5 storage DO düzeltmesi + §5 friendships status genişletme; `001` başına DEPRECATED başlığı; §6 dağıtım sırası 002'ye çevrildi.
