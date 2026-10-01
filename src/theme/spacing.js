// ============================================================
// spacing.js — 8dp grid boşluk skalası
// Yeni kodda space.* token'ı kullan; piksel sabitleme (padding: 18 vb.) YOK.
//   4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48
// ============================================================
export const SPACE = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
};

// Grid adımları (dokümantasyon/test için).
export const SPACE_STEPS = [4, 8, 12, 16, 20, 24, 32, 40, 48];

export default SPACE;
