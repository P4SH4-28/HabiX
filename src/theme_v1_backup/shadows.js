// ============================================================
// shadows.js — Katmanlı gölge token'ları (iOS shadow* + Android elevation)
//   card     → sadece yüzey ayırımı (subtle)
//   elevated → öne çıkan yüzey (modal / sticky)
//   glow()   → renkli dış ışıma (mevcut davranış birebir korunur)
// ============================================================
import { Platform } from 'react-native';

const ios = (height, radius, opacity) => ({
  shadowColor: '#000000',
  shadowOpacity: opacity,
  shadowRadius: radius,
  shadowOffset: { width: 0, height },
});

export const SHADOWS = {
  card: Platform.select({
    ios: ios(6, 14, 0.28),
    android: { elevation: 2 },
    default: ios(6, 14, 0.28),
  }),
  elevated: Platform.select({
    ios: ios(14, 28, 0.4),
    android: { elevation: 8 },
    default: ios(14, 28, 0.4),
  }),
};

// Renkli dış ışıma: glow(C.primary, { radius, opacity, offset, elevation })
export function glow(color, opts = {}) {
  const { radius = 16, opacity = 0.35, offset = 6, elevation = 8 } = opts;
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: { width: 0, height: offset },
    elevation,
  };
}

export default SHADOWS;
