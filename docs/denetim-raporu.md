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
- **Dağıtım sırası (zorunlu)**: ① `001_security_hardening.sql` → ② 7 Edge Function yeniden deploy (Verify JWT kapalı) → ③ Secrets (`ADMIN_TOKEN_SECRET`, `ADMIN_PASSWORD_HASH`, `ADMIN_KEY` kaldır) → ④ kılavuzdaki doğrulama listesi. Ayrıntı: `docs/guvenlik-ve-dagitim.md`.

## 7. Sınırlılıklar ve sonraki adımlar

1. **Supabase Auth yok** — kimlik hâlâ kullanıcı adı beyanı; tüm koruma fonksiyon içi tavan/atomiklik/idempotency ile kuruldu. Tam geçiş (email+password, `auth_user_id`, tüm uçlarda JWT doğrulama) ayrı bir göç projesidir; kullanıcı verisi etkilediği için bu oturumda bilinçli olarak yapılmadı.
2. **Verify JWT kapalı** — uçlar kamuya açık; oran sınırı için ağ geçidi katmanı önerilir.
3. **Hız sınırları bellek içi/instance başına** — soğuk start'ta sıfırlanır.
4. **Negatif tavan kasıtlı** — yedekten çok büyük XP düşüşü sunucuya tam yansımayabilir (cihaz yerel değeri korur).
5. Bileşen/E2E testi, ESLint ve `pullDeltaProfiles`/`localWins` gibi henüz çağrılmayan yardımcılar için net karar (bağla veya sil) sonraki iş kalemidir.
6. Edge Functions yerelde çalıştırılıp **deploy edilemedi** — canlı doğrulama dağıtımdan sonra yapılmalıdır.
