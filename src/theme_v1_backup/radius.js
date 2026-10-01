// ============================================================
// radius.js — Köşe yarıçapı token'ları
//   sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · full 999
// Altındaki semantic alias'lar MEVCUT ekranlar tarafından kullanılıyor;
// değerleri korunur (görsel bozulma yok), yeni kod scale anahtarlarını kullanır.
// ============================================================
export const RADIUS = {
  // Ölçek (yeni kod bunları kullanır)
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,

  // Semantic alias'lar (geriye dönük uyum)
  card: 20,
  control: 14,
  sheet: 24,
  pill: 999,
  chip: 12,
  tile: 14,
};

export default RADIUS;
