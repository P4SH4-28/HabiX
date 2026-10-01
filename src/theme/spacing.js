// ============================================================
// spacing.js — v2 sıkı boşluk grid'i
//
// Kural: BOŞLUK YALNIZCA bu token'lardan. Piksel sabitleme YOK.
// Adımlar arası en fazla 8 → daha sıkı, daha düzenli ritim.
//
// ---------- NE ZAMAN KULLANILIR ----------
// xs  4  → İç içe öğeler arası (ikon ↔ metin ayrıdır; genelde 8).
// sm  8  → Aynı satırdaki öğeler arası, chip iç boşluğu.
// md  12 → Kart içindeki blok arası.
// lg  16 → KART İÇ PADDING'i (varsayılan) + kartlar arası.
// xl  20 → Ekran kenar boşluğu (gutter).
// xxl 24 → Bölüm başlığı üstü büyük nefes payı.
// 3xl 32 → Ekran başına/ayna arası (hero altında).
//
// xxs 2  → Hairline hizalama (border/çizgi etrafı). Ara sıra.
//
// Kural: beyaz alan artırmak istiyorsan ÖNCE iç padding'i düşür,
// dış boşluğu (xl) artır — ikisini aynı anda oynatma.
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
};

// Grid adımları (dokümantasyon/test için).
export const SPACE_STEPS = [4, 8, 12, 16, 20, 24, 32];

// Varsayılan kart iç padding (sık kullanılan sabit — token'a bağlı).
export const CARD_PADDING = 16;

export default SPACE;
