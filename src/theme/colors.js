// ============================================================
// colors.js — v3 palet (Design System, 1. saat)
//
// Kural: TOKEN ADLARI DEĞİŞMEZ (59 import / 1000+ kullanım kırılmaz),
// yalnızca değerler değişir. Yeni anlamsal adlar alias olarak EKLENİR.
//
// Yapı: 4 NÖTR + 3 ANLAMSAL + YARDIMCILAR
//
// ---------- NE ZAMAN KULLANILIR ----------
// background   → Ekran zemini. Her ekranın container'ı. (ekran başına 1)
// surface      → Kart yüzeyi. Card/ListRow/tab bar zemini.
// surfaceLight → Kart ÜSTÜ alt yüzey (pill, chip, aktif satır zemini).
//                Farklı KATMANLAR arasında kullan; aynı katmanda kullanma.
// border       → 1px ayırıcı. Yalnız gerekli yerlerde (1px kuralı).
//
// primary      → Birincil eylem (buton, aktif sekme, link, odak).
// success      → BAŞARI: tamamlanan alışkanlık, seri devam ediyor. (accent alias)
// danger       → YIKICI eylem (sil, iptal) + hata mesajı.
//
// text         → Birincil metin.
// textMuted    → İkincil/yardımcı metin, açıklama, etiket.
// warning      → DİKKAT/seri: toast, XP artışı, bekleme. EKRAN BAŞINA ≤1.
// gold / xp    → YALNIZ oyunlaştırma bağlamı (ödül, seviye, para birimi).
// silver/bronze→ Yalnız sıralama/rozet (1-2-3.).
// onPrimary    → primary zemini üzerinde metin/ikon.
// primaryDark  → DEPRECATED (gradient kalktı). Kodda kalmalı, çağrılmamalı.
// pattern      → Ekran deseni. v3'te null (desen yok).
//
// ---------- WCAG AA KONTRAST (koyu zemin üzeri, min 4.5:1) ----------
//   text        on background   19.75 ✓      textMuted on surface      5.33 ✓
//   text        on surface      18.12 ✓      textMuted on surfaceLight 4.78 ✓
//   text        on surfaceLight 16.23 ✓      primary   on surface      4.97 ✓
//   textMuted   on background    5.82 ✓      danger    on surface      5.32 ✓
//   success     on surface       8.96 ✓      warning   on surface      8.81 ✓
//   gold        on surface      12.84 ✓      primary   on background   5.42 ✓
//   NOT: onPrimary (#FFFFFF) on primary (#0A84FF) = 3.65 → yalnızca
//   LARGE text (≥18.66px bold) AA; dolu buton etiketleri Apple konvansiyonu
//   ile beyaz kalır. Sıkı AA gerekiyorsa buton zemini #0A6CFF (4.56) önerilir.
//   border renkleri metin değil, dekoratiftir (kontrast şartı yok).
// ============================================================

// ---------- 4 NÖTR ----------
const NEUTRAL = {
  background: '#0A0A0F', // koyu zemin (eski #000000)
  surface: '#15151F', // kart yüzeyi
  border: '#2A2A3A', // 1px ayırıcı
  text: '#FFFFFF', // birincil metin
};

// ---------- 3 ANLAMSAL ----------
const SEMANTIC = {
  primary: '#0A84FF', // Apple blue  — eylem
  success: '#30D158', // Apple green — başarı
  danger: '#FF453A', // Apple red   — yıkıcı eylem / hata
};

// ---------- YARDIMCI (korunur) ----------
const SUPPORT = {
  // nötr ailenin uzantısı
  surfaceLight: '#1F1F2E', // üst katman yüzeyi
  textMuted: '#8A8A9A', // ikincil metin
  onPrimary: '#FFFFFF', // dolu zemin üzeri metin/ikon

  // anlamsal alias (eski adlar korunur → success/danger ile aynı aile)
  accent: '#30D158', // alias → success (temalar accent'i override eder)
  warning: '#FF9F0A', // dikkat/seri

  // oyunlaştırma
  gold: '#FFD60A',
  xp: '#FF9F0A',
  silver: '#C0C8D8',
  bronze: '#D98E5A',

  // DEPRECATED: gradient kaldırıldı. Kodda kalmalı, kullanılmamalı.
  primaryDark: '#0A84FF',

  // Ekran deseni kapalı (v3 kimliği: sade, desensiz).
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
