// ============================================================
// Card.js — Yüzey primitive'i (v3)
//
//   variant: default (surface + 1px border) | elevated (gölge, bordersız)
//            | outline (saydam + 1px border) | filled (surfaceLight)
//   padding: none (0) | sm (12) | md (16, varsayılan) | lg (20)
//   radius : lg (16) — TÜM kartlar aynı
//   onPress → press scale 0.98 / 100ms (reduce-motion'da kapalı,
//             unmount'ta cancelAnimation)
//
//   İçerik children olduğu gibi render edilir: gap/flex YOK,
//   yön ve boşluk kullanıcıya ait. GLOW YOK · LOOP YOK.
// ============================================================
import { memo, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import useReducedMotion from '../../hooks/useReducedMotion';
import { DURATION, EASE, SHADOWS, useTheme } from '../../theme';

const PADDINGS = { none: 0, sm: 12, md: 16, lg: 20 };

function Card({
  children,
  variant = 'default',
  padding = 'md',
  onPress,
  style,
  accessibilityLabel,
}) {
  const { colors: C, radius } = useTheme();
  const reduced = useReducedMotion();
  const styles = useMemo(() => makeStyles(C, radius), [C, radius]);
  const pad = PADDINGS[padding] ?? PADDINGS.md;
  const interactive = typeof onPress === 'function';

  const scale = useSharedValue(1);
  // Prensip: animasyon başlatan her bileşen unmount olurken iptal etmeli.
  useEffect(() => () => cancelAnimation(scale), [scale]);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const pressIn = () => {
    if (!interactive || reduced) return;
    scale.value = withTiming(0.98, {
      duration: DURATION.fast,
      easing: Easing.bezier(...EASE.out),
    });
  };
  const pressOut = () => {
    if (!interactive) return;
    scale.value = withTiming(1, {
      duration: DURATION.fast,
      easing: Easing.bezier(...EASE.out),
    });
  };

  const boxStyle = [styles.box, styles[variant], style];

  if (!interactive) {
    return (
      <View style={boxStyle}>
        <View style={[styles.inner, { padding: pad }]}>{children}</View>
      </View>
    );
  }

  return (
    <Animated.View style={[boxStyle, aStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.inner, { padding: pad }]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function makeStyles(C, radius) {
  return StyleSheet.create({
    box: {
      borderRadius: radius.lg,
      backgroundColor: C.surface,
    },
    inner: {},
    default: { borderWidth: 1, borderColor: C.border },
    elevated: { ...SHADOWS.card },
    outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
    filled: { backgroundColor: C.surfaceLight },
  });
}

export default memo(Card);
