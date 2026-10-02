# Changelog

Bu dosya projenin sürüm geçmişini tutar. Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/),
sürümleme: [SemVer](https://semver.org/lang/tr/).

---

## [2.0.0] — 2026-10-02

Tasarım sistemi sıfırdan yeniden yazıldı (Apple × Linear karışımı) ve **17 ekran**
yeni tasarım sistemine taşındı. Bu sürüm, işlevsel olarak 1.1.x ile uyumludur;
fark yaratan değişiklikler görsel tutarlılık, erişilebilirlik ve performanstır.

### Eklenen

- **Tasarım sistemi v2** (`src/theme/`): renk, boşluk, köşe yarıçapı, tipografi,
  gölge ve hareket token'ları. Ölçekler daraltıldı: tipografi 5 boyut,
  radius 4 değer + `full`, ağırlık 400/600/700.
- **Yeni ekran: DuelScreen** — 7 günlük XP düellosu için bağımsız merkez
  (davet → kabul → canlı skor → ödül).
- **PomodoroScreen** ayrı ekran olarak ayrıldı; geri sayım için
  `type.displayXl` hero sayı token'ı eklendi.
- **Swipe-to-delete** — yalnız `HomeScreen` ve `HabitsScreen` üzerinde,
  silme onayı zorunlu.
- **SegmentedTabs** ile `SocialScreen` üç sekmeye ayrıldı
  (Arkadaşlar / Canlı Odalar / Sohbet).
- `useReducedMotion` hook'u — sistem "hareketi azalt" tercihinde
  animasyonlar otomatik kapanır.
- **`docs/ui-test-checklist.md`** — 18 ekran için cihazda elle doldurulan
  kontrol listesi (boş durum, klavye, swipe, animasyon, hata, performans).

### Yenilenen ekranlar (16 ekran yeniden yazıldı, 1 yeni eklendi)

| Commit | Ekranlar |
|---|---|
| `e606789` | HomeScreen, HabitsScreen (+ swipe-to-delete) |
| `5fdad2e` | ProfileScreen, **PomodoroScreen** (yeni) |
| `6024115` | QuestBoardScreen, SeasonPassScreen, LeagueScreen |
| `038ad8a` | LeaderboardScreen, AchievementsScreen, TeamScreen, FriendsScreen, **DuelScreen** (yeni) |
| `0d8dfa4` | SettingsScreen, ShopScreen, InventoryScreen, SocialScreen, AdminScreen |

### Yenilenen arayüz bileşenleri

- `Button`, `Card`, `TextInput`, `PillTabBar` — v2 token setine geçirildi.
- Tüm dekoratif `border` kaldırıldı (110 → 28 kullanım), glow/glass-blur ve
  5 sonsuz döngü animasyon kaldırıldı.
- Tüm ekranlarda boş durum `EmptyState`, hata durumu `ErrorState` primitive'i
  ile gösteriliyor (daha önce bazı ekranlar boş kalıyordu).

### Düzeltilen

- **Erişilebilirlik — WCAG AA kontrast:** 12 temanın **11'inde** AA altı renk
  çifti vardı (dolu buton yazısı 1.74–4.23:1). `onPrimary`, `textMuted`,
  `primary` ve `accent` değerleri düzeltildi → **12/12 tema AA**.
- **Dokunma hedefi:** `Button` (sm 36px), `SettingsScreen` saat çipleri
  (36px) hedefleri 44×44'e tamamlandı — görsel ölçü değişmeden.
- **Başlık tekrarı:** `ProgressScreen` başlığı hem `AppHeader`'da hem ekran
  içinde görünüyordu; yinelenen başlık kaldırıldı.
- `AppHeader` başlığı ekran okuyucuya `header` rolüyle bildiriliyor.
- **Kod temizliği:** 5 kullanılmayan import (`DataContext`, `App.js`) ve
  2 kullanılmayan dosya (`components/ui/Enter.js`, `components/ui/index.js`) silindi.
- **Tutarlılık:** 20 yerdeki token dışı `borderRadius` değeri (daire/rozet/çip)
  `RADIUS` token'larına taşındı.
- `FriendsScreen` liste satırına erişilebilirlik etiketi eklendi.

### Performans

- Üç `FlatList` (`FriendsScreen`, `LiveRooms`, `ChatTab`) için
  `initialNumToRender` / `maxToRenderPerBatch` / `windowSize` /
  `removeClippedSubviews` ayarlandı.
- `renderItem` fonksiyonları bileşen dışına/`useCallback` ile taşındı;
  `keyExtractor` ve `onContentSizeChange` modül seviyesi sabit referansa taşındı.

### Doğrulama

- `npm run typecheck` → temiz
- `npm test` → 65/65 geçti (`tests/unit/logic.test.js`, `tests/unit/syncQueue.test.js`)
- 118 kaynak dosya sözdizimi denetiminden geçti
- 12 tema için kontrast oranları hesaplandı (0 ihlal)

### Bilinen sınırlar

- **`ProgressScreen` ve `AuthScreen` yenilenmiş tasarım sistemine taşınmadı.**
  İşlevsel olarak test edilir; görsel tutarlılık bu iki ekranda farklıdır.
- ~100 satır hâlâ sayısal `borderRadius` yazıyor; değerler token ölçeğinde
  olduğu için görsel tutarlı, ancak `RADIUS.*` yerine sabit sayı.
- `Confetti` animasyonu bilerek 850ms (tek seferlik kutlama); 300ms kuralı
  arayüz geçişleri için geçerli.
- Cihazda elle test **henüz yapılmadı** — `docs/ui-test-checklist.md` doldurulmalı.

---

## [1.1.0] — önceki sürüm

- Sunucu saatine dayalı anti-farm mimarisi (5 katman).
- Görevler, düello, VIP, takımlar, ligler, canlı pomodoro odaları.
- Android widget + OS bildirimleri, şifre kurtarma, yedek & senkron.

[2.0.0]: https://github.com/P4SH4-28/HabitTracker/releases/latest