// ============================================================
// Button.js — Premium buton primitive'i (v3)
//
//   variant: primary | secondary | ghost | danger
//   size:    sm (44) | md (46) | lg (52)
//   NOT: box `minHeight` + sabit pv kullanır — sabit `height` DEĞİL.
//   Sebep: height − 2*pv < Text lineHeight olursa overflow:hidden etiketi
//   klipler ("yarım kaymış" metin). minHeight'da içerik kutuyu asla aşmaz.
//   loading  → ActivityIndicator (metin yerine), layout ZIPLAMAZ
//   disabled → soluk görünüm (0.45), basış kapalı
//   icon     → React node veya emoji string; iconPosition left|right
//   fullWidth→ kapsayıcıya stretch
//   press    → scale 0.97 / 100ms ease-out · release → spring / ~150ms
//              (reduce-motion'da kapalı, unmount'ta cancelAnimation)
//
//   GLOW YOK · GRADIENT YOK · LOOP YOK — düz renk + 1px border.
//
//   Geriye dönük uyum (GradientButton API): iconRight, compact,
//   colors[], start/end, haptic, textStyle, accessibilityLabel.
// ============================================================
import { memo, useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Text from './Text';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { tap } from '../../services/sfx';
import useReducedMotion from '../../hooks/useReducedMotion';
import { DURATION, EASE, useTheme } from '../../theme';
import Icon from './icons';

// pv: satır içi dikey boşluk (grid 12). minHeight = 2*pv + en büyük lineHeight
// (sm 13/20 → 44, md 15/22 → 46, lg 17/26 → 52): etiket hiçbir boyutta taşmaz.
const SIZES = {
  sm: { height: 44, pv: 12, ph: 16, font: 13, icon: 14 },
  md: { height: 46, pv: 12, ph: 20, font: 15, icon: 16 },
  lg: { height: 52, pv: 12, ph: 24, font: 17, icon: 18 },
};

const SPRING = { damping: 18, stiffness: 340, mass: 0.8 };
const GAP = 6;
const DISABLED_OPACITY = 0.45;

function renderGlyph(node, size, color) {
  if (node == null || node === false) return null;
  if (typeof node === 'string') return <Icon emoji={node} size={size} color={color} />;
  return node;
}

function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  // ---- geriye dönük uyum (GradientButton API) ----
  iconRight,
  compact,
  colors,
  haptic = true,
  textStyle,
  accessibilityLabel,
}) {
  const { colors: C, radius } = useTheme();
  const reduced = useReducedMotion();
  const styles = useMemo(() => makeStyles(C, radius), [C, radius]);
  const s = SIZES[compact ? 'sm' : size] || SIZES.md;
  const off = !!disabled || loading;

  const filled = variant === 'primary' || variant === 'danger';
  const bg =
    Array.isArray(colors) && colors.length > 0
      ? colors[0]
      : variant === 'danger'
        ? C.danger
        : variant === 'primary'
          ? C.primary
          : 'transparent';
  const fg = filled ? C.onPrimary || C.text : C.text;

  const scale = useSharedValue(1);
  // Prensip: animasyon başlatan her bileşen unmount olurken iptal etmeli.
  useEffect(() => () => cancelAnimation(scale), [scale]);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const pressIn = () => {
    if (off) return;
    if (!reduced) {
      scale.value = withTiming(0.97, {
        duration: DURATION.fast,
        easing: Easing.bezier(...EASE.out),
      });
    }
    if (haptic) tap();
  };
  const pressOut = () => {
    if (off) return;
    if (!reduced) scale.value = withSpring(1, SPRING);
  };

  const leftGlyph = iconPosition === 'left' ? icon : null;
  const rightGlyph = iconPosition === 'right' ? icon : iconRight;

  const boxStyle = [
    styles.box,
    // minHeight: içerik lineHeight'u ne olursa olsun kutu metni KLIPLER.
    { minHeight: s.height, paddingVertical: s.pv, paddingHorizontal: s.ph, backgroundColor: bg },
    variant === 'secondary' && styles.outline,
    off && styles.off,
  ];

  return (
    <Animated.View
      style={[styles.wrap, fullWidth && styles.full, style, aStyle]}
    >
      <Pressable
        onPress={off ? undefined : onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={off}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || (typeof label === 'string' ? label : undefined)}
        accessibilityState={{ disabled: off, busy: loading }}
        // sm (44) tam dokunma hedefi; sadece 44 altındaki boyutlarda tamamlanır.
        // görsel ölçü değişmez, yalnız hedef büyür.
        hitSlop={
          s.height >= 44 ? undefined : { top: (44 - s.height) / 2, bottom: (44 - s.height) / 2, left: 4, right: 4 }
        }
      >
        <View style={boxStyle}>
          {loading ? (
            <ActivityIndicator size="small" color={fg} />
          ) : (
            <>
              {leftGlyph ? renderGlyph(leftGlyph, s.icon, fg) : null}
              <Text
                style={[styles.label, { color: fg, fontSize: s.font }, textStyle]}
                numberOfLines={1}
              >
                {label}
              </Text>
              {!loading && rightGlyph ? renderGlyph(rightGlyph, s.icon, fg) : null}
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function makeStyles(C, radius) {
  return StyleSheet.create({
    wrap: { borderRadius: radius.md },
    full: { alignSelf: 'stretch' },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GAP,
    borderRadius: radius.md,
    overflow: 'hidden',
    // Dar kaplarda (grid kartı, 2 sütun) buton taşmasın: içerik
    // sıkışsın, etiket kırpılsın — dışarı taşmasın.
    flexShrink: 1,
    minWidth: 0,
  },
  outline: { borderWidth: 1, borderColor: C.border },
  off: { opacity: DISABLED_OPACITY },
  label: {
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
});
}

export default memo(Button);
