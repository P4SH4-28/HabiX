# Güvenlik Geçişi ve Dağıtım Kılavuzu

Bu belge, `supabase/migrations/001_security_hardening.sql` + yenilenen Edge
Functions'ların **doğru sırayla** uygulanmasını ve admin sırlarının
**üretilmesini/çevrilmesini** anlatır. Sıra önemlidir:

```
1) Migration (SQL)  →  2) Edge Functions deploy  →  3) Secrets  →  4) Doğrulama
```

> Fonksiyonlar migration'dan ÖNCE deploy edilirse senkron çalışmaya devam
> eder (kod, eksik kolonları güvenli biçimde atlar); ancak negatif delta
> tavanları ve `sync_requests` idempotency koruması migration'dan sonra
> devreye girer. Tersi durumda (migration önce) hiçbir şey kırılmaz.

---

## 1) Migration

Supabase Dashboard → **SQL Editor** → yeni sorgu →
`supabase/migrations/001_security_hardening.sql` içeriğini yapıştır → **Run**.

Betik **idempotenttir** (ikinci kez çalıştırmak zararsız). Yaptıkları:

| Bölüm | Değişiklik | Etkisi |
|---|---|---|
| 0–1 | `xp/coins/xp7d/streak/duels.start_xp_*` için `CHECK (>= 0)` | Negatif bakiye DB seviyesinde imkânsız |
| 2 | `daily_earnings.neg_xp/neg_gold` kolonları | Günlük **negatif** delta tavanı (-500 XP / -300 🪙) |
| 3 | `team_members` tek takım (UNIQUE + temizlik) | Aynı kişi iki takımda olamaz |
| 4 | `duels` yön bağımsız tek aktif düello | A→B + B→A çift kayıt kapanır |
| 5 | `recovery_hash` için `REVOKE` + kolon bazlı `GRANT` | **pass-the-hash hesap ele geçirme kapatılır** |
| 6 | Eksik indeksler (arkadaşlık, sohbet, oda, liderlik, düello) | N+1 sorgu yükü azalır |
| 7 | `admin_logs.request_id` tekil indeks | Admin işlemi iki kez uygulanamaz |
| 8 | `sync_requests` tablosu (RLS açık, istemciye kapalı) | Aynı delta iki kez uygulanamaz (idempotency) |

Geri alma: her bölümün altındaki `-- Geri dönüş:` yorum satırlarına bakın.
Veri silinmez, yalnızca kısıt/indeks eklenir.

---

## 2) Edge Functions deploy

Aşağıdaki dosyalar Dashboard → **Edge Functions** → ilgili fonksiyon →
**Settings/Source** → `index.ts` içeriğini değiştir → **Deploy** ile
güncellenir. **“Verify JWT” KAPALI** kalmalı (istemci anon key değil doğrudan
HTTP çağırır; tüm kimlik doğrulama fonksiyon içindedir):

| Fonksiyon | Bu geçişte değişen kritik nokta |
|---|---|
| `admin-action` | Sabit anahtar/şifre koddan silindi; `login` → HMAC imzalı 12 saatlik token; token'suz işlem yok; hız sınırı + idempotency |
| `sync-profile` | Negatif delta günlük tavanı; `requestId` idempotency; IP hız sınırı; bio/foto uzunluk sınırları |
| `sync-quest` | Ödül alımı **atomik** (şartlı UPDATE/INSERT) — eşzamanlı iki istek çift ödül alamaz |
| `duel-action` | `finish` durum geçişi atomik (active→done); ham `.or()` sorgusu kaldırıldı; koşullu bakiye artışı |
| `recovery-action` | Hız sınırı ayrı anahtara taşındı (artık normal senkronu kilitlemiyor) |
| `vip-action` | Etkilenen satır sayısı kontrolü (çakışma → 409); hız sınırı |
| `chat-action` | Kullanıcı adı doğrulama; IP/kullanıcı/oda hız sınırları |

`supabase/functions/tsconfig.json` eklendi: Edge Functions Deno ortamında
çalışır ve uygulama tip denetiminden (`npm run typecheck`) ayrıdır.
Deno SDK kuruluysa: `deno check supabase/functions/**/index.ts`.

---

## 3) Secrets (kritik)

Dashboard → **Project Settings → Secrets** (veya `supabase secrets set`):

```bash
# 12 saatlik token imzalama anahtarı (rastgele, DEĞİŞTİRİLMEMELİ)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Yönetici şifresinin hash'i — istemci hashPassword() ile üretir:
node -e "
const p = process.argv[1], salt = 'habit_tracker_salt', input = salt + ':' + p;
let h1 = 5381, h2 = 52711;
for (let i = 0; i < input.length; i++) { const c = input.charCodeAt(i);
  h1 = ((h1 * 33) ^ c) >>> 0; h2 = ((h2 * 31) ^ c) >>> 0; }
console.log(h1.toString(16).padStart(8,'0') + h2.toString(16).padStart(8,'0'));
" 'YENİ_YÖNETİCİ_ŞİFRESİ'
```

