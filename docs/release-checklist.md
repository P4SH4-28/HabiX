# Yayın Hazırlık Kontrol Listesi (Release Candidate)

> **Durum işareti:** `[x]` = gerçekten doğrulandı (yerel test/kod/analiz) · `[ ]` = doğrulanmadı /
> manuel / erişim yok · `[BLOCKED]` = release blocker · `[NOT EXECUTED]` = çalıştırılmadı ·
> `[!]` = bilinen açık/karar.
>
> Denetim tarihi: 2026-09-27 (2. oturum: FAZ 0–12 üretim ölçümü) · Dal: `main` ·
> Detay: `docs/denetim-raporu.md`, `docs/guvenlik-ve-dagitim.md`, `docs/manual-smoke-test.md`

---

## 0. RELEASE BLOCKER — hedef proje doğrulandı, YAZMA kanalı yok

Bu ortamdan yapılan kontrol sonuçları (değerler yazılmaz):

- [x] Hedef ref `src/config/supabase.js`'ten okundu: `abqvphwuafsnfpgfppme` (tek proje; repo'da
      staging/production ayrımı **yok**).
- [x] **FAZ 3 — bağlantı DOĞRULANDI (2026-09-27):** `abqvphwuafsnfpgfppme.supabase.co` artık
      çözümleniyor (Cloudflare DoH **ve** Google DoH `Status=0`, yerel DNS aynı IP). Kontrol ref'i
      hâlâ NXDOMAIN → gerçek proje. REST uçları canlı: `profiles` salt-okunur sorgu **HTTP 200**
      (mevcut kullanıcı verisi var → **yıkıcı işlem yasak**). Önceki oturumdaki NXDOMAIN sorunu
      artık **yok**.
- [x] Erişim kanalları (varlık kontrolü, değer yazılmaz): Supabase CLI **kurulu değil**; CLI oturum
      dosyası **yok**; `SUPABASE_ACCESS_TOKEN` **yok**; `SUPABASE_SERVICE_ROLE_KEY` **yok**;
      `GITHUB_TOKEN`/`GH_TOKEN` **yok**; `supabase/config.toml` **yok**; `.env` **yok**;
      `gh` oturumu **yok**; repo genelinde `sbp_`/`sb_secret_`/JWT deseni araması **0**.
- [BLOCKED] **Eksik credential (ad olarak): `SUPABASE_ACCESS_TOKEN` (Supabase CLI/Dashboard
      kimliği), `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_TOKEN`.** Salt-okunur REST anon anahtarıyla
      sınırlandığı için: migration (§4), Edge Functions deploy (§6), secret rotation (§5)
      **uygulanamadı** — uydurulmadı, tahmin edilmedi.
