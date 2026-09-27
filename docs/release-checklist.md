# Yayın Hazırlık Kontrol Listesi (Release Candidate)

> **Durum işareti:** `[x]` = bu denetimde YERELDE doğrulandı (kod/test/analysis) · `[ ]` = yayın
> öncesi yapılmalı (Supabase/CI/cihaz erişimi gerekir) · `[!]` = bilinen açık/karar, kapatılmalı
> veya açıkça kabul edilmeli.
>
> Denetim tarihi: 2026-09-27 · Dal: `main` · Detay: `docs/denetim-raporu.md`,
> `docs/guvenlik-ve-dagitim.md`, `docs/manual-smoke-test.md`

---

## 1. Depo durumu

- [x] `git status` görüldü; çalışılmış tüm iş bu kontrol listesiyle birlikte kategori bazlı commit edilecek.
- [x] Dal tek (`main`) + `origin/main` var; stash yok; çalışma dışı kişisel klasör (`memory/`) commit edilmez.
- [x] CI (`.github/workflows/build-apk.yml`) `npm ci` → **`npx jest --ci`** → **`npx tsc --noEmit`** → prebuild → release APK/AAB akışını içeriyor (hatalı kod APK'ye ulaşmadan düşer).
- [ ] Push sonrası CI'ın yeşil olduğu görülecek (Actions sekmesi).
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

## 3. Gizli değer taraması (repo geneli)

- [x] Kaynak/config/doc dosyalarında: `service_role` değeri yok, JWT/anon anahtar değeri yok (yalnızca `Deno.env.get(...)`), AWS/GitHub/Slack anahtarı yok, özel anahtar dosyası yok.
- [x] `sb_publishable_*` yalnızca `src/config/supabase.js` içinde — bu **yayınlanabilir (publishable) anahtardır**, kasıtlı; koruma RLS'te.
- [x] Docs'larda eski sır değerleri **redakte edildi** (yalnızca "eski APK içinde" ifadesi kaldı).
- [x] `HabitTracker.apk` (binary) eski admin sırlarını **içeriyor** → değerler burada yaşar; rotation zorunlu (§5). Değerler belge/raporlarda **yazılmaz**.
- [ ] Yayın sonrası: yeni APK ile `strings HabitTracker.apk | grep -c 'ht-admin'` → **0** olmalı.

## 4. Veritabanı migration / şema

- [x] `001_security_hardening.sql` idempotent ve `schema.sql` ile **birebir eşit** (22 maddelik karşılaştırma: CHECK'ler, `neg_*`, unique indeksler, `admin_logs.request_id`, `sync_requests`, GRANT/REVOKE) — bu denetimde 2 eksik parça `schema.sql`'e eklendi.
- [x] `recovery_hash` için kolon bazlı GRANT doğrulandı: verilen 21 kolon içinde yalnızca `recovery_hash` yok.
- [ ] **Yayın öncesi (Dashboard → SQL Editor):** `001_security_hardening.sql` çalıştırılacak → sonra §6 doğrulama SQL'leri.
- [ ] Yeni kurulumlar için `schema.sql` tek kaynak olarak çalıştırılacak.

## 5. Secrets ve sırrı çevirme (rotation) — YAYIN BLOKERI

Sıra (`docs/guvenlik-ve-dagitim.md` §3), değerler **hiçbir yere yazılmaz**:

- [ ] 1) Yeni yönetici şifresi + `ADMIN_TOKEN_SECRET` üret (`node -e "…randomBytes(32)…"`).
- [ ] 2) `ADMIN_PASSWORD_HASH` güncelle (istemci `hashPassword` ile üretilir).
- [ ] 3) `ADMIN_KEY` **unset et** (eski APK'daki anahtar geçersizleşir).
- [ ] 4) Uygulamadaki yönetici şifresini yenile.
- [ ] 5) Doğrulama: eski şifreyle login → `403`; yeni şifreyle → token; token'suz `adjust` → `403`.
- [ ] 6) Şüpheli geçmiş için `admin_logs` denetimi.
- [ ] 7) Yeni APK'yi `releases/latest` üzerinden yayınla; **eski APK kurulumlarını** kaldır/tavsiye et.

## 6. Dağıtım sırası ve doğrulama

Sıra: **1) Migration → 2) Edge Functions deploy → 3) Secrets → 4) Doğrulama** (`docs/guvenlik-ve-dagitim.md`).

- [ ] 1) Migration (§4).
- [ ] 2) 7 fonksiyon deploy (`admin-action`, `sync-profile`, `sync-quest`, `duel-action`, `vip-action`, `recovery-action`, `chat-action`); **"Verify JWT" KAPALI** kalacak (korumada fonksiyon içi doğrulama + hız sınırı; bilinçli karar, §7/2).
- [ ] 3) Secrets (§5).
- [ ] 4) Doğrulama listesi: `guvenlik-ve-dagitim.md` §4 (login 403/200, `recovery_hash` anon hata, `neg_xp` kolonu, index adları).
- [ ] CI Artifact'inden release APK/AAB indirilip cihaza kurulacak (`docs/manual-smoke-test.md`).

## 7. Test ve tip denetimi (bu denetimde çalıştırıldı)

