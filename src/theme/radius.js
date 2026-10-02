// ============================================================
// radius.js — v3 köşe yarıçapı: 4 değer + full
//
// Kural: YALNIZCA sm(8) · md(12) · lg(16) · xl(20) · full(999).
// Bu değerlerin DIŞINDA radius YOK (14/18/24/26/27/28/32 ... YASAK).
// Hard-coded borderRadius yazma; buradaki token'lardan kullan.
//
// ---------- NE ZAMAN KULLANILIR ----------
// sm  8   → Küçük iç öğe (checkbox, mini rozet, görsel kırpma).
// md  12  → Kontrol öğeleri: chip, buton, input, ikon kutusu.
// lg  16  → Orta yüzey: CARD (tüm kartlar aynı), toast, modal gövde.
// xl  20  → Büyük yüzey: sheet, tam ekran kart.
// full    → Tam yuvarlak: pill, avatar, progress track, tab bar.
//
// SEMANTIC ALIAS — eski adlar korunur, hepsi yukarıdaki 5 değere bağlı:
//   card 20 · control 12 · sheet 20 · chip 12 · tile 12 · pill 999
//   (alias'lar KALDIRILMAZ: 59 import eden dosya kırılır.)
//
// Kural: bir ekranda en fazla 2 farklı radius (kart 16-20 + kontrol 12).
// ============================================================
export const RADIUS = {
  // ---------- Ölçek (4 + full) ----------
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,

  // ---------- Semantic alias (geriye dönük uyum) ----------
  card: 20,
  control: 12,
  sheet: 20,
  chip: 12,
  tile: 12,
  pill: 999,
};

export default RADIUS;