| Secret | Zorunlu | Açıklama |
|---|---|---|
| `ADMIN_TOKEN_SECRET` | ✅ | Yukarıdaki rastgele 64 karakter. Kaybolursa tüm admin oturumları geçersizleşir (güvenli). |
| `ADMIN_PASSWORD_HASH` | ✅ | `hashPassword(yeni şifre)` çıktısı (16 hex). **Şifrenin kendisidir** — yalnızca Secrets'ta tutulur. |
| `ADMIN_USERNAME` | – | Varsayılan `P4SH4`. |
| `ADMIN_KEY` | ❌ | Eski geçiş anahtarı. Tanımlıysa kaldırın: `supabase secrets unset ADMIN_KEY`. |

### Sırların Çevrilmesi (rotation)

Eski sürümlerde şu değerler koda gömülüydü ve **her APK'da okunabilir**;
kabul edilmiş sayılmalıdır:

- Sabit admin anahtarı: **eski APK içinde** (`HabitTracker.apk`, değer belgede yazılmaz)
- Sabit admin şifresi: **eski APK içinde** (değer belgede yazılmaz)

Yapılacaklar:

1. Yukarıdaki komutlarla **yeni** şifre + `ADMIN_TOKEN_SECRET` üretin.
2. `ADMIN_PASSWORD_HASH` değerini güncelleyin (eski hash geçersizleşir).
3. `ADMIN_KEY` Secret'ını silin (koddan da silindi).
4. Uygulamadaki yönetici şifresini yenileyin (istekte `hashPassword(yeni)` gider).
5. Şüpheli bir işlem olduysa `admin_logs` tablosunu inceleyin:
   `SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 50;`

---

## 4) Doğrulama listesi

Uygulamadan (bir test hesabıyla):

- [ ] Alışkanlık tamamla → Ayarlar → **Senkronize et** → “Bağlandı” görünür.
- [ ] Aynı anda iki cihazda/iki sekmede senkron → XP **iki kez** artmaz.
- [ ] Görev ödülünü iki kez hızlıca bas → ikincisi “zaten alındı” döner.
- [ ] `curl -X POST .../functions/v1/admin-action -d '{"action":"login","username":"P4SH4","passHash":"<hash>"}'`
      → `{ "token": ... }`; `admin_not_configured` geliyorsa Secrets eksik.
- [ ] Token'suz `{"action":"adjust",...}` → `403 forbidden`.
- [ ] Kurarma: `recovery_hash` anon key ile okunamaz
      (`SELECT recovery_hash FROM profiles` anon rolüyle → hata).
- [ ] `SELECT neg_xp, neg_gold FROM daily_earnings LIMIT 1;` → kolonlar var.

SQL kontrolü:

```sql
SELECT indexname FROM pg_indexes
 WHERE schemaname='public'
   AND indexname IN ('sync_requests_created_idx','team_members_one_team_idx',
                     'duels_active_unordered_idx','admin_logs_request_id_idx');
SELECT conname FROM pg_constraint WHERE conname LIKE '%_nonneg';
SELECT grantee, privilege_type FROM information_schema.column_privileges
 WHERE table_name='profiles' AND column_name='recovery_hash';
-- beklenen: yalnızca postgres/service_role
```

---

## 5) Bilinen sınırlılıklar (bilinçli kararlar)

1. **Supabase Auth yok.** Kimlik hâlâ kullanıcı adı + yerel şifre. Tüm
   uçlar (sync/recovery/duel) bu yüzden kullanıcı ADINI istemci beyanı
   olarak alır; koruma katmanları günlük/negatif tavanlar, atomik geçişler
   ve idempotency ile kuruldu. Tam geçiş planı: email+password ile
   Supabase Auth'a taşınmak, `profiles` tablosuna `auth_user_id` eklemek ve
   tüm Edge Function'ları `Authorization` doğrulamasına almak — bu,
   depolanan kullanıcı verisini etkilediği için AYRI bir göç projesidir.
2. **Edge Function'larda “Verify JWT” kapalı.** Uçlar kamuya açıktır;
   koruma tamamen fonksiyon kodundadır (hız sınırı, tavan, atomiklik,
   idempotency). Ağ geçidinde (Gateway/Cloudflare) oran sınırı eklemek önerilir.
3. **Hız sınırları bellek içi** ve instance başına çalışır; soğuk start'ta
   sıfırlanır. Kritik sayaçlar (günlük tavan) veritabanında tutulur.
4. **Negatif delta kıstırması** kasıtlı olarak günlük biriktirmelidir;
   yedek geri yükleme gibi çok büyük düşüşler sunucuya tam yansımayabilir
   (cihaz yerel değeri korur). Sınır: -500 XP / -300 🪙 günde.