- [x] `npx jest --runInBand` → **65/65 PASS** (2 suite: `tests/unit/logic.test.js`, `tests/unit/syncQueue.test.js`) — denetim sırasında **2 kez** (değişiklik öncesi/sonrası) aynı sonuç.
- [x] `npx tsc --noEmit` → **0 hata** (değişiklik sonrası tekrar).
- [x] `npx expo export --platform android` → **EXIT 0**, Hermes bundle 4.7 MB (`dist/`, `.gitignore` içinde).
- [x] Kırık import yok (widget'lar `.jsx` olarak çözülüyor); silinen dosyalara referans yok (`api.js`, `syncService.js` gölgesi, `config/admin.js`).
- [x] Coverage toplama yapılandırması `jest.config.js`'te (`logic.js`, `syncService.ts`, `profileService.js`, `serverClock.js`).
- [!] Repo'da **lint aracı yok** (eslint config/scripts yok). Yayın blokeri değil; ekleme ayrı karardır.
- [ ] CI'da `npx jest --ci` + `npx tsc --noEmit` yeşil (push sonrası).

## 8. Senkron / senaryo durumu

- [x] Statik doğrulama: `runSync` erken dönüş + `bannedDuringDrain`/`earningsPushed`; `pendingId` yaşam döngüsü; `activeAccountRef` guard (`publishProfile` + `refreshServerMeta`); kuyruk **hesap bazlı** anahtar (`@sync_engine:mutation_queue:<hesap>`); hesap değişince köprü+önbellek sıfırlanıp kendi deposundan yeniden yüklenir; widget görev kuyruğu yazılıyor **ve** tüketiliyor (`drainWidgetTasks`).
- [ ] Cihaz senaryoları (A–L): **hepsi `docs/manual-smoke-test.md` içinde `[ ]`** — bu ortamda cihaz/sunucu erişimi yok, PASS olarak işaretlenmedi.

## 9. Bilinen sınırlılıklar / kabul edilen riskler

1. Supabase **Auth yok** → kimlik kullanıcı adı beyanı; koruma: hız sınırları, günlük tavanlar, atomik geçişler, idempotency. (Tam göç ayrı proje.)
2. **Verify JWT kapalı** (7 fonksiyon) → uçlar açık; koruma fonksiyon içinde. Ağ geçidinde oran sınırı önerilir.
3. Hız sınırı sayaçları **bellek içi/instance** → soğuk start'ta sıfırlanır; IP `x-forwarded-for`'dan gelir (ağ geçidi XFF'i ezerse güvenilir).
4. `friendships`/`teams`/`team_members` **anon yazma** açık (kimlik modeli gereği) → üçüncü taraf veriye yazabilir; günlük tavanlar ekonomiyi korur.
5. Negatif delta kıstırması günlük biriktirir → çok büyük düşüşler (yedek geri yükleme) sunucuda tam yansımayabilir.
6. `recovery_hash` karşılaştırması sabit-zamanlı değil → yüksek entropili anahtar olduğu için pratik risk düşük (bilgi amaçlı).
7. **Repo git geçmişinde + GitHub Releases'te eski APK'lar** sırları taşır → rotation olmadan kapatılamaz (§5).

## 10. Derleme / artifact

- [x] Yerel `npx expo export --platform android` başarılı (`dist/`).
- [x] CI: JDK 17 + Android SDK + keystore (repo **dışı** `ANDROID_KEYSTORE_*` Secrets) ile `assembleRelease` + `bundleRelease`; `versionCode` = run_number.
- [ ] **Yerel APK mümkün değil:** bu makinede Android SDK yok (`ANDROID_HOME` boş). APK yalnızca CI/EAS ile üretilecek → Actions artifact'i `HabitTracker-App-Release` (APK+AAB).
- [ ] Play Store için `ANDROID_KEYSTORE_*` Secrets tanımlı olmalı (yoksa CI debug imzasıyla derler ve uyarır).

## 11. Cihaz manuel testi

- [ ] `docs/manual-smoke-test.md` içindeki senaryolar cihazda **tek tek** çalıştırılacak; sonuç kolonu doldurulacak (hiçbiri şimdi PASS sayılmadı).

## 12. Yayın öncesi son 3 karar (onay bekleyen)

- [ ] **Rotation** yapılacak mı? (Yapılmazsa: eski APK'daki sırlarla `ADMIN_KEY` tanımlysa admin işlemi, tanımlı değilse yine de eski şifre hash'i koddan silindiği için login mümkün değil — yine de `ADMIN_KEY` unset **zorunlu**.)
- [ ] `HabitTracker.apk` repodan çıkarılacak mı? (Güvenli taraf: evet; ama CI her derlemede geri koyuyor → CI'ın commit adımının yeniden düşünülmesi gerekir.)
- [ ] Yayında kalacak eski sürümler: kullanıcılar yeni APK'ya güncellenecek mi? (Eski APK'lar sırları taşır.)

## 13. Yayın sonrası izleme

- [ ] İlk gün: `admin_logs` + `sync_requests` büyüklüğü (`SELECT count(*) FROM sync_requests;` → temizlenmeli: periyodik cleanup kodda var).
- [ ] 429/409/403 oranları (fonksiyon logları) → hız sınırı ayarları gerekebilir.
- [ ] Destek kanalı: `admin_not_configured` gelirse Secrets eksik (§5/§6).
- [ ] README/Play Store sürüm notu: güvenlik güncellemesi + sırrı yenileme hatırlatması.
