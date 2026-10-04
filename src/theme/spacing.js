// ============================================================
// spacing.js — v3 boşluk grid'i: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48
//
// Kural: BOŞLUK YALNIZCA bu token'lardan. Piksel sabitleme YOK.
// Grid dışı değer (2, 6, 10, 14...) YAZMA.
//
// ---------- NE ZAMAN KULLANILIR ----------
// xs   4  → İkon ↔ metin arası mikro boşluk, iç içe minik öğeler.
// sm   8  → Aynı satırdaki öğeler arası, buton/ikon-label arası.
// md   12 → Kart içindeki blok arası; sm kart padding'i.
// lg   16 → Kart iç padding'i (sm kart) + satır iç boşluğu.
// xl   20 → VARSAYILAN KART İÇ PADDING'i; ekran gutter'ı (eski 16'dan aşağı taşındı).
// xxl  24 → EKRAN KENAR boşluğu + bölüm başlığı üstü nefes payı.
// 3xl  32 → Ekran başına/ayraç arası (hero altında).
// 4xl  40 → Bölüm sonu / büyük sahne boşluğu (ekran başına ≤2).
// 5xl  48 → Sahne tamponu (modal üstü, hero altı) — EN BÜYÜK.
//
// xxs  — KALDIRILDI (grid dışı; 4'ten küçük boşluk token'ı yok).
//
// Kural: beyaz alan artırmak istiyorsan ÖNCE iç padding'i düşür,
// dış boşluğu (xl) artır — ikisini aynı anda oynatma.
// ============================================================
export const SPACE = {
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

// Varsayılan kart iç padding (sık kullanılan sabit — token'a bağlı).
export const CARD_PADDING = 20;

export default SPACE;
