# Cihazda Toplu UI Testi — Kontrol Listesi (v2.0 Tasarım Sistemi)

> **Bu belge cihazda elle doldurulur.** Kutu işaretlenmeden PASS sayılmaz.
> Kapsam: 7. saat "final test + rötuş" — 18 ekranın yenilenmiş tasarım sistemiyle
> elde ve çevrimiçi/çevrimdışı hâllerde doğrulanması.
>
> **Otomatik olanlar tekrarlanmaz:** 65 unit test + `tsc --noEmit` zaten yeğil
> (`npm test`, `npm run typecheck`). Ayrıca WCAG AA kontrastı kod seviyesinde
> tüm 12 tema için doğrulandı — ekranda gözle ayrıca kontrol **isteğe bağlı**.
>
> **Ortam:** En az 1 normal hesap + 1 yönetici hesabı (`P4SH4`). Telefon: Android.
> **Süre:** ~45-60 dk. Bir senaryoyu atlarsan `[~]` ile işaretle.

---

## 0. Hazırlık (5 dk)

- [ ] `npm run typecheck` yeşil
- [ ] `npm test` → 65/65 yeşil
- [ ] APK güncel (`HabitTracker.apk` → GitHub Actions build'i)
- [ ] Uygulama **temiz** kuruldu (eski veri/sürüm karışmasın)
- [ ] Test hesabı hazır, en az **2 alışkanlık** ve **1 arkadaş** var (boş durumları ayrı test edeceğiz)
- [ ] Telefonda "Geliştirici → Animasyon ölçeği = 1x" (animasyon süresi ölçümü için)

---

## 1. İlk açılış ve navigasyon iskeleti

| # | Test | Beklenen | Sonuç |
|---|---|---|---|
| 1.1 | Uygulamayı ilk kez aç | Açılış rehberi (Onboarding) 3 sayfa çıkar | `[ ]` |
| 1.2 | Onboarding'de ileri/geri/atla | Her sayfa düzgün ilerler, "atla" çalışır | `[ ]` |
| 1.3 | Giriş ekranı (AuthScreen) | Kullanıcı adı + şifre alanı görünür, **klavye açılır** | `[ ]` |
| 1.4 | Klavye açıkken "Giriş Yap" butonu | Buton **klavye altında kalır**, ekran kaymaz | `[ ]` |
| 1.5 | Yanlış şifre | Hata mesajı görünür, "hatalı şifre" bilgisi sızmaz | `[ ]` |
| 1.6 | "Şifremi unuttum" | Kurtarma anahtarı akışı açılır | `[ ]` |
| 1.7 | Başarılı giriş → ana ekran | 5 sekme + üstte TopBar + altta PillTabBar görünür | `[ ]` |
| 1.8 | Tüm 5 sekmeye sırayla bas | Her sekme açılır, **ekran beyazlamaz/kararma yok** | `[ ]` |
| 1.9 | Sol üst hamburger | Menü açılır (Görevler, Season Pass, Envanter, Başarımlar, Lig, Takım, Düello, Profil, Ayarlar, Admin) | `[ ]` |
| 1.10 | Menüden her ekrana gir → geri ok | Geri ok **her zaman** çalışır, ana ekrana döner | `[ ]` |
| 1.11 | Android fiziksel geri tuşu | Aynı davranış (menüyü kapatır / geri gider) | `[ ]` |
| 1.12 | **Başlık tekrarları** | Hiçbir ekranda başlık **iki kez** görünmez (AppHeader + ekran içi h1 yok) | `[ ]` |
| 1.13 | Çok hızlı sekme değiştirme (10x) | Titreme, kasma veya boş ekran yok | `[ ]` |

---

## 2. Ekran ekran işlev testi

Her ekran için: **boş durum → dolu durum → hata durumu → geri dönüş**.

### 2.1 HomeScreen (Bugün)
- [ ] Üstte karşılama + tarih + bildirim zili + avatar + XP rozeti
- [ ] **Bugünün ilerlemesi** yüzdesi doğru (0/2 → %0, 1/2 → %50)
- [ ] Alışkanlık satırına dokun → tamamlandı: ✓ daire + seri/XP artışı + konfeti
- [ ] **Swipe-to-delete:** satırı sola kaydır → silme butonu çıkar, onay ister
- [ ] Silme onayında "Vazgeç" → alışkanlık **silinmez**
- [ ] FAB (+) → alışkanlık ekleme modalı; **klavye modalın altında kalmaz**
- [ ] 8 aktif alışkanlık sınırı → 9. ekleme denenir → sınır uyarısı çıkar
- [ ] Alt bilgi: 3 istatistik kartı değerleri canlı güncellenir
- [ ] **Boş durum:** tüm alışkanlıkları sil → "Hızlı başlangıç" önerileri çıkar

### 2.2 HabitsScreen (Alışkanlıklar)
- [ ] Başlık + limit rozeti ("3/8") + ipucu
- [ ] Filtre sekmeleri: **Tümü / Aktif / Bekleyen** doğru filtreler
- [ ] Filtre değiştirince liste anında güncellenir
- [ ] Swipe-to-delete: kaydır → sil → onay → liste güncellenir, rozet azalır
- [ ] Swipe ile **kazara silme yok** (onay diyaloğu görünür)
- [ ] Yeni alışkanlık ekle → listede görünür, rozet artar
- [ ] **Boş durum:** EmptyState görünür, ekran boş/kırık değil

### 2.3 ProgressScreen (Gelişim) ⚠️ *eski ekran — özellikle bak*
- [ ] Başlık **bir kez** görünür ("Gelişim") — iki kez tekrarlamıyor
- [ ] 4 özet kartı: Toplam Tamamlama / En İyi Seri / Toplam XP / Aktif Alışkanlık
- [ ] "Bu hafta vs geçen hafta" kartı doğru yönü gösterir (↑ yeşil / ↓ kırmızı)
- [ ] Haftalık çubuk grafik: 7 çubuk, bugün vurgulu, çubuklar ≤300ms animasyonla büyür
- [ ] Isı haritası: 35 hücre, yoğunluk renkleri okunabilir
- [ ] "En Çok Tamamlananlar" listesi sıralı
- [ ] **Başarım rozetleri** veri olsa da olmasa da görünür
- [ ] **Boş durum:** EmptyState ("Henüz veri yok") çıkar, grafikler yerine boşluk değil
- [ ] Grafik animasyonu **takılı/çok yavaş değil** (bir tur ≤400ms)

### 2.4 ShopScreen (Dükkan)
- [ ] 4 sekme: Eşyalar / Avatarlar / Çerçeveler / Temalar
- [ ] Filtre çipleri (Hepsi / Sahip Olunan / Satın Alınabilir) çalışır
- [ ] **Tema kartına dokun → canlı önizleme** (mini ekran mock'u renk değiştirir)
- [ ] Yetersiz altınla satın alma → buton **pasif**, altın **düşmez**
- [ ] Yeterli altınla satın alma → toast + haptic + altın bir kez düşer
- [ ] "Seçili" rozeti ✓ ile görünür, **sadece renge dayalı bilgi yok**
- [ ] Profil fotoğrafı yükleme/aldırma çalışır
- [ ] **Boş durum:** filtre sonucu boş → EmptyState ("Sahip olduğun ürün yok")
- [ ] Kart butonları **44×44** dokunma hedefi (yanlışlıkla basılmıyor)

### 2.5 LeaderboardScreen (Liderlik)
- [ ] Seviye < 5 → **kilit ekranı** çıkar; kilit ikonu sekmede görünür
- [ ] Seviye ≥ 5 → sıralama listesi açılır
- [ ] "Arkadaşlar / Herkes" geçişi çalışır
- [ ] Kendi satırın **vurgulu** (ayrı renk + konum etiketi)
- [ ] 7 günlük XP trend grafiği çizilir
- [ ] Şüpheli hesap rozeti (varsa) görünür
- [ ] **Boş durum:** arkadaş yokken EmptyState, hata değil

### 2.6 SocialScreen (Sosyal) — 3 sekmeli
- [ ] Sekme 1 **Arkadaşlar**: liste + "Ekle" butonu
- [ ] Arkadaş satırına dokun → profil modalı açılır ve kapanır
- [ ] Arkadaş satırına **uzun bas** → silme onayı çıkar
- [ ] Satırdaki ⚔️ → düello daveti onayı, **tek dokunuşta davet gitmez**
- [ ] Sekme 2 **Canlı Odalar**: oda listesi + "Oluştur" (ad 2-40 karakter doğrulaması)
- [ ] Odaya **Katıl** → buton "Ayrıl" olur, odada başkası görünür
- [ ] Odadan **Ayrıl** → listeden çıkar
- [ ] Çevrimdışıyken → "Çevrimdışısın" uyarısı, butonlar kilitli
- [ ] Sekme 3 **Sohbet**: mesaj listesi + input; gönderilen mesaj **kendi sağında**
- [ ] Sohbette 65+ karakter → kırpılır veya uyarı verir
- [ ] Üç sekmede de **boş durum** EmptyState gösterir (uçuk boş ekran yok)
- [ ] **Çok uzun isim** (25+ karakter) satırı bozmaz, ... ile kısalır

### 2.7 QuestBoardScreen (Günün Görevleri)
- [ ] 4 zorluklu görev listesi + bekleyen süre göstergesi
- [ ] Ödül al → ödül düşer, kart "alındı" durumuna geçer
- [ ] Bekleme süresi olan görev **geri sayar**, süre bitince buton açılır
- [ ] **Çift dokunuş** ödülü iki kez düşürmez (409 / "zaten alındı")
- [ ] Otomatik görevler alışkanlıkla birlikte tetiklenir
- [ ] Filtre boş sonuç → EmptyState

### 2.8 SeasonPassScreen
- [ ] Seviye çubuğu + ödül listesi (kilitli/açık ayrımı net)
- [ ] Ödül "al" → işaretlenir, tekrar alınamaz
- [ ] VIP kartı; altın yetmezse pasif, **altın düşmez**
- [ ] VIP satın alınca `vipUntil` yazılır, altın bir kez düşer

### 2.9 AchievementsScreen (Başarımlar)
- [ ] Kilitli rozetler soluk, açılanlar renkli ve **ikon/metin ile** ayrışır
- [ ] Filtre: Tümü / Kilitli / Açık
- [ ] Yeni açılan rozet toast olarak görünür
- [ ] **Boş durum:** hiç rozet yok → EmptyState

### 2.10 InventoryScreen (Envanter)
- [ ] Satın alınabilen / sahip olunan ayrımı
- [ ] "Kullan" → aktif rozet çipi görünür
- [ ] Etki metni (örn "2x XP") okunabilir
- [ ] Altın yetmezse buton pasif
- [ ] **Boş durum:** hiç eşya yok → EmptyState

### 2.11 LeagueScreen (Haftalık Ligler)
- [ ] Bronz→Elmas lig aralığı, mevcut lig vurgulu
- [ ] Puan çubuğu + hafta sonu ödülü
- [ ] Kullanıcının ligi ve sırası görünür
- [ ] Lig geçişinde kutlama görseli **sonsuz döngü değil** (≤300ms bitiyor)

### 2.12 TeamScreen (Takımlar)
- [ ] Takım kur / katıl / ayrıl
- [ ] Ortak 1000 XP haftalık hedef çubuğu yüzde olarak
- [ ] Üye sıralaması ve kendi sıran vurgulu
- [ ] Hedef dolunca kutlama + ödül
- [ ] Takım yokken "kur/katıl" yönlendirmesi

### 2.13 DuelScreen (Düello) ⚠️ *yeni ekran*
- [ ] Davet gönder → karşı taraf kabul edene kadar "bekliyor"
- [ ] Kabul → canlı skor çubuğu iki taraflı dolar
- [ ] Bitişte kazanan ödülü alır; **ödül iki kez alınamaz**
- [ ] Beraberlik durumu "Berabere" gösterir
- [ ] Pasif düello / süresi dolmuş düello durumu

### 2.14 ProfileScreen (Profilim)
- [ ] Avatar + fotoğraf yükleme/kaldırma
- [ ] İsim, biyografi, VIP rozeti, seviye barı
- [ ] 4 özet kartı doğru değerler
- [ ] Uzun isim/biyografi taşma veya kırpmayla bozulmaz
- [ ] Kilitli istatistikler (varsa) kilit ikonuyla

### 2.15 PomodoroScreen (Odak Zamanı)
- [ ] Geri sayım **büyük rakamla** (hero sayı) net okunur
- [ ] Başlat / duraklat / devam / iptal
- [ ] Süre dolunca tamamlama ödülü + konfeti
- [ ] **Uygulama arka plana atılınca** süre doğru işler (kapat-aç kontrolü)
- [ ] Segment/slot göstergeleri hizalı
- [ ] Klavye açılmıyor, ekran kaymıyor

### 2.16 SettingsScreen (Ayarlar)
- [ ] Profil kartı → Profil ekranına gider
- [ ] **Tema seçici:** 12 tema, her biri seçilebilir ve **anında uygulanır**
- [ ] **Tema sonrası kontrast okunabilir:** buton yazısı, ikincil metin, çip yazısı net
- [ ] Bildirim izni istenir; saat seçici 24 saat + "Kapalı" çipi
- [ ] Saat çipleri **küçük ama yanlışlıkla basılmıyor** (44×44 dokunma hedefi)
- [ ] "Senkronize et" → durum rozeti güncellenir
- [ ] **Hesap sil** → iki aşamalı onay, sonra giriş ekranı
- [ ] Admin hesabıyla → "Yönetici bölümü" görünür

### 2.17 AdminScreen (Yönetici) ⚠️ *sadece admin hesabı*
- [ ] Kullanıcı arama → sonuç listesi
- [ ] Ban / Unban → durum ve rozet anında güncellenir
- [ ] XP / altın cezası veya ödülü → bakiye değişir
- [ ] Tema/avatar/çerçeve hediye → kullanıcıda görünür
- [ ] Şüpheli bayrağı kaldırma
- [ ] **Yanlış yetki:** normal hesapla menüde Admin **görünmez** ve ekran açılmaz
- [ ] Geçersiz kullanıcı adı → anlaşılır hata, kilitlenme yok

### 2.18 Onboarding / Modallar (genel)
- [ ] Onboarding 3 sayfa, ilk girişte **bir kez**, sonra tekrar açılmaz
- [ ] Sheet (alışkanlık ekle/sil) yukarı kayar ≤300ms
- [ ] Modal arka planı dokununca kapanır (kazara veri kaybı yok)

---

## 3. Boş durum matrisi

Her ekranı **gerçekten boş** hale getirip doğrula (sadece yeni hesapla değil, mevcut hesabı boşaltarak da):

- [ ] Alışkanlık 0 iken: Home / Habits / Progress / Envanter / Lig / Takım
- [ ] Arkadaş 0 iken: Sosyal-Arkadaşlar / Liderlik
- [ ] Mesaj 0 iken: Sosyal-Sohbet
- [ ] Oda 0 iken: Sosyal-Canlı Odalar
- [ ] Rozet 0 iken: Başarımlar / Profil
- [ ] Satın alınmış ürün 0 iken: Dükkan (filtre = Sahip Olunan)
- [ ] Görev 0 iken: Görev Panosu
- [ ] Hiçbir yerde **çökme (kırmızı ekran), NaN, `undefined`, boş kart** yok

---

## 4. Klavye ve odak testi

| # | Test | Beklenen | Sonuç |
|---|---|---|---|
| 4.1 | Giriş ekranı → klavye | Şifre alanı görünür, butonlar klavye altında değil | `[ ]` |
| 4.2 | Alışkanlık adı yaz | Modal yukarı kayar, yazarken klavye alanı kapatmaz | `[ ]` |
| 4.3 | Ayarlar tema/hikaye arama alanı | Yazarken liste kaymaz, klavye ikonu altta | `[ ]` |
| 4.4 | Sohbet input | Mesaj yazarken liste yukarı kayar, gönder butonu erişilebilir | `[ ]` |
| 4.5 | Klavye "kapat" | Alan eski konumuna döner, düzen bozulmaz | `[ ]` |
| 4.6 | Dikey kaydırma + klavye açık | Ekran hem zıplamaz hem de sıkışmaz | `[ ]` |

---

## 5. Swipe, animasyon ve dokunma testi

- [ ] **Swipe-to-delete (Alışkanlıklar + Bugün):** yalnızca bu iki ekranda; yanlışlıkla tetiklenmiyor
- [ ] Kaydırma → buton çıkar; **onay** ister; "Vazgeç" iptal eder
- [ ] Alışkanlık satırı hâlâ dokunulabilir (swipe sonrası profil açılır)
- [ ] Buton basma geri bildirimi (ölçek + haptic) her yerde var
- [ ] **Tüm animasyonlar ≤300ms bitiyor** — hiçbir yerde takılı hissetmiyor
- [ ] **Sonsuz döngü animasyon yok** (nabız/yanıp sönen yok — yalnız "bugün" hücresi bir kez oynar)
- [ ] Sekme geçişi yumuşak, ekran kararması yok
- [ ] Dokunma hedefleri: küçük ikon butonları **44×44** (yanlış dokunma/hata basış yok)
- [ ] Sistem "hareketi azalt" açıkken: animasyonlar kapanır, içerik **anında** görünür, gizli kalmaz

---

## 6. Hata ve çevrimdışı durumlar

| # | Senaryo | Beklenen | Sonuç |
|---|---|---|---|
| 6.1 | Uçak modu, uygulamayı aç | Splash/skeleton sonrası yerel veri açılır, hata değil | `[ ]` |
| 6.2 | Uçak modunda tamamlama | "Bekliyor" sayacı artar, veri kaybolmaz | `[ ]` |
| 6.3 | Bağlantı geldi | Kuyruk boşalır, XP bir kez yansır | `[ ]` |
| 6.4 | Sunucu hatası (500) | ErrorState + "Tekrar Dene", ekran kilitlenmez | `[ ]` |
| 6.5 | Kimlik doğrulama bozulursa | Hata mesajı, uygulama kapanmaz; oturum güvenli şekilde düşer | `[ ]` |
| 6.6 | Hesap yasaklandıysa | Tam ekran bilgilendirme, hiçbir veri gösterilmez | `[ ]` |
| 6.7 | Render hatası (FatalErrorView) | Ekranda hata + "Tekrar Dene", sessiz çökme yok | `[ ]` |
| 6.8 | Kesilen ağda hızlı sekme değiştirme | Takılma yok, veri tutarlı | `[ ]` |
| 6.9 | Çok uzun metin (300 karakter isim) | Alan taşmaz, kırpılır | `[ ]` |
| 6.10 | Sunucu saati bozuk | Saat koruması devreye girer, hile yakalanmaz | `[ ]` |

---

## 7. Performans (elle ölçüm)

- [ ] Uygulama açılışı (soğuk) ≤ 3 sn
- [ ] Sekme değişimi pürüzsüz (takılma/Donma yok)
- [ ] Alışkanlık listesi 20+ öğede kaydırma akıcı
- [ ] Envanter/Dükkan ızgarasında kaydırma akıcı
- [ ] 12 temayı sırayla aç: **gecikme veya kasma yok**
- [ ] 30 sn boyunca alışkanlık tamamla/sil: bellek şişmesi, donma yok
- [ ] Android'de geliştirici → "GPU render" + kare hızı: yoğun ekranlarda düşüş izlenmiyor

---

## 8. Tutarlılık (gözle)

- [ ] Her ekranda dikey kenar boşluğu **aynı** (20px)
- [ ] Kart köşeleri her yerde **aynı** (token değerleri: 8/12/16/20/yuvarlak)
- [ ] Başlık çubuğu tüm ekranlarda aynı yükseklikte
- [ ] Buton yüksekliği ve dolgu her ekranda aynı
- [ ] İkincil metin rengi her ekranda aynı ve **okunabilir**
- [ ] Her 12 temada metinler okunabilir (soluk/çok soluk metin yok)
- [ ] Boş durumlar aynı EmptyState bileşenini kullanıyor (tutarlı ikon+başlık+alt metin)

---

## 9. Erişilebilirlik (cihazda)

- [ ] Ekran okuyucu açık: her ekranın **başlığı** okunuyor
- [ ] Düello butonu "… ile düello başlat" diye okunuyor
- [ ] Saat çipleri "Hatırlatma saati 9.00 / seçili" diye okunuyor
- [ ] Düğmeler "düğme" rolüyle okunuyor
- [ ] Seçili durumlar yalnız renkle değil (metin/ikon da var)
- [ ] Dokunma hedefleri yeterince büyük (yanlış dokunma yok)

---

## 10. Toplu (regresyon) tur — en hızlı akış

Yayın öncesi tekrar için 10 adımlık turluk kontrol:

1. Giriş yap → 2. "Bugün": bir alışkanlık tamamla → 3. **Swipe ile sil** (onayla) →
4. Yeni alışkanlık ekle → 5. Görev ödülü al → 6. Dükkan: tema değiştir (koyu→oyu) →
7. Ayarlar: senkronize et → 8. Sosyal: arkadaş ekle → 9. Profil: fotoğraf yükle →
10. Profil ekranı + uçak modu → çevrimiçi

**Beklenen:** Hiçbir adımda kırmızı ekran, takılma veya veri kaybı yok.

Sonuç: `[ ]`

---

## Bilinen sınırlar (bu turun kapsamı dışında)

- **ProgressScreen ve AuthScreen** yenilenmiş tasarım sistemine **taşınmadı** (eski yapıda kaldı);
  işlevsel olarak test edilir ama görsel tutarlılık bu iki ekranda farklıdır.
- Ekranlar arasında ~100 satır hâlâ sayısal `borderRadius` yazıyor; değerler **token ölçeğinde**
  (8/12/16/20/yuvarlak) olduğu için görsel tutarlı, ama `RADIUS.*` yerine sabit sayı.
- Konfeti animasyonu bilerek 850ms sürüyor (tek seferlik kutlama); 300ms kuralı arayüz
  geçişleri için geçerli.