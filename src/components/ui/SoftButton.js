// ============================================================
// SoftButton.js — İkincil/soft buton (primary CTA GradientButton'dur).
// Varyantlar:
//   default — surfaceLight zemin + ikon + metin
//   subtle  — zeminsiz, primary metin (link stili)
//   danger  — kırmızı tonlu zemin + danger metin
//   ghost   — surface + border (çerçeveli)
// Boyut: md (44) | sm (36) | xs (28). PressFX mikro-etkileşimli.
// Erişilebilirlik: her boyutta hitSlop ile ≥44pt dokunma alanı,
// accessibilityRole/Label/State (disabled + loading) otomatik.
// loading: işlem sürerken dönen imgeç + etiket, çift basma kapanır.
// ============================================================
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../theme';
import PressableFX from '../PressableFX';
import Icon from './icons';

const SIZES = {
  md: { paddingV: 12, paddingH: 18, fontSize: 15, icon: 16, minH: 44 },
  sm: { paddingV: 8, paddingH: 13, fontSize: 13, icon: 14.5, minH: 36 },
  xs: { paddingV: 5, paddingH: 11, fontSize: 13, icon: 13, minH: 30 },
};
// Dar boyutlarda görsel küçük kalır; dokunma alanı hitSlop ile tamamlanır.
const SLOP = { md: 4, sm: 6, xs: 10 };

export default function SoftButton({
  label,
  icon,
  emoji,
  name,
  onPress,
  variant = 'default',
  size = 'md',
  disabled,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
}) {
  const { colors: C, radius } = useTheme();
  const s = SIZES[size] || SIZES.md;
  const busy = loading && !disabled;

  const bg =
    variant === 'danger' ? C.danger + '1A' : variant === 'ghost' ? C.surface : C.surfaceLight;
  const fg =
    variant === 'danger' ? C.danger : variant === 'subtle' ? C.primary : C.text;
  const hasBorder = variant === 'ghost';

  return (
    <PressableFX
      onPress={busy ? undefined : onPress}
      disabled={disabled || busy}
      scale={0.97}
      hitSlop={SLOP[size] ?? 8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!disabled || busy, busy }}
      style={[
        styles.btn,
        {
          backgroundColor: bg,
          borderRadius: radius.control,
          paddingVertical: s.paddingV,
          paddingHorizontal: s.paddingH,
          minHeight: s.minH,
        },
        hasBorder && { borderWidth: 1, borderColor: C.border },
        (disabled || busy) && styles.disabled,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg} style={styles.icon} />
      ) : icon || emoji || name ? (
        <Icon name={name} emoji={emoji || icon} size={s.icon} color={fg} style={styles.icon} />
      ) : null}
      <Text style={[styles.label, { color: fg, fontSize: s.fontSize }, textStyle]}>{label}</Text>
    </PressableFX>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
});
