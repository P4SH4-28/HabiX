// ============================================================
// Progress.js — Animasyonlu ilerleme çubuğu (ortak primitive).
// Değer değişince yumuşakça kayar; reduce-motion'da anında gider.
// Performans: transform:scaleX + transformOrigin:left (GPU dostu);
// köşe yuvarlatmaları track'in overflow:hidden ile kırpmasıyla
// bozulmadan korunur (fill'de radius yok → deformasyon yok).
//   <Progress value={0.42} colors={[C.accent, C.primary]} />
// ============================================================
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import useReducedMotion from '../../hooks/useReducedMotion';

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export default function Progress({
  value = 0,
  height = 10,
  colors,
  trackColor,
  style,
  accessibilityLabel,
}) {
  const { colors: C, radius } = useTheme();
  const reduced = useReducedMotion();
  const target = clamp01(value);
  const p = useSharedValue(target);

  useEffect(() => {
    if (reduced) {
      p.value = target;
    } else {
      p.value = withTiming(target, { duration: 320 });
    }
  }, [target, reduced, p]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: p.value }],
  }));

  const grad = colors || [C.accent, C.primary];

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(target * 100),
        ...(accessibilityLabel ? { text: accessibilityLabel } : {}),
      }}
      style={[
        styles.track,
        {
          height,
          borderRadius: Math.max(height / 2, 3),
          backgroundColor: trackColor || C.surfaceLight,
        },
        style,
      ]}
    >
      <Animated.View style={[styles.fillWrap, fillStyle]}>
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    width: '100%',
  },
  fillWrap: {
    ...StyleSheet.absoluteFillObject,
    transformOrigin: 'left',
  },
});
