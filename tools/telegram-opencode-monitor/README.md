# Telegram OpenCode Monitor

OpenCode oturumlarini (Windows) izleyip one cikan olaylari Telegram'a
bildiren **bagimsiz, hafif ve guvenli** bir arac. OpenCode'a YAZMAZ,
sadece OKUR. HabitTracker `src/` koduna dokunmaz.

## Ozellikler

| Olay | Mesaj |
|---|---|
| OpenCode basladi / tespit edildi | 🟢 OpenCode basladi |
| Is turu tamamlandi (butun todo'lar bitti) | 🟢 Gorev tamamlandi + sure + todo ozeti |
| Is turu bitti, girdi bekleniyor | 🟡 Kullanici girdisi bekliyor |
| Izin/permission bekleniyor | 🟡 OpenCode izin bekliyor |
| Arac (tool) hatasi | 🔴 Hata + kisa ozet |
| 30/60/120/240 dk sure (her esik 1 kez) | ⏳ Hala calisiyor |
| Tum OpenCode prosesleri kapandi | ⚪ Oturum kapandi |

Spam koruması: ayni olay icin yalnizca 1 bildirim
(`state/state.json` gecerlidir). Telegram'dan PC'ye komut kanali **yoktur**.

## Kurulum

### 1) Token (zorunlu)

Sohbete token GONDERMEYIN. Iki guvenli yontemden biri:

**A) Lokal `.env` dosyasi (onerilen):**

```powershell
notepad .\tools\telegram-opencode-monitor\.env
```

`.env.example`'i kopyalayip degerleri dosyaya yapistirin.
Dosya `.gitignore` ile git'e girmez.

**B) Windows user environment variable:**

```powershell
[Environment]::SetEnvironmentVariable("TELEGRAM_BOT_TOKEN", "<token>", "User")
[Environment]::SetEnvironmentVariable("TELEGRAM_CHAT_ID", "<chatid>", "User")
```

Degerler kaynagi (notify.py sirasiyla): islem env -> Windows registry
(HKCU/HKLM) -> lokal `.env`. `.env` degisince calisirken de yeniden okunur.
Sadece `https://api.telegram.org`'a istek atilir.

**CHAT_ID bulunamadiysa (hata: `chat not found`):**

1. Telefonda botu acip **/start** gonderin.
2. Sonra su komutu calistirin (chat id terminale YAZILMAZ, `.env`'e kendisi yazar):

```powershell
.\telegram-chatid.ps1
```

### 2) Test

```powershell
cd C:\Users\KPLN\Desktop\HabitTracker\tools\telegram-opencode-monitor
.\telegram-test.ps1
```

`PASS` => Telegram'a 🟢 mesaji gitti demektir.

## Kullanim

```powershell
.\start-monitor.ps1        # arka planda baslat (10 sn'lik hafif dongu)
.\monitor-status.ps1       # ne goruyor? (prosesler, oturumlar, durum)
.\stop-monitor.ps1         # sadece kendi prosesini durdurur
```

Ek testler:

```powershell
python .\monitor.py --self-test          # 29 mantik testi (ag yok, gonderim yok)
python .\monitor.py --once --dry-run     # tek dongu, mesaj gondermez
python .\monitor.py --demo completed     # ornek "tamamlandi" mesaji gonderir
python .\monitor.py --demo error         # ornek "hata" mesaji gonderir
```

## Tespit mantigi (kisa)

Veri kaynagi: `%USERPROFILE%\.local\share\opencode\opencode.db`
(SQLite, **salt okunur**; okuma maliyeti ~0.1-30 ms/dongu).

1. **Aktiflik**: `part/message/session` yazma zaman damgasi son 60 sn icinde,
   VEYA yardimci mesaj `time.completed` alanina sahip degil (dusunme/akisa devam),
   VEYA `running` tool var. (Uzun API beklemlerinde yanlis "bitti" denmez.)
2. **Tur sonu**: yardimci mesaj `time.completed` dolu + yazma tazeligi 60 sn
   gectiginde karar verilir (izin > hata > tamamlandi > girdi bekliyor).
3. **Emin olunamayan durum** (mesaj tamamlanmamis, sikisma, proses yok):
   **hicbir mesaj gonderilmez** (yanlis pozitif oncelikli).
4. Proses yokluguna bakilir ama tek basina "tamamlandi" sayilmaz.
5. `parent_id` olan subagent oturumlari izlenmez.

Dizinin adi "HabitTracker" iceriyorsa mesajlarda `📁 HabitTracker` kullanilir.

## Arka plan calistirma

`start-monitor.ps1` gizli bir arka plan PowerShell/python process'i baslatir
(registry, startup klasyoru, servis DEGISTIRILMEZ). Bilgisayar yeniden
basladiginda kendiliginden baslamaz.

Istenirse (izin verildiginde) Windows Task Scheduler ile kalicilastirilabilir
(asagidaki komut HAZIRDIR, **calistirilmamistir**):

```powershell
schtasks /Create /TN "OpenCodeTelegramMonitor" /SC ONLOGON /RL LIMITED `
  /TR "powershell.exe -NoProfile -WindowStyle Hidden -File \"C:\Users\KPLN\Desktop\HabitTracker\tools\telegram-opencode-monitor\start-monitor.ps1\""
```

Kaldirmak icin: `schtasks /Delete /TN "OpenCodeTelegramMonitor" /F`

## Dosyalar

```
tools/telegram-opencode-monitor/
  notify.py          Telegram gonderimi + guvenli token okuma/masking
  monitor.py         state machine, DB izleme, self-test, status, demo
  common.ps1         Python bulucu
  telegram-test.ps1  baglanti testi
  telegram-chatid.ps1 chat id'yi bulur ve .env'e yazar (maskeleli cikti)
  start-monitor.ps1  arka planda baslat
  stop-monitor.ps1   durdur (yalnizca kendi prosesi)
  monitor-status.ps1 durum raporu
  .env.example       sablon (deger icermemeli)
  state/             state.json, monitor.log, pid/lock (gitignored)
```

## Guvenlik

- Token hicbir loga, mesaja, ciktiga, state dosyasina yazilmaz; `mask()`
  her ciktiyi temizler.
- Secret taramasi: `git grep` / `rg` ile token formati aranir; token repo'ya
  girerse **rotation** yapilmalidir.
- Telegram'dan gelen veri yoktur, komut calistirma yoktur (PC -> Telegram).
- Monitor yalnizca `tasklist` + SQLite `SELECT` yapar; OpenCode config,
  proses onceligi, terminal, API, session dosyalarina DOKUNMAZ.

## Sorun giderme

| Belirti | Kontrol |
|---|---|
| Mesaj gelmiyor | `.\telegram-test.ps1` -> FAIL ise token/chat id kontrolu |
| `FAIL config=...` | `.env` veya env var tanimli degil |
| `chat not found` | Bot'a `/start` gonderin, sonra `.\telegram-chatid.ps1` |
| Monitor baslamiyor | `state\monitor.err` icine bakin |
| Ne goruyor | `.\monitor-status.ps1` |
| Ayrintili log | `state\monitor.log` |
