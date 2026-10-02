// ============================================================
// animations.js — v3 hareket token'ları
//
// Süre bandı: fast(150) · normal(200) · slow(300). 300ms ÜSTÜ YOK.
// Easing: easeOut / easeInOut = cubic-bezier(0.4, 0, 0.2, 1).
// LOOP / withRepeat YASAK — sonsuz döngülü animasyon yok.
// GLOW YASAK — hareket yalnız scale/fade/renk geçişi.
//
// ---------- NE ZAMAN KULLANILIR ----------
// DURATION.fast   150 → Basınç geri bildirimi (press in/out), odak geçişi.
// DURATION.normal 200 → VARSAYILAN. Görünür durum değişimi, fade, renk/boyut.
// DURATION.slow   300 → Yalnız büyük yüzey geçişi (modal, bölüm kayması).
//                      EKRAN BAŞINA EN FAZLA 1.
//
// EASE.out    → VARSAYILAN (hızlı başlar, yumuşak durur).
// EASE.inOut  → İki durum arasında salınım (progress, scrub).
//
// KURAL:
//   • Yeni animasyonda süre BU token'lardan seçilir; sabit sayı YAZMA.
//   • Sonsuz döngülü animasyon YOK (LOOP = null).
//   • reduced-motion: useReducedMotion ile atla.
//   • Reanimated: animasyon başlatan bileşen unmount'ta cancelAnimation.
// ============================================================

export const DURATION = {
  fast: 150,
  normal: 200,
  slow: 300,
};

export const EASE = {
  out: [0.4, 0, 0.2, 1],
  inOut: [0.4, 0, 0.2, 1],
};

// Sonsuz döngülü animasyon yok (v3 kuralı). Export geriye dönük uyum için korunur.
export const LOOP = null;

// Hareket dili — useTheme().motion (eski MOTION importları için).
// Eski adlar (tap/quick/standard) alias olarak korunur → yeni süreler.
export const MOTION = {
  fast: DURATION.fast,
  normal: DURATION.normal,
  slow: DURATION.slow,
  // alias
  tap: DURATION.fast,
  quick: DURATION.normal,
  standard: DURATION.normal,
  // Mikro etkileşim için tek yumuşak spring profili (loop YOK).
  spring: { damping: 18, stiffness: 340, mass: 0.8 },
  springSoft: { damping: 20, stiffness: 260, mass: 0.9 },
  easeOut: EASE.out,
  easeInOut: EASE.inOut,
};

export default MOTION;
