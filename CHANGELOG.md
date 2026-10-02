# Changelog

Bu dosya projenin sürüm geçmişini tutar. Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/),
sürümleme: [SemVer](https://semver.org/lang/tr/).

> Bu sürümdeki her madde **depoda doğrulanmıştır** (commit kodu veya kaynak satırıyla).
> Doğrulanamayan iddia release notuna alınmamıştır.

---

## [2.0.0] — 2026-10-02

Tasarım sistemi sıfırdan yeniden yazıldı (Apple × Linear karışımı) ve **17 ekran**
yeni tasarım sistemine taşındı. Bu sürüm işlevsel olarak 1.1.x ile uyumludur;
fark yaratan değişiklikler görsel tutarlılık, erişilebilirlik ve performanstır.

### 🎨 Major UI Redesign

- **Tasarım token'ları** (`src/theme/`): 4 nötr + 3 anlamsal + yardımcı renkler;
  boşluk, köşe yarıçapı, tipografi, gölge ve hareket token'ları ayrı modüllere ayrıldı.
  - Tipografi 5 boyuta + `type.displayXl` (hero sayı) indirildi
  - Radius 194 kullanım → 5 değer (`sm 8` · `md 12` · `lg 16` · `xl 20` · `full`)
  - Font ağırlıkları 3 değere indirildi (400 / 600 / 700)
  - Hareket 200-300ms bandına indirildi; **sonsuz döngü kaldırıldı** (`LOOP = null`)
  - Dekoratif `border` kullanımı 110 → 28; glow, glass blur ve kart gölgeleri kaldırıldı
  - `gradient` 9 → 4 (5 sonsuz döngülü kullanım silindi)
- **Bileşenler:** `Button` (4 variant: primary/secondary/ghost/danger),
  `Card` (2 variant: default/elevated), `TextInput` (label + icon + error + hint),
  `PillTabBar`, `SegmentedTabs`, `EmptyState`, `ErrorState`, `Progress`, `Pill`,
  `ListRow`, `IconTile`, `SectionHeader`, `Skeleton`, `SoftButton`, `AppTextField`.
- **Alt sekme çubuğu** `PillTabBar` ile yenilendi (safe-area uyumlu).

### ✨ Yeni Ekranlar

- **DuelScreen** (yeni) — 7 günlük XP düellosu için bağımsız merkez:
  davet → kabul → canlı skor çubuğu → kazanan ödülü.
- **PomodoroScreen** (yeni ekran olarak ayrıldı) — 15 / 25 / 45 dk süre seçici,
  uygulama kapalıyken çalışan geri sayım, `type.displayXl` hero rakam.

### 🎯 Yenilenen Ekranlar (16 ekran yeniden yazıldı)

| Commit | Ekranlar |
|---|---|
| `e606789` | HomeScreen, HabitsScreen (+ swipe-to-delete) |
| `5fdad2e` | ProfileScreen, PomodoroScreen |
| `6024115` | QuestBoardScreen, SeasonPassScreen, LeagueScreen |
| `038ad8a` | LeaderboardScreen, AchievementsScreen, TeamScreen, FriendsScreen |
| `0d8dfa4` | SettingsScreen, ShopScreen, InventoryScreen, SocialScreen, AdminScreen |

Her ekran boş durumda `EmptyState`, hata durumunda `ErrorState` primitive'ini kullanır.
Ekran içi `h1` kaldırıldı — başlık ortak `AppHeader` (TopBar) içinde tek yerde durur.

### 🐛 Bug Fixes (doğrulanmış)

- **SeasonPass:** eski ekran `passLevelFromXp().curXp` alanı yokken onu kullanıyordu
  (`undefined` → NaN ilerleme). Artık `curXp = totalXp - pass.cumXp`
  (`src/screens/SeasonPassScreen.js:95`).
- **Leaderboard:** arkadaş filtresi `friendIds` Set'i ile hesaplanıyor;
  liste `e.isMe || e.isFriend` ile daraltılıyor (`LeaderboardScreen.js:81,136`).
- **ProfileScreen:** `stats.totalCompletions` alanı yoktu ve hep 0 gösteriyordu;
  artık `totalCompletions(habits)` ile hesaplanıyor (`ProfileScreen.js:155-157`).
- **AuthScreen:** Android'de ilk kurulum ekranı klavye altında kalıyordu — düzeltildi
  (`eac340c`).
- **ProgressScreen:** "Gelişim" başlığı hem AppHeader'da hem ekran içinde görünüyordu;
  yinelenen başlık kaldırıldı.

### ♿ Erişilebilirlik

- **WCAG AA kontrast:** 12 temanın **11'inde** AA altı renk çifti vardı
  (dolu buton yazısı 1.74 – 4.23:1). `onPrimary`, `textMuted`, `primary` ve
  `accent` değerleri düzeltildi → **12/12 tema AA** (0 ihlal).
- **Dokunma hedefi 44×44:** `Button` (sm 36px) ve `SettingsScreen` saat çipleri
  (36px) hedefleri `hitSlop` ile 44×44'e tamamlandı — görsel ölçü değişmedi.
- `accessibilityRole="header"` ortak başlık çubuğuna eklendi.
- `accessibilityLabel` eklendi: arkadaş satırı, düello butonu, düello skoru,
  haftalık takım hedefi, pomodoro ilerleme çubuğu.
- Seçili durumlar yalnızca renkle değil, metin/ikonla da gösteriliyor.

### ⚡ Performans

- Üç `FlatList` (`FriendsScreen`, `LiveRooms`, `ChatTab`) için
  `initialNumToRender` / `maxToRenderPerBatch` / `windowSize` / `removeClippedSubviews`.
- `FriendsScreen` inline `renderItem` → `useCallback` ile sabitlendi;
  `keyExtractor` ve `onContentSizeChange` modül seviyesi sabit referansa taşındı
  (aynı desen `ChatTab` ve `LiveRooms`'da da uygulandı).
- 5 sonsuz döngülü animasyon ve dekoratif glow/glass katmanları kaldırıldı.

### 🔧 Kod Temizliği

- 5 kullanılmayan import silindi (`DataContext` ×4, `App.js` ×1).
- 1 kullanılmayan dosya silindi: `components/ui/Enter.js`.
  ⚠️ `components/ui/index.js` **silinmedi** — `PomodoroTimer.js` bu klasöre
  barrel import (`from './ui'`) yapıyor; kaldırılınca Android release derlemesi
  kırılıyordu (CI run #36/#37). Geri alındı ve doğrulandı.
- 20 yerdeki token dışı `borderRadius` değeri `RADIUS.*` ile değiştirildi.
- `console.log` yok (yalnızca bilinçli `console.warn`); `TODO` yalnızca config notu.

### 📚 Dokümantasyon

- `README.md` — tasarım sistemi token tablosu, güncel proje yapısı, test belgeleri.
- `docs/ui-test-checklist.md` — **yeni**, 320 satır / 10 bölüm: 18 ekran için
  cihazda elle doldurulacak kontrol listesi (boş durum, klavye, swipe,
  animasyon, hata, performans, erişilebilirlik, regresyon turu).
- `docs/manual-smoke-test.md` — arayüz katmanı bölümü eklendi (N).
- `CHANGELOG.md` — oluşturuldu.

### 🎨 Marka

- Uygulama adı **HabiX**, HX ikon seti ve splash ekranı (`3810039`).

### 🔧 Teknik

- `react-native-reanimated` patch'ı `patch-package` üzerinden uygulanıyor
  (`patches/react-native-reanimated+4.5.1.patch`).
- Widget tıklamalarından gelen derin bağlantıları: `habix://pomodoro/start`,
  `habix://duel/create` (`App.js`).
- Sürüm: `2.0.0`, `android.versionCode: 20`.

### Dogrulama

- `npm run typecheck` → temiz
- `npm test` → **65/65** geçti (`logic.test.js`, `syncQueue.test.js`)
- 118 kaynak dosya sözdizimi denetiminden geçti
- 12 tema için WCAG kontrast oranları hesaplandı → **0 ihlal**

### Bilinen sınırlar

- **`ProgressScreen` ve `AuthScreen` yenilenmiş tasarım sistemine taşınmadı.**
  İşlevsel olarak çalışır; görsel tutarlılık bu iki ekranda farklıdır.
- ~100 satır hâlâ sayısal `borderRadius` yazıyor; değerler token ölçeğinde
  olduğu için görsel tutarlı, ancak `RADIUS.*` yerine sabit sayı.
- `Confetti` animasyonu bilerek 850ms (tek seferlik kutlama); 300ms kuralı
  arayüz geçişleri için geçerli.
- **Cihazda elle test henüz yapılmadı** — `docs/ui-test-checklist.md` doldurulmalı.
- `android.versionCode` CI tarafından `github.run_number` ile **geçersiz kılınır**
  (`build-apk.yml`); `app.json` değeri yalnızca yerel derlemeleri etkiler.

---

## [1.2.0] — `v1.2.0` etiketi

- Sunucu saatine dayalı anti-farm mimarisi (5 katman).
- Görevler, düello, VIP, takımlar, ligler, canlı pomodoro odaları.
- Android widget (4 widget) + OS bildirimleri, şifre kurtarma, yedek & senkron.

## [1.1.0] — önceki sürüm

- İlk stabil sürüm: alışkanlık takibi, XP/seviye, seri ödülleri, dükkan, envanter.

[2.0.0]: https://github.com/P4SH4-28/HabiX/releases/latest
[1.2.0]: https://github.com/P4SH4-28/HabiX/releases/tag/v1.2.0