# Cihazda Manuel Smoke Test Planı (Release Öncesi)

> **Bu plan sunucu/veri katmanını (senkron, ekonomi, güvenlik, CI) kapsar.**
> **Arayüz katmanı** (18 ekranın tasarım sistemi, boş durumlar, klavye, swipe,
> animasyon, erişilebilirlik) için ayrı liste: **`docs/ui-test-checklist.md`**
> — yayın öncesi ikisini birlikte çalıştır.

> **Kural:** Bu belgedeki hiçbir senaryo bu denetim ortamında **çalıştırılmadı** (cihaz/Supabase
> erişimi yok). Tüm sonuç kutuları `[ ]` başlar; cihazda **gerçekten** yaptıktan sonra `[x]`
> veya `[!]` (sorun) ile işaretlenir. PASS olarak **uydurulmaz**.
>
> Otomatikleştirilenler (unit test/CI): 65 unit test + `tsc` + CI `jest --ci` → bunlar zaten yeşil,
> aşağıda **tekrar** edilmez. Burada kalanlar yalnızca **cihaz + sunucu** ile doğrulanabilenlerdir.

**Ortam:** 1 test hesabı (gerçek hesap değil), yayın öncesi staging ya da yayın sonrası prod.
**Ön koşul:** `docs/guvenlik-ve-dagitim.md` §1–§3 uygulanmış (migration → deploy → secrets).

Her senaryonun sonunda: **Sonuç:** `[ ] PASS  [ ] FAIL  [ ] ATLANADI` — yanında NOT alanı.

---

## A. Kurulum ve ilk senkron — `MANUAL`

1. Yeni APK'yi temiz cihaza kur, ilk kez kullanıcı adıyla giriş yap.
2. 2 alışkanlık oluştur, birini tamamla.
3. Ayarlar → **Senkronize et**.

**Beklenen:** “Başlıklı/Bağlı” durumu görünür; hata yok; tekrarlanınca XP **iki kez** artmaz (idempotency).
Sonuç: `[ ]` Not: ____

## B. Çevrimdışı → çevrimiçi drenaj — `MANUAL`

1. Uçak moduna al.
2. 3 alışkanlık tamamla + 1 görev ödülünü al (bekleme: “bekliyor” sayacı artmalı).
3. Uçak modunu kapat, beklemeyi tetikle (ekranı yenile/Senkronize et).

**Beklenen:** Bekleyen sayı **0**'a iner; sunucuda XP/altın tam olarak **bir kez** yansır
(`daily_earnings` satırı günlük tavanı aşmaz).
Sonuç: `[ ]` Not: ____

## C. Çift tıklama / tekrar oynatma — `MANUAL`

1. Görev ödülünü **hızlıca iki kez** bas.
2. Aynı anda iki cihazda (veya iki uygulama penceresinde) aynı alışkanlığı tamamla.

**Beklenen:** İkinci istek “zaten alındı” (409 `already_claimed_today`) döner; iki cihazda çift kredi yok.
Sonuç: `[ ]` Not: ____

## D. Hesap değiştirme (veri sızıntısı testi) — `MANUAL`

1. Hesap A'da 50 XP kazan (senkronize et, bekleyen kuyruk **0** olsun).
2. Çık → hesap B ile gir → B'nin XP'sini gör.
3. A'ya dön.

**Beklenen:** B'nin XP'si A'dan **etkilenmez**; kuyruk/önbellek/köprü hesap bazlı;
A'da bekleyen iş varsa **yalnızca A**'da durur ve A'ya dönünce A için çalışır.
Sonuç: `[ ]` Not: ____

## E. Yavaş ağ / kopma — `MANUAL`

1. Bağlantıyı kes, değişiklik yap → senkron başarısız → “bekliyor” artar + çevrimdışı göstergesi.
2. Bağlantıyı geri ver.

**Beklenen:** Otomatik/yenileme ile tekrar denenir; veri kaybı yok; hata ekranı kilitlenmez.
Sonuç: `[ ]` Not: ____

## F. Widget görev kuyruğu — `MANUAL` (Android widget)

1. Widget'tan hızlı görevi tamamla (uygulama **kapalıyken**).
2. Uygulamayı aç.

**Beklenen:** Widget görevi uygulamaya işlenir; ikinci kez işlenmez (`clearWidgetTasks`); çakışan ödül yok.
Sonuç: `[ ]` Not: ____

## G. Admin girişi (negatif + pozitif) — `MANUAL` + `curl`

Rotation sonrası (`docs/guvenlik-ve-dagitim.md` §3):

1. **Yanlış şifre** ile giriş → aynı “yasak/403” hatası (kullanıcı adı ayrımı yok), 5/dk sonra 429.
2. **Doğru şifre** ile giriş → token alınır (12 saat).
3. Token'suz `adjust` çağrısı → `403 forbidden`.
4. Token'lı `adjust` → başarılı; **aynı `requestId` ile tekrar** → ikinci kez uygulanmaz.
5. `admin_not_configured` görürsen → Secrets eksik (§5).

Örnek (değerler sizde, buraya **yazılmaz**):
```
curl -sS -X POST "$SUPABASE_URL/functions/v1/admin-action" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ANON_KEY" \
  -d '{"action":"login","username":"<YÖNETİCİ>","passHash":"<hashPassword(şifre)>"}'
```
Sonuç: `[ ]` Not: ____

## H. Ekonomi sınırları — `MANUAL`

1. Bir günde +500 XP'den fazlasını dene → sunucu günlük pozitif tavanı aşırır (kalan kırpılır).
2. Negatif delta (XP düşürme) dene → bir günde -500 XP / -300 🪙 fazlası yansımaz.

**Beklenen:** Bakiye asla 0'ın altına inmez (DB `CHECK`); `flagged` bayrağı gerekiyorsa görünür.
Sonuç: `[ ]` Not: ____

## I. Düello — `MANUAL`

1. A→B davet et, B kabul et, **aynı anda** B→A daveti deneme (mümkünse ikinci cihazdan).
2. Süre bitiminde `finish` → kazanan ödüllü; ödülün **iki kez** alınamaması (`reward_claimed`).

**Beklenen:** Yön bağımsız tek aktif düello; çift ödül yok; bakiye negatife düşmez.
Sonuç: `[ ]` Not: ____

## J. VIP satın alma — `MANUAL`

1. Altın yetersizken dene → sunucu reddeder, yerel altın **düşmez**.
2. Yeterli altınla dene → `vipUntil` yazılır, altın **bir kez** düşer (senkron sonra da tutarlı).

Sonuç: `[ ]` Not: ____

## K. Kurtarma anahtarı — `MANUAL`

1. Yanlış kurtarma anahtarı → 401; 12/5 dk sonra 429.
2. Doğru anahtar → giriş açılır.
3. `recovery_hash` değerini **anon key** ile sorgulamayı dene → **izin hatası** (kolon gizli).

Sonuç: `[ ]` Not: ____

## L. Sohbet / hız sınırları — `MANUAL`

1. 60 sn içinde 60+ mesaj → 429.
2. 5 sn içinde art arda mesaj → engellenir; 65+ karakterli mesaj kırpılır/400.

Sonuç: `[ ]` Not: ____

## M. Yükleme/derleme doğrulaması — `MANUAL` (CI)

1. Push sonrası Actions yeşil (jest + tsc + gradle).
2. Artifact `HabitTracker-App-Release` → APK+AAB indir → cihaza kur.
3. **Yeni** APK'da eski sır kalıp kalmadığı: `strings HabitTracker.apk | grep -c 'ht-admin'` → **0**.
4. GitHub Release `latest` linki güncel APK'yı veriyor.

Sonuç: `[ ]` Not: ____

---

### Özet tablo (cihazda doldurun)

| Senaryo | Otomatik mi? | Sonuç |
|---|---|---|
| A Kurulum/ilk sync | Hayır | `[ ]` |
| B Çevrimdışı drenaj | Hayır | `[ ]` |
| C Çift tıklama/idempotency | Kısmen (unit: kuyruk) | `[ ]` |
| D Hesap değiştirme | Kısmen (unit: kuyruk; guard kodda) | `[ ]` |
| E Kopma/yeniden deneme | Hayır | `[ ]` |
| F Widget kuyruğu | Hayır | `[ ]` |
| G Admin login | Hayır (`curl`) | `[ ]` |
| H Ekonomi tavanları | Kısmen (unit: clamp) | `[ ]` |
| I Düello | Hayır | `[ ]` |
| J VIP | Hayır | `[ ]` |
| K Kurtarma | Hayır | `[ ]` |
| L Sohbet/hız sınırı | Hayır | `[ ]` |
| M CI artifact + APK temizliği | CI otomatik (koşum beklenir) | `[ ]` |

---

## N. Arayüz katmanı (18 ekran) — `MANUAL`

Arayüz denetimi ayrı belgede toplandı: **`docs/ui-test-checklist.md`**

1. Navigasyon iskeleti + başlık tekrarları yok mu?
2. Her ekran: boş durum → dolu durum → hata durumu → geri dönüş.
3. Klavye hiçbir formda alanı/butonu kapatmıyor mu?
4. Swipe-to-delete yalnız istenen ekranda ve **onaylı** mı?
5. Tüm animasyonlar ≤300ms, sonsuz döngü yok mu?
6. 12 temada metin kontrastı okunabilir mi?
7. Boş/hata durumlarında çökme, NaN, `undefined` yok mu?

Sonuç: `[ ]` Not: ____