- [ ] **Kullanıcı aksiyonu:** erişim kanalı sağlayacak (Supabase CLI `login` token'ı **veya**
      Dashboard'da manuel adımları kullanıcı çalıştıracak). Ardından §4 → §6 → §5 sırası.
- [x] `git push` **yapılmadı** (push gate'i §4/§5/§6 tamamlanmadan kapalı; **7 commit** local).

---

## 1. Depo durumu

- [x] `git status` temiz; iş `main` üzerinde 6 commit olarak duruyor (guvenlik → senkron → test → ci → docs → chore).
- [x] Dal tek (`main`) + `origin/main` var; stash yok; `memory/` ignore edildi; staged dosya yok.
- [x] CI (`.github/workflows/build-apk.yml`) `npm ci` → **`npx jest --ci`** → **`npx tsc --noEmit`** → prebuild → release APK/AAB akışını içeriyor (hatalı kod APK'ye ulaşmadan düşer).
- [ ] Push YAPILMADI → CI henüz koşmadı (§0 nedeniyle gate kapalı).
- [!] CI her yeşil derlemede `HabitTracker.apk`'yi repoya geri itiyor → eski APK'daki sırlar git geçmişinde **kalıcı**; tek gerçek düzeltme rotation (§5).

## 2. Kaynak kod güvenlik denetimi (bu denetimde doğrulandı)

- [x] İstemcide admin sırrı yok: `src/config/admin.js` silindi, `AuthContext`'te gömülü şifre yok (`ht-admin*`/sabit şifre için text dosyalarında eşleşme: **0**).
- [x] `admin-action`: sabit-zamanlı şifre karşılaştırması, HMAC imzalı 12 saatlik token, `x-admin-token` zorunlu, 5/dk login + 60/dk işlem hız sınırı, `requestId` idempotency, `503 admin_not_configured` (Secrets yoksa), ILIKE kaçışı, sabit hata mesajı (kullanıcı/şifre ayrımı yok).
- [x] `sync-profile`: IP 30/dk, `requestId` idempotency (`sync_requests`, 15 dk yaş), günlük negatif tavan (-500 XP / -300 🪙), eksik kolon toleransı (`isColumnMissing`), `releaseRequestId` geri alma.
- [x] `sync-quest`: 20/60 sn hız sınırı + **atomik** şartlı UPDATE → INSERT (çift ödül imkânsız, çakışmada 409), ban reddi.
- [x] `duel-action`: ham `.or()` yok (parametreli sorgu), atomik `active→done` iddia, `reward_claimed` kurtarma yolu, optimistik kilit + yeniden deneme, IP 30/dk + rakip başına 3/10 dk.
- [x] `vip-action`: etkilenen satır sayısı kontrolü → 409 `concurrency_conflict`, kullanıcı 10/dk.
- [x] `recovery-action`: ayrı IP (20/dk) + IP/kullanıcı (12/5 dk) sayaçları, yanlış anahtar 401, `recovery_hash` anon okunamaz (kolon bazlı GRANT).
- [x] `chat-action`: kullanıcı adı 2–64, mesaj uzunluk sınırları, IP 60/dk, mesaj 1/5 sn, oda 3/10 dk.
- [x] RLS/GRANT: `profiles` yazma istemciye kapalı; anon yalnızca `friendships`/`teams`/`team_members` yazar (uygulama yazmalarıyla birebir); `quest_claims`/`admin_logs`/`sync_requests` istemciye tamamen kapalı.
- [x] Bekleyen istemci uçları: `refreshServerMeta` artık hesap-değişimi guard'ına sahip (eski hesabın sonucu yeni hesaba yazılmaz).
- [ ] **Yayın öncesi:** `supabase secrets unset ADMIN_KEY` çalıştırılacak (geçiş anahtarı tanımlıysa eski APK'daki anahtarla hâlâ işlem yapılabilir — bkz. §5).
- [!] `admin_logs` denetimi periyodik okunmalı: `SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 50;`

## 3. Gizli değer taraması (repo geneli + APK) — FAZ 2 yenilendi

- [x] Kaynak/docs/config: `service_role` değeri **YOK**, JWT/gizli anahtar değeri **YOK**,
      AWS/GitHub/Slack **YOK**, özel anahtar **YOK**, `ADMIN_TOKEN_SECRET`/`ADMIN_PASSWORD_HASH`/
      `ADMIN_KEY` **atanmış değeri YOK** (yalnızca `Deno.env.get(...)`).
- [x] `sb_publishable_*` yalnızca `src/config/supabase.js` — **yayınlanabilir (publishable) anahtar**,
      kasıtlı; koruma RLS'te. **Yanlışlıkla silinmeyecek.**
- [x] Bundle içindeki `sb_secret_` eşleşmesi **kütüphane literal'idir, anahtar değildir**: aynı imza
      (devam=17, tamamı küçük harf, rakam yok) temiz kaynaktan üretilen yeni bundle'da da var;
      `@supabase/functions-js`/`supabase-js` dist dosyalarında geçiyor. Gerçek secret key
      formatıyla uyuşmuyor → **aksiyon yok**.
- [x] **Eski `HabitTracker.apk` = COMPROMISED artifact** (değerler yazılmaz): `assets/index.android.bundle`
      içinde 2 eski admin sırrı tespit edildi — dosya: `HabitTracker.apk`, tür: eski sabit admin
      anahtarı + gömülü admin şifresi literal'i → **action: rotate + release'e yeniden taşınmayacak**
      (ayrıca `git history` içinde, commit `a5cd83f`/eski derlemeler).
- [x] **Yeni bundle (HEAD, `dist/`) temiz:** eski sabit admin anahtarı = YOK · eski admin şifresi
      literal'i = YOK · `ADMIN_TOKEN_SECRET`/`ADMIN_PASSWORD_HASH` = YOK · `service_role` = YOK ·
      yalnızca `sb_publishable_*` (kasıtlı) var.
- [x] Docs'larda eski sır değerleri **redakte edildi** (yalnızca "eski APK içinde" ifadesi kaldı).
- [x] **Süreç olayı (2026-09-27, oturum içi):** sürüm karşılaştırması için `git show` ile eski
      `admin-action` dosyası okunurken **eski (zaten compromised + rotation kapsamında olan) admin
      anahtarı bir kez terminal çıktısına yansıdı**. Değer rapora, docs'a veya Git'e **yazılmadı**;
      etkisi rotation zorunluluğunu artırır (§5) — yeni üretilen secret'lar bu nedenle eski
      anahtar sızıntısından **bağımsız** üretilmeli.
- [ ] Yayın sonrası: CI'ın ürettiği **yeni** APK'da eski admin anahtarı/şifresi arama
      desenlerinin eşleşme sayısının **0** olduğu doğrulanacak (FAZ 12; desenler rapora yazılmaz).

## 4. Veritabanı migration / şema

- [x] (2026-09-27) `001_security_hardening.sql` ↔ `schema.sql` 23 maddelik karşılaştırma: CHECK'ler,
      `neg_*`, unique indeksler, `admin_logs.request_id`, `sync_requests`, GRANT/REVOKE — 2 eksik
      parça `schema.sql`'e eklendi.
      → **2026-09-28 GÜNCELLEME: `001_security_hardening.sql` DEPRECATED.** Canlı denetimde 001'in
      canlı şemada hata verdiği (11 eksik kolon, `team_members` tablosu yok) ve hiçbir şey
      uygulamadan geri döneceği kanıtlandı → **production migration'ı
      `supabase/migrations/002_reconciled_baseline.sql` (FAZ 0-10)**.
      Ayrıntı: `docs/denetim-raporu.md` §8.
- [x] `recovery_hash` için kolon bazlı GRANT doğrulandı: verilen 21 kolon içinde yalnızca `recovery_hash` yok.
- [x] **Canlı marker testi (salt okunur): migration UYGULANMAMIŞ** — `daily_earnings.neg_xp` → 400,
      `admin_logs.request_id` → 400, `sync_requests` → 404 (PostgREST şema önbelleğinde yok),
      `profiles.recovery_hash` anon erişimi → **200 (hâlâ okunabilir)**.
- [!] **Migration içeriği onay ister (002 FAZ 1 + FAZ 5):** 7 clamp `UPDATE` (`… GREATEST`) ve
      2 dedup `DELETE` (`team_members`/`duels` tekrar-çakışan satırları) içerir. Salt-SELECT ile
      ölçüldü: **her ikisi de 0 satır etki**. Yine de uygulama öncesi yedek + kullanıcı onayı şart.
- [!] **CANLI ŞEMA DRIFT'İ (2026-09-28 denetimi):** canlı `profiles` tablosunda GRANT listesindeki
      22 kolondan **11'i eksik** (`name`, `emoji`, `streak`, `xp7d`, `avatar_id`, `frame_id`,
      `last_active`, `vip_until`, `bio`, `photo_url`, `updated_at`) → 001'deki kolon bazlı GRANT
      **çalışmazdı**; ayrıca `teams`/`team_members`/`sync_requests` canlıda **YOK** ve
      `friendships_status_check` `rejected` içeriyor (schema.sql ile drift). **002 bu üçünü de
      kapatır** (FAZ 0 kolonlar, FAZ 4 tablolar, §5/FAZ 9 drift notu). `schema.sql` hedef durum
      (2026-09-28'de canlı denetimle hizalandı); canlı DB daha eski bir şemada.
- [BLOCKED] **Migration uygulanmadı** (yazma credential'ı yok, §0) — blind/force yöntem
      kullanılmadı; hedef proje bu kez doğrulanmış olmakla birlikte uygulama kanalı yok.
- [ ] **Yayın öncesi sırası:** (0) yedek + kullanıcı onayı → (1)
      `supabase/migrations/002_reconciled_baseline.sql` (Dashboard → SQL Editor, tek gönderim;
      başlıktaki PRE-FLIGHT ölçümü değişmişse DUR) → (2) §6 doğrulama.
      **`001_security_hardening.sql` DEPRECATED — production'da çalıştırma.**
- [ ] Yeni kurulumlar için `schema.sql` tek kaynak olarak çalıştırılacak.

## 5. Secrets ve sırrı çevirme (rotation) — [BLOCKED]

> **Durum: [BLOCKED]** — yazma credential'ı yok (§0: `SUPABASE_ACCESS_TOKEN`/Dashboard).
> Sıra asla bozulmadı: **yeni secret doğrulanmadan eski secret iptal edilmedi**.
> Değerler hiçbir yere yazılmaz. **Aciliyet arttı:** canlıda ESKİ `admin-action` çalışıyor ve
> eski kod `ADMIN_KEY`'i hem env'den hem **gömülü fallback'ten** alıyor → eski (compromised)
> anahtar production'da hâlâ geçerli olabilir; `login` rate limiti de yok (6 deneme → 429 yok).

Sıra (`docs/guvenlik-ve-dagitim.md` §3):

- [BLOCKED] 0) Hedef proje erişimi (§0) — önce bu.
- [ ] 1) Yeni yönetici şifresi + `ADMIN_TOKEN_SECRET` üret (`node -e "…randomBytes(32)…"`).
- [ ] 2) `ADMIN_PASSWORD_HASH` güncelle (istemci `hashPassword` ile üretilir).
- [ ] 3) `ADMIN_KEY` **unset et** (eski APK'daki anahtar geçersizleşir).
- [ ] 4) Uygulamadaki yönetici şifresini yenile.
- [ ] 5) Doğrulama: eski şifreyle login → `403`; yeni şifreyle → token; token'suz `adjust` → `403`.
- [ ] 6) Şüpheli geçmiş için `admin_logs` denetimi.
- [ ] 7) Yeni APK'yi `releases/latest` üzerinden yayınla; **eski APK kurulumlarını** kaldır/tavsiye et.

## 6. Dağıtım sırası ve doğrulama

Sıra: **1) Migration → 2) Edge Functions deploy → 3) Secrets → 4) Doğrulama** (`docs/guvenlik-ve-dagitim.md`).

> **Durum: [BLOCKED]** (§0: yazma credential'ı yok). Salt-okunur probe ile gerçek durum ölçüldü:
> **7/7 fonksiyon zaten deploy edilmiş ama TAMAMI ESKİ (sertleştirilmemiş) sürüm.**

- [x] **Canlı sürüm probe'u (yazma yapmayan, tek isteklik ayırıcılar):** `sync-profile`
      (`invalid_delta` = eski), `sync-quest` (`invalid_quest` = eski), `chat-action`
      (`unknown_action` = eski), `duel-action` (`invalid_action` = eski) → **4/7 kesin ESKİ**;
      `admin-action` 6× login denemesinde hiç 429 yok + 503 yok → **eski sürümle uyumlu**;
      `recovery-action` 21 deneme IP limiti tetiklemedi → **eski sürümle uyumlu**;
      `vip-action` → 500 `profile_lookup_failed` (canlı DB'de `vip_until` kolonu yok → yeni kod
      olsa idi 400 `username_required` dönerdi) → **ESKİ**.
- [x] Tüm fonksiyonların ihtiyaç duyduğu tablolar canlıda var görünüyor: `quest_claims`,
      `pomodoro_rooms`, `pomodoro_room_members`, `daily_earnings`, `duels`, `chat_messages`,
      `friendships`, `admin_logs`, `profiles` (anon 200/erişim).
- [x] Statik kod incelemesi 7/7 tamam (authz, validasyon, hız sınırı, atomik geçiş, idempotency,
      hata yönetimi — §2). `deno check` **çalıştırılamadı** (Deno kurulu değil) → Node `tsc`
      yalnızca semantik bağlamda `npm:`/`Deno` hataları verdi (ortam kısıtı, kod hatası değil);
      `sync-profile:340` üzerinde `updateFields.bio` tip hatası not edildi (runtime'da zararsız,
      `deno check` ile doğrulanmalı).
- [BLOCKED] 1) Migration (§4). **2) 7 fonksiyonun YENİ sürümle deploy edilmesi gerek**
      (`admin-action`, `sync-profile`, `sync-quest`, `duel-action`, `vip-action`,
      `recovery-action`, `chat-action`); **"Verify JWT" KAPALI** kalacak (korumada fonksiyon içi
      doğrulama + hız sınırı; bilinçli karar, §9/2). **Yazma kanalı yok → 0/7 güncellendi.**
- [BLOCKED] 3) Secrets (§5).
- [BLOCKED] 4) Doğrulama listesi: `guvenlik-ve-dagitim.md` §4 (login 403/200, `recovery_hash` anon
      hata, `neg_xp` kolonu, index adları).
- [ ] CI Artifact'inden release APK/AAB indirilip cihaza kurulacak (`docs/manual-smoke-test.md`).

## 7. Test ve tip denetimi (FAZ 8 — HEAD üzerinde yeniden çalıştırıldı; 4. koşu 2026-09-27)

- [x] `npx jest --runInBand` → **65/65 PASS** (2 suite: `tests/unit/logic.test.js`, `tests/unit/syncQueue.test.js`) — release öncesi **4. koşu**, aynı sonuç; testler değiştirilmedi/zayıflatılmadı.
- [x] `npx tsc --noEmit` → **0 hata**.
- [x] `npx expo export --platform android` → **EXIT 0**, Hermes bundle **4.52 MB**
      (`dist/_expo/static/js/android/index-68fcde091bab321b0fb0dc5de2ab0b81.hbc`, 38 dosya; `dist/` ignore içinde).
- [x] **Yeni bundle secret scan (FAZ 8):** `service_role`/JWT/private key/eski admin
      anahtar-şifre desenleri/`ADMIN_TOKEN_SECRET`/`ADMIN_PASSWORD_HASH` atamalarının tamamı
      **NOT FOUND**; yalnızca kasıtlı `sb_publishable_` (1 eşleşme, secret değil).
- [x] Kırık import yok (widget'lar `.jsx` olarak çözülüyor); silinen dosyalara referans yok (`api.js`, `syncService.js` gölgesi, `config/admin.js` hâlâ mevcut değil); `react-native-url-polyfill/auto` mevcut.
- [x] Coverage toplama yapılandırması `jest.config.js`'te (`logic.js`, `syncService.ts`, `profileService.js`, `serverClock.js`).
- [!] Repo'da **lint aracı yok** (eslint config/scripts yok). Yayın blokeri değil; ekleme ayrı karardır.
- [ ] CI'da `npx jest --ci` + `npx tsc --noEmit` yeşil (push sonrası — §0 nedeniyle henüz koşmadı).

## 8. Senkron / senaryo durumu

- [x] Statik doğrulama: `runSync` erken dönüş + `bannedDuringDrain`/`earningsPushed`; `pendingId` yaşam döngüsü; `activeAccountRef` guard (`publishProfile` + `refreshServerMeta`); kuyruk **hesap bazlı** anahtar (`@sync_engine:mutation_queue:<hesap>`); hesap değişince köprü+önbellek sıfırlanıp kendi deposundan yeniden yüklenir; widget görev kuyruğu yazılıyor **ve** tüketiliyor (`drainWidgetTasks`).
- [x] **Canlı güvenli testler (FAZ 7, 2026-09-27 — yazma/temizlik gerektirmeyenler):**
  - [x] Yetkisiz admin isteği → **403 PASS**; geçersiz `x-admin-token` → **403 PASS**.
  - [x] Anon ile negatif XP `INSERT` denemesi → **401 RLS PASS** (satır oluşturulmadı).
  - [x] Anon `UPDATE` (imkânsız filtre = 0 satır) → 204: anon UPDATE **grant'ı hâlâ açık**;
        002 FAZ 7'nin `REVOKE`'u kapatacak (gerçek satıra erişim RLS ile zaten engelli).
  - [x] `recovery_hash` anon okuma → **200 FAIL (açık)** → 002 FAZ 7 ile kapanacak.
  - [x] Recovery 21 deneme → **429 yok FAIL** (eski koddaki IP limiti yok; yeni kod 20/dk koyar).
  - [x] Admin login 6 deneme → **429 yok FAIL** (eski kodda login rate limiti yok; yeni kod 5/dk).
- [NOT EXECUTED] **Yeni kodun gerektirdiği canlı testler** (expired/çalıştırılmış token, negatif
      XP/gold fonksiyon testi, günlük negatif tavan, quest çift alım, duel çift finish, VIP
      affected-row, sync idempotency, requestId replay, chat/duel/vip rate limit): **önce §6 deploy
      gerekiyor** (canlıda eski kod var) + bir kısmı üretim verisine yazma gerektirir →
      uydurma PASS verilmedi, çalıştırılmadı.
- [x] Bu oturumda üretim veritabanına **hiçbir satır yazılmadı/silinmedi** (probeler doğrulama
      öncesi reddedilen/0-etreli yollarda kaldı; geçici test verisi gerekmedi).

## 9. Bilinen sınırlılıklar / kabul edilen riskler

1. Supabase **Auth yok** → kimlik kullanıcı adı beyanı; koruma: hız sınırları, günlük tavanlar, atomik geçişler, idempotency. (Tam göç ayrı proje.)
2. **Verify JWT kapalı** (7 fonksiyon) → uçlar açık; koruma fonksiyon içinde. Ağ geçidinde oran sınırı önerilir.
3. Hız sınırı sayaçları **bellek içi/instance** → soğuk start'ta sıfırlanır; IP `x-forwarded-for`'dan gelir (ağ geçidi XFF'i ezerse güvenilir).
4. `friendships`/`teams`/`team_members` **anon yazma** açık (kimlik modeli gereği) → üçüncü taraf veriye yazabilir; günlük tavanlar ekonomiyi korur.
5. Negatif delta kıstırması günlük biriktirir → çok büyük düşüşler (yedek geri yükleme) sunucuda tam yansımayabilir.
6. `recovery_hash` karşılaştırması sabit-zamanlı değil → yüksek entropili anahtar olduğu için pratik risk düşük (bilgi amaçlı).
7. **Repo git geçmişinde + GitHub Releases'te eski APK'lar** sırları taşır → rotation olmadan kapatılamaz (§5).
8. **Hedef Supabase projesi bu ortamdan doğrulanamadı** (ref NXDOMAIN, CLI/oturum yok) →
   migration/deploy/rotation/canlı testler çalıştırılmadı; Edge Functions **local deploy yok**
   (Deno servisine erişim yok) → fonksiyonlar yalnızca kod/analiz düzeyinde denetlendi.
9. **Component/Context/E2E test yok** (React Testing Library/Detox kurulmadı) + **cihaz testleri
   yok** (A–M `[ ]`).
10. **CI henüz koşmadı** (push gate kapalı) → release APK/AAB artifact'i üretilmedi.

## 10. Derleme / artifact

- [x] Yerel `npx expo export --platform android` başarılı → Hermes **4.52 MB** (`dist/`).
- [x] CI tasarımı: JDK 17 + Android SDK + keystore (repo **dışı** `ANDROID_KEYSTORE_*` Secrets) ile `assembleRelease` + `bundleRelease`; `versionCode` = run_number; önce jest+tsc.
- [ ] **CI koşumu (FAZ 11/12): [NOT EXECUTED]** — push gate kapalı (§0) → Actions tetiklenmedi,
      APK/AAB artifact'i üretilmedi. Yeni APK'nın içeriği bu yüzden doğrulanamadı
      (yerel `dist` bundle temizdir, §3).
- [ ] **Yerel APK mümkün değil:** bu makinede Android SDK yok (`ANDROID_HOME` boş). APK yalnızca CI/EAS ile üretilecek → Actions artifact'i `HabitTracker-App-Release` (APK+AAB).
- [ ] Play Store için `ANDROID_KEYSTORE_*` Secrets tanımlı olmalı (yoksa CI debug imzasıyla derler ve uyarır).

## 11. Cihaz manuel testi (FAZ 14)

- [ ] `docs/manual-smoke-test.md` A–M senaryolarının tamamı **cihazda** çalıştırılacak; sonuç
      kolonu doldurulacak. Bu ortamda cihaz erişimi **yok** → **hiçbiri PASS yapılmadı**
      (otomatik test olarak sunulmadı).

## 12. Eski APK kontrolü (FAZ 13) + yayın öncesi kararlar

- [x] **Tespit:** repo kökündeki `HabitTracker.apk` (90.6 MB, binary) eski admin sırlarını içeriyor →
      **compromised artifact** (§3).
- [x] **GitHub Releases (public API, salt okunur) ölçüldü:** yayında **10 release** var;
      en yenisi `build-20` → `HabitTracker.apk` (90.6 MB, **7 indirme**) + `app-release.aab`;
      `build-17` 6, `build-20` … `build-13` arası tüm release'ler `HabitTracker.apk` dağıtıyor
      (toplam ölçünen indirmeler: 20+). Yani **eski (büyük ihtimalle compromised) APK aktif
      olarak dağıtılıyor**.
- [BLOCKED] **Kaldırma/revocation:** `gh` oturumu yok + `GITHUB_TOKEN` tanımlı değil → GitHub
      Release asset'leri **ben kaldır/amadım**. Otomatik yapılmış gibi raporlanmadı.
- [ ] **Manuel aksiyon (kullanıcı):** GitHub → Releases → eski `HabitTracker.apk`/ilgili release'ler
      sil veya "revoked/deprecated" notu ekle; dağıtım linkini yeni build'e yönlendir.
- [ ] `HabitTracker.apk`'nin repodan çıkarılması + CI'ın commit adımının yeniden düşünülmesi
      (şu an CI her derlemede APK'yı geri itiyor; git geçmişindeki sırlar ancak rotation ile
      anlamsızlaşır).
- [ ] **Rotation** onayı (§5) — yazma kanalı açılır açılmaz (eski anahtar canlı kodda + APK'da +
      git geçmişinde → **acil**).
- [ ] Yayında kalacak eski sürümler: kullanıcıların yeni APK'ya güncellenmesi (eski APK'lar sırları taşır).

## 13. Yayın sonrası izleme

- [ ] İlk gün: `admin_logs` + `sync_requests` büyüklüğü (`SELECT count(*) FROM sync_requests;` → temizlenmeli: periyodik cleanup kodda var).
- [ ] 429/409/403 oranları (fonksiyon logları) → hız sınırı ayarları gerekebilir.
- [ ] Destek kanalı: `admin_not_configured` gelirse Secrets eksik (§5/§6).
- [ ] README/Play Store sürüm notu: güvenlik güncellemesi + sırrı yenileme hatırlatması.
