// ============================================================
// radius.js — v2 köşe yarıçapı: 5 değer (eski 26 → 5)
//
// Kural: YALNIZCA bu 5 değerden biri. Hard-coded borderRadius YOK.
// (Kod tabanında hâlâ ~200 kaçak var → Parça 2/3'te temizlenecek.)
//
// ---------- NE ZAMAN KULLANILIR ----------
// sm  8   → Küçük iç öğe (checkbox, mini rozet, görsel kırpma).
// md  12  → Kontrol öğeleri: chip, buton, input, ikon kutusu.
// lg  16  → Orta yüzey: sheet içi blok, toast, modal gövde.
// xl  20  → KART yüzeyi (varsayılan kart köşesi).
// full    → Tam yuvarlak: pill, avatar, progress track, tab bar.
//
// SEMANTIC ALIAS — eski adlar korunur, değerleri yeni ölçeğe bağlanır:
//   card 20 · control 12 · sheet 20 · chip 12 · tile 12 · pill 999
//
// Kural: bir ekranda en fazla 2 farklı radius (kart 20 + kontrol 12).
// ============================================================
export const RADIUS = {
  // ---------- Ölçek (5 değer) ----------
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
