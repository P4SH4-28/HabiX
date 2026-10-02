# 🎯 HabiX

**Oyunlaştırılmış alışkanlık takibi** — alışkanlıklarını takip et, XP kazan,
seviye atla, görevleri tamamla ve arkadaşlarınla yarış.

![Expo](https://img.shields.io/badge/Expo-57-black) ![React Native](https://img.shields.io/badge/React%20Native-0.86-blue) ![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Edge%20Functions-green) ![Sürüm](https://img.shields.io/badge/s%C3%BCr%C3%BCm-2.0.0-7C5CFF)

## ✨ Özellikler

| | |
|---|---|
| 🏃 **Alışkanlık takibi** | Günlük alışkanlıklar, ikon + renk seçimi, kaçırılan görevlerde altın cezası; boş ekranda 1 dokunuşla "Hızlı başlangıç" önerileri |
| 🔥 **Seri ödülleri** | 3/7/14/30/60 günlük serilerde bonus XP + altın (eşik başına bir kez) + 🎊 mini-konfeti patlaması |
| 🎉 **Kutlama deneyimi** | Seviye atlayınca gerçek konfeti + altın puls modal + success haptiği; alışkanlık tamamlamada ✓ daire spring "bonk" + renkli glow |
| ⚡ **XP & Seviye** | Tamamlanan her görev XP kazandırır; seviye atlayınca kutlama modalı |
| 🪙 **Altın ekonomisi** | Görev 5 🪙, pomodoro 15 🪙; cezalar 15 🪙 |
| 📋 **Görev Panosu** | 60 görevlik katalog, 4 zorluk (30dk – 2sa), otomatik + manuel görevler, bekleme süreleri |
| 🛍️ **Dükkan** | Sekmeli yapı (Eşyalar/Avatarlar/Çerçeveler/Temalar), tema kartına dokununca **canlı mini önizleme**, sahip olduklarında ✓ rozeti, satın alımda toast + haptic |
| 🏆 **Liderlik** | Seviye 5'te açılır; arkadaşlar + kendin, 7 günlük XP trendi, şüpheli kullanıcı rozeti |
| 👥 **Arkadaşlar** | Kullanıcı adıyla arama, istek gönder/kabul et/reddet |
| 💬 **Sosyal sekmesi** | 3 bölüm: **Arkadaşlar** · **Canlı Odalar** (oda kur/katıl/ayrıl, realtime) · **Sohbet** (gerçek zamanlı mesajlaşma) |
| ⚔️ **Düello** | 7 günlük XP yarışı: davet → kabul → canlı skor çubuğu → kazanan +100 XP / +50 🪙 (DuelScreen) |
| 🍅 **Pomodoro** | 15 / 25 / 45 dk süre seçici; uygulama kapansa bile süre doğru işler; tamamlama ödülü |
| 🎖️ **Başarımlar** | **14 rozet**; kilidi açılanlar bildirim toast'u ile bildirilir |
| 🎒 **Envanter & Eşyalar** | Seri Dondurucu, Ceza Kalkanı, 2x XP Enerjisi — altınla alınır, etkileri sunucu gününe bağlı |
| 🏅 **Haftalık Ligler** | 7 günlük XP'ye göre Bronz → Elmas, hafta sonu altın ödülü |
| 🎫 **Season Pass** | **50 tier** sezon geçişi, Free/VIP; tier başına ödül kutusu ve VIP avantajları |
| 👥 **Takımlar (Kulüpler)** | Takım kur/katıl, ortak 1000 XP haftalık hedefi, üye sıralaması |
| 📷 **Profil** | Bio + profil fotoğrafı (Supabase Storage), istatistik özet kartı (seviye barı, aktif alışkanlık, odak seansı, başarımlar) |
| 📊 **Gelişim ekranı** | Isı haritası + çubuk grafikler **animasyonlu** (kademeli beliriş, yaylanan çubuklar, sayaçlar); bugün hücresi nabız atar |
| 🧩 **Android Widget** | Ana ekranda bugünün alışkanlıkları, seriler ve altın — canlı güncelleme |
| 🔔 **OS Bildirimleri** | Ayarlanan saatte uygulama KAPALIYKEN bile gerçek hatırlatma + saatlik motivasyon; akşam bildirimi kalan görev sayısına göre üretilir ("X kaldı" / "tamamladın 🎉") |
| 🔑 **Şifre kurtarma** | Kayıtta üretilen kurtarma anahtarıyla şifre sıfırlama (cihaz değişse bile) |
| 👋 **İlk açılış rehberi** | Yeni kullanıcıya 3 sayfalık tanıtım |
| 💾 **Yedek & Senkron** | Cihaz içi yedek + Supabase bulut senkronu (cihaz değişince devam et) |

## 🎨 Tasarım Sistemi v2

Uygulama genelinde tek bir tasarım dili (Apple × Linear karışımı). Tüm ekranlar
`src/theme/` içindeki token'lardan beslenir.

| Token | Ölçek | Kural |
|---|---|---|
| **Tipografi** | 5 boyut + `displayXl` (hero sayı) | Ağırlık yalnız 400 / 600 / 700 |
| **Radius** | `sm 8` · `md 12` · `lg 16` · `xl 20` · `full` | Daire/rozet/çip = `full` |
| **Boşluk** | 4'lü ölçek | Sayfa kenar boşluğu her ekranda **20** |
| **Hareket** | `fast 150` · `normal 200` · `slow 300` | **300ms üstü yok**, sonsuz döngü yok |
| **Renk** | 12 tema | Her kombinasyon **WCAG AA** (≥4.5:1) doğrulanmış |

- **Etkileşim:** `PressableFX` — basınca ölçek + cihazda haptik "tap"
- **Boş/hata durumu:** her ekranda `EmptyState` / `ErrorState` primitive'i
- **Hareket azaltma:** sistem tercihi açıksa animasyonlar kapanır (`useReducedMotion`)
- **Erişilebilirlik:** dokunma hedefleri ≥44×44, başlıklar `header` rolü,
  ikon butonlarında `accessibilityLabel`, durum sadece renkle değil
- **Performans:** `FlatList` pencereleme + sabit `renderItem` referansları

Ayrıntılı kontrol listesi: **`docs/ui-test-checklist.md`** · sürüm geçmişi: **`CHANGELOG.md`**

## 🛡️ Anti-Farm Mimarisi (5 Katman)

Oyun ekonomisini korumak için çok katmanlı bir savunma kuruldu:

1. **Katman 1 — İstemci tavanı:** Günlük en fazla 500 XP / 150 🪙 (geri alma tavanı yeniden açar)
2. **Katman 2 — Sunucu saati:** Tüm yanıtlardan sunucu saati okunur; cihaz saati oynatılamaz
3. **Katman 3 — Sunucu doğrulaması:** `sync-profile` edge function'ı yalnızca **delta** kabul eder, `daily_earnings` defteri üzerinden tavanı sunucuda kıstırır; RLS ile doğrudan tabloya yazım engellenir; 10 sn rate limit
4. **Katman 4 — Tespit & görünürlük:** Saat oynatan veya tavan aşan hesap `⚠️ ŞÜPHELİ` rozetiyle liderlikte herkese görünür
5. **Katman 5 — Yönetici Paneli:** `P4SH4` hesabıyla kullanıcı ara, **banla/unbanla**, XP/altın cezası veya ödülü ver, tema/avatar/çerçeve **hediye et**, bayrak kaldır; tüm işlemler denetim günlüğünde

## 🧰 Teknolojiler

- **Expo SDK 57 / React Native 0.86** — mobil uygulama
- **Supabase** — PostgreSQL (RLS + servis rolü) + Edge Functions (Deno)
- **React Navigation** — alt sekmeli navigasyon
- **AsyncStorage** — yerel veri + oturum kalıcılığı
- **expo-haptics** — dokunsal geri bildirim (apan/ödül haptikleri)
- **GitHub Actions** — otomatik APK derleme

## 🚀 Kurulum

```bash
git clone https://github.com/P4SH4-28/HabiX.git
cd HabiX
npm install

npm start                  # QR ile Expo Go'da aç
npm run android            # native Android (build + kur)
npm run web                # tarayıcıda test
```

> **Sürüm 2.0.0** · Expo SDK 57 · React Native 0.86 · Node 20+
>
> `npm install` sonrası `postinstall` otomatik olarak `patch-package` çalıştırır
> (`react-native-reanimated` patch'ı uygulanır). Bu adım atlanırsa uygulama
> animasyonlarda "tag not found" hatası verir.

## 📱 APK Derleme

`main` dalına **kod değişikliği** içeren her push, GitHub Actions'ı tetikler
(`.md` / `docs/` / APK değişiklikleri tetiklemez):

1. Actions otomatik olarak **jest + tsc** çalıştırır — hatalı kod APK'ya ulaşamaz
2. `expo prebuild` → Gradle ile APK + AAB derlenir
3. `build-<run_number>` etiketiyle GitHub Release oluşturulur (APK + AAB eklenir)
4. APK ayrıca depo köküne geri yüklenir (`HabitTracker.apk`)

Elle APK indirmek istersen:

1. GitHub → **Actions** → **Android APK Build** → bitmesini bekle (~15-20 dk)
2. **HabitTracker-App-Release** artifact'ını indir (`app-release.apk` + `app-release.aab`)
3. `app-release.apk`'yı telefona kur (Bilinmeyen kaynaklara izin ver)

Sabit indirme linkleri (her build'de güncellenir):

- **APK** (telefon kurulumu): `https://github.com/P4SH4-28/HabitTracker/releases/latest/download/HabitTracker.apk`
- **AAB** (Play Store): `https://github.com/P4SH4-28/HabitTracker/releases/latest/download/app-release.aab`
- Depo dosya listesindeki `HabitTracker.apk` da doğrudan indirilebilir.

Manuel derleme için: `.github/workflows/build-apk.yml` → **Run workflow**.

## 🚀 Play Store Yayını

Play Store'a çıkmak için adım adım rehber: **`docs/PLAYSTORE-YAYIN.md`**

Özet: keystore zaten üretildi (`HabitTracker-keystore` klasörü, depo DIŞINDA). CI'ya imza
için 4 GitHub secret'ı eklemen yeterli:

| Secret adı | Değer |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | keystore dosyasının base64'ü |
| `ANDROID_KEYSTORE_PASSWORD` | keystore şifresi |
| `ANDROID_KEY_PASSWORD` | anahtar şifresi |
| `ANDROID_KEY_ALIAS` | `habit-tracker` |

> ⚠️ Keystore dosyasını ve şifreleri **asla** depoya atma; kaybedersen Play Store'da
> uygulama güncellenemez. Çoklu kopya al ve güvenli yerde sakla.

## 🗄️ Supabase Kurulumu

1. `supabase/schema.sql` → SQL Editor → **Run** (tek parça şema: profil tabanı, günlük kazanç defteri, görev alımları, arkadaşlıklar, düellolar, sohbet, canlı pomodoro odaları, takımlar, RLS + realtime — idempotent)
2. `supabase/functions/*` içindeki **7 Edge Function'ı Verify JWT KAPALI** olarak deploy et:

| Fonksiyon | Dosya | Görevi |
|---|---|---|
| `sync-profile` | `supabase/functions/sync-profile/index.ts` | Delta senkron + günlük tavan (Katman 3) |
| `sync-quest` | `supabase/functions/sync-quest/index.ts` | Günlük görev ödülü doğrulama |
| `admin-action` | `supabase/functions/admin-action/index.ts` | Yönetici paneli (ban/ödül/hediye) |
| `recovery-action` | `supabase/functions/recovery-action/index.ts` | Şifre kurtarma |
| `duel-action` | `supabase/functions/duel-action/index.ts` | Arkadaş düellosu |
| `chat-action` | `supabase/functions/chat-action/index.ts` | Sohbet + canlı pomodoro odaları |
| `vip-action` | `supabase/functions/vip-action/index.ts` | Season Pass VIP satın alma |

3. `src/config/supabase.js` içindeki proje URL + anon anahtarını kendi projenle değiştir

> ⚠️ `src/config/admin.js`'deki `ADMIN_KEY`, `admin-action` fonksiyonundaki anahtarla aynı olmalı.

## 🧪 Testler

Edge function karar mantıkları (tavan, saat koruması, ban, hediye) yerel simülasyonlarla doğrulanır — gerçek bir test veritabanı gerektirmez.

```bash
npm test          # jest — 65 unit test (logic + senkron kuyruğu)
npm run typecheck # tsc --noEmit
```

**Cihazda elle test için:**

| Belge | Kapsam |
|---|---|
| `docs/ui-test-checklist.md` | 18 ekranın arayüzü: boş durum, klavye, swipe, animasyon, hata, performans, erişilebilirlik |
| `docs/manual-smoke-test.md` | Sunucu/veri katmanı: senkron, ekonomi tavanları, güvenlik, CI, APK |
| `docs/release-checklist.md` | Yayın öncesi son kontrol listesi |

## 🔐 Hesap Sistemi

- Kimlik, **kullanıcı adı + şifre** ile yürütülür (Supabase Auth kullanılmaz); şifre hash'lenir
- **Beni hatırla:** oturum kalıcıdır, uygulama açılınca doğrudan girilir (çıkış yapınca oturum silinir)
- **Kurtarma anahtarı:** kayıtta üretilir ve bir kez gösterilir; hash'i sunucuda saklanır.
  "Şifremi unuttum" akışıyla (isim + kurtarma anahtarı) yeni şifre belirlenebilir — cihaz değişse bile.
- **Yönetici hesabı:** `P4SH4` (şifre sabittir) — Ayarlar'da yönetici bölümü + özel sekme açar

## 📁 Proje Yapısı

```
├── App.js                      # Kök: navigasyon, tema, yasak ekranı
├── CHANGELOG.md                # Sürüm geçmişi (v2.0 tasarım sistemi)
├── src/
│   ├── screens/                # 18 ekran: Home, Habits, Progress, Shop, Leaderboard,
│   │                           #   Social, QuestBoard, SeasonPass, Inventory,
│   │                           #   Achievements, League, Team, Duel, Profile,
│   │                           #   Pomodoro, Settings, Admin, Auth
│   ├── components/             # HabitCard, Sheet, Modallar, Confetti, PressableFX, AnimatedCounter, SplashSkeleton…
│   │   └── ui/                 # Tasarım sistemi primitifleri: Button, Card, TextInput,
│   │                           #   EmptyState, ErrorState, SegmentedTabs, PillTabBar…
│   ├── context/                # AuthContext (oturum) + DataContext (veri/senkron)
│   ├── services/               # sync, profile, leaderboard, friend, admin, serverClock, effects, sfx
│   ├── data/                   # quests (görev kataloğu), shop (ürünler), achievements, starterHabits
│   ├── logic.js                # XP/seviye matematiği, tavan sabitleri
│   ├── theme/                  # Tasarım sistemi token'ları: colors, spacing, radius,
│   │                           #   typography, shadows, animations + 12 tema
│   └── hooks/                  # useReducedMotion, useSyncEngine
├── supabase/
│   ├── schema.sql                # TEK PARÇA şema (tüm tablolar + RLS + realtime)
│   └── functions/                # 7 edge function: sync-profile, sync-quest,
│                                 #   admin-action, recovery-action, duel-action,
│                                 #   chat-action, vip-action
├── docs/
│   ├── ui-test-checklist.md    # Cihazda arayüz testi (18 ekran)
│   ├── manual-smoke-test.md    # Cihazda sunucu/veri testi
│   └── playstore-yayin.md      # Play Store yayın rehberi
└── .github/workflows/build-apk.yml
```
