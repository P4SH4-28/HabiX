// ============================================================
// animations.js — v2 hareket token'ları (200-300ms bandı)
//
// v1: 27 animasyonun %74'ü >200ms, %63'ü >300ms + 4 sonsuz döngü
//     → algılanan yavaşlık ve sürekli "uğultu".
// v2: bant 200-300ms, ease-out; sonsuz döngü YASAK.
//
// ---------- NE ZAMAN KULLANILIR ----------
// DURATION.tap    120 → Basınç geri bildirimi (press in/out), hafif scale.
// DURATION.base   200 → VARSAYILAN. Görünür durum değişimi, giriş fade,
//                        renk/boyut geçişi. YENİ ANİMASYON İÇİN ÖNCE BU.
// DURATION.slow   300 → Yalnız büyük yüzey geçişi (modal açılışı, bölüm
//                        kayması). EKRAN BAŞINA EN FAZLA 1.
//
// EASE.out    → VARSAYILAN (hızlı başlar, yumuşak durur). Apple/Linear eğrisi.
// EASE.inOut  → Yalnız iki durum arasında salınım (progress, scrub).
//
// KURAL:
//   • Yeni animasyonda süre BU token'lardan seçilir; sabit sayı YAZMA.
//   • Sonsuz döngülü animasyon YOK (loop token'ı null).
//    – Skeleton shimmer, boş durum bounce, heatmap pulse gibi
//      tekrarlayan hareketler KALDIRILACAK (Parça 2/3).
//      Bunların yerine: tek seferlik giriş animasyonu ya da hiç.
//   • reduced-motion: her animasyon useReducedMotion ile atlanmalı.
//   • Reanimated: animasyon başlatan bileşen unmount'ta cancelAnimation.
// ============================================================

export const DURATION = {
  tap: 120,
  base: 200,
  slow: 300,
};

export const EASE = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
};

// Sonsuz döngülü animasyon yok (v2 kuralı).
export const LOOP = null;

// Hareket dili — useTheme().motion (eski MOTION importları için).
// v1'den devralınan adlar korunur; süreler 200-300 bandına çekildi.
export const MOTION = {
  tap: 120,
  quick: 200,
  standard: 240,
  slow: 300,
  // Spring: mikro etkileşim için tek yumuşak profil.
  spring: { damping: 18, stiffness: 340, mass: 0.8 },
  springSoft: { damping: 20, stiffness: 260, mass: 0.9 },
  springPop: { damping: 12, stiffness: 260, mass: 0.6 },
  easeOut: EASE.out,
  easeInOut: EASE.inOut,
};

export default MOTION;
