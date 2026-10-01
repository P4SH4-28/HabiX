// ============================================================
// Button.js — Birleşik buton primitive'i
//   variant: primary (gradient) | secondary (outline) | ghost | danger
//   size:    sm (36) | md (48) | lg (54)
//   loading  → spinner, çift basma kapanır
//   icon     → sol emoji (GradientButton ile aynı API)
//   press    → scale 0.96 / 100ms (reduced-motion'da kapalı)
//   haptic   → varsayılan açık (services/sfx tap)
// ============================================================
import { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { tap } from '../../services/sfx';
import useReducedMotion from '../../hooks/useReducedMotion';
import { useTheme } from '../../theme';
import Icon from './icons';

const SIZES = {
  sm: { pv: 9, ph: 14, font: 13, minH: 36, icon: 13 },
  md: { pv: 14, ph: 20, font: 15, minH: 48, icon: 15 },
  lg: { pv: 17, ph: 24, font: 17, minH: 54, icon: 17 },
};

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  disabled,
  loading = false,
  haptic = true,
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  compact = false,
  style,
  textStyle,
  accessibilityLabel,
}) {
  const { colors: C, radius } = useTheme();
  const reduced = useReducedMotion();
  const s = SIZES[compact ? 'sm' : size] || SIZES.md;
  const styles = useMemo(() => makeStyles(C, radius), [C, radius]);
  const off = !!disabled || loading;

  const boxStyle = useMemo(
    () => ({
      paddingVertical: s.pv,
      paddingHorizontal: s.ph,
      minHeight: s.minH,
      borderRadius: radius.control,
    }),
    [s, radius.control]
  );

  const scale = useSharedValue(1);
  // Prensip: animasyon başlatan her bileşen unmount olurken iptal etmeli.
  useEffect(() => () => cancelAnimation(scale), [scale]);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const pressIn = useCallback(() => {
    if (off) return;
    if (!reduced) scale.value = withTiming(0.96, { duration: 100 });
    if (haptic) tap();
  }, [off, reduced, haptic, scale]);
  const pressOut = useCallback(() => {
    if (off) return;
    if (!reduced) scale.value = withTiming(1, { duration: 160 });
  }, [off, reduced, scale]);

  const isGradient = variant === 'primary' || variant === 'danger';
  const gradient = colors || (variant === 'danger' ? [C.danger, C.danger] : [C.primary, C.primaryDark]);
  const fg =
    variant === 'secondary' || variant === 'ghost' ? C.primary : C.onPrimary;

  const content = (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Icon emoji={icon} size={s.icon} color={fg} style={styles.icon} />
      ) : null}
      <Text
        style={[styles.label, { color: fg, fontSize: s.font }, off && styles.labelOff, textStyle]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {iconRight && !loading ? (
        <Icon emoji={iconRight} size={s.icon} color={fg} style={styles.iconRight} />
      ) : null}
    </>
  );

  return (
    <Animated.View style={[styles.wrap, aStyle, style]}>
      <Pressable
        onPress={off ? undefined : onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={off}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || (typeof label === 'string' ? label : undefined)}
        accessibilityState={{ disabled: off, busy: loading }}
      >
        {isGradient ? (
          <LinearGradient
            colors={gradient}
            start={start}
            end={end}
            style={[styles.base, boxStyle, off && styles.off]}
          >
            {content}
          </LinearGradient>
        ) : (
          <View style={[styles.base, styles[variant], boxStyle, off && styles.off]}>
            {content}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function makeStyles(C, radius) {
  return StyleSheet.create({
    wrap: { borderRadius: radius.control, alignSelf: 'stretch' },
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
    ghost: { backgroundColor: 'transparent' },
    off: { opacity: 0.45 },
    icon: { marginRight: 7 },
    iconRight: { marginLeft: 7 },
    label: { fontWeight: '700', textAlign: 'center' },
    labelOff: { opacity: 0.7 },
  });
}
