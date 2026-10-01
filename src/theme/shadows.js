// ============================================================
// shadows.js — v2 minimal: GÖLGE NEREYSE YOK, yalnız modal.
//
// v1 kimliği: her kartta SHADOWS.card + 15 renkli glow → görsel gürültü.
// v2 kimliği: yüzey ayrımı RENK KATMANI ile yapılır (background →
// surface → surfaceLight), gölge/glow DEĞİL. Bu yüzden:
//
// ---------- NE ZAMAN KULLANILIR ----------
// SHADOWS.card     → ARTIK BOŞ {}. Kartlar gölgesiz; zemin/surface
//                    kontrastı ayırımı sağlar. `flat` prop'u anlamsızlaştı
//                    (zararsız, Parça 2'de kaldırılır).
// SHADOWS.elevated → YALNIZ modal / sheet / tab bar gibi "yüzen" yüzey.
//                    Ekran başına en fazla 1.
// glow()           → NO-OP ({}). v2'de renkli ışıma YOKTUR.
//                    15 çağrı KOD KIRILMADAN görsel olarak kalkar;
//                    Parça 2'de tek tek silinecek.
// ============================================================
import { Platform } from 'react-native';

const ios = (height, radius, opacity) => ({
  shadowColor: '#000000',
  shadowOpacity: opacity,
  shadowRadius: radius,
  shadowOffset: { width: 0, height },
});

export const SHADOWS = {
  // Kart gölgesi yok — yüzey kontrastı yeterli.
  card: {},

  // Yüzen yüzey (modal/sheet): tek gölge tanımı.
  elevated: Platform.select({
    ios: ios(12, 32, 0.45),
    android: { elevation: 8 },
    default: ios(12, 32, 0.45),
  }),
};

// DEPRECATED (v2): renkli dış ışıma kaldırıldı.
// Geriye dönük uyum için çağrı imzası korunur, boş nesne döner.
// Yeni kodda KULLANMA; Parça 2'de tüm çağrılar silinecek.
export function glow(/* color, opts */) {
  return {};
}

export default SHADOWS;
