// ============================================================
// Enter.js — Mount animasyonu sarmalayıcısı (premium giriş).
// Hızlı, amaçlı fade + translate/scale. Reanimated UI thread'de
// çalışır (JS kilitlenmesi yok). "Hareketi azalt" erişilebilirlik
// tercihi açıksa animasyon ATLANIR ve içerik anında görünür.
// ============================================================
import { useEffect } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import useReducedMotion from '../../hooks/useReducedMotion';

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

export default function Enter({
  children,
  delay = 0,
  duration = 340,
  y = 14,
  scale = 0,
  style,
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      p.value = 1;
      return undefined;
    }
    p.value = withDelay(delay, withTiming(1, { duration, easing: EASE }));
    return () => cancelAnimation(p);
  }, [delay, duration, reduced, p]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [
      { translateY: (1 - p.value) * y },
      { scale: 1 - (1 - p.value) * scale },
    ],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
