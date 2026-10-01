// ============================================================
// colors.js — v2 palet (Apple Fitness/Headspace zemini + Linear disiplini)
//
// Kural: TOKEN ADLARI DEĞİŞMEZ (59 import / 1000+ kullanım kırılmaz),
// yalnızca değerler değişir. Yeni anlamsal adlar alias olarak EKLENİR.
//
// ---------- NE ZAMAN KULLANILIR ----------
// background   → Ekran zemini. Her ekranın container'ı. (ekran başına 1)
// surface      → Kart yüzeyi. Card/ListRow/tab bar zemini.
// surfaceLight → Kart ÜSTÜ alt yüzey (pill, chip, aktif satır zemini).
//                Farklı KATMANLAR arasında kullan; aynı katmanda kullanma.
// border       → 1px ayırıcı. Yalnız farklı katmanlar arasında. 109→~30 hedefi.
//
// primary      → Birincil eylem (buton, aktif sekme, link, odak).
//                EKRAN BAŞINA 1. Gradient KALKTI → düz renk.
// accent       → BAŞARI: tamamlanan alışkanlık, seri devam ediyor, olumlu.
//                EKRAN BAŞINA ≤2.
// warning      → DİKKAT/seri: toast, XP artışı, bekleme. EKRAN BAŞINA ≤1.
// danger       → YIKICI eylem (sil, iptal) + hata mesajı.
//
// text         → Birincil metin.
// textMuted    → İkincil/yardımcı metin, açıklama, etiket.
// gold / xp    → YALNIZ oyunlaştırma bağlamı (ödül, seviye, para birimi).
// silver/bronze→ Yalnız sıralama/rozet (1-2-3.).
// onPrimary    → primary zemini üzerinde metin/ikon.
// primaryDark  → DEPRECATED (gradient kaldırıldı). Kodda kalmalı,
//                Parça 2'de kullanım yerleri temizlenecek.
// pattern      → Ekran deseni. v2'de null (desen yok).
// ============================================================

// ---------- 4 NÖTR ----------
const NEUTRAL = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceLight: '#2C2C2E',
  border: '#2C2C2E',
};

// ---------- 3 ANLAMSAL ----------
const SEMANTIC = {
  primary: '#0A84FF', // Apple blue   — eylem
  accent: '#30D158', // Apple green  — başarı
  warning: '#FF9F0A', // Apple orange — dikkat/seri
};

// ---------- YARDIMCI (korunur) ----------
const SUPPORT = {
  danger: '#FF453A', // Apple red — yıkıcı eylem
  gold: '#FFD60A', // Apple yellow — ödül/para
  xp: '#FF9F0A', // ödül puanı (warning ile aynı ton)
  silver: '#C0C8D8',
  bronze: '#D98E5A',

  text: '#FFFFFF',
  textMuted: '#98989F', // Apple grey 3 — okunur ikincil metin
  onPrimary: '#FFFFFF',

  // DEPRECATED: gradient kaldırıldı; Parça 2'de temizlenecek.
  primaryDark: '#0A84FF',

  // Ekran deseni kapalı (v2 kimliği: sade, desensiz).
  pattern: null,
};

export const COLORS = {
  ...NEUTRAL,
  ...SEMANTIC,
  ...SUPPORT,
};

// Tema/eksen adları (dokümantasyon + test için).
export const COLOR_GROUPS = {
  neutral: Object.keys(NEUTRAL),
  semantic: Object.keys(SEMANTIC),
  support: Object.keys(SUPPORT),
};

export default COLORS;
