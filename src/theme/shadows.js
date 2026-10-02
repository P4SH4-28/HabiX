// ============================================================
// shadows.js — v3: TEK gölge (card). Ağır gölgeler ve glow KALDIRILDI.
//
// v1 kimliği: her kartta gölge + 15 renkli glow → görsel gürültü.
// v3 kimliği: yüzey ayrımı RENK KATMANI ile yapılır (background →
// surface → surfaceLight). Gölge yalnız "yüzen" yüzeyde (elevated).
//
// ---------- NE ZAMAN KULLANILIR ----------
// SHADOWS.card → Yalnız Card variant="elevated".
//                iOS: 0 4 12 rgba(0,0,0,0.15) · Android: elevation 2.
//                Ekran başına en fazla 1-2 adet.
// glow()       → NO-OP ({}). v3'te renkli ışıma YOKTUR (GLOW YASAK).
//                Çağrı imzası korunur; yeni kodda KULLANMA.
// ============================================================
import { Platform } from 'react-native';

const ios = {
  shadowColor: '#000000',
  shadowOpacity: 0.15,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
};

export const SHADOWS = {
  card: Platform.select({
    ios,
    android: { elevation: 2 },
    default: ios,
  }),
};

// DEPRECATED (v3): renkli dış ışıma kaldırıldı.
// Geriye dönük uyum için çağrı imzası korunur, boş nesne döner.
export function glow(/* color, opts */) {
  return {};
}

export default SHADOWS;
