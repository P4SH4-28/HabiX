// ============================================================
// IconTile.js — Gradient ikon kutusu (premium geometri).
// - Renkli varyantlar: tema single-color geçişleri (primary),
//   marka gradientleri (violet/accent/danger/xp/gold/silver/bronze),
//   glass (surface + border) — hepsi "yumuşatılmış keskin" köşelerde.
// v2'de KALDIRILDI: dış ışıma (glow).
// ============================================================
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import Icon from './icons';

const MARK_GRADIENTS = {
  violet: ['#A78BFA', '#7C3AED'],
  accent: ['#34D399', '#059669'],
  danger: ['#FB7185', '#E11D48'],
  xp: ['#FBBF24', '#F59E0B'],
  gold: ['#FCD34D', '#C98900'],
  silver: ['#E4E4E7', '#90909A'],
  bronze: ['#E7A87B', '#B2653A'],
};

export default function IconTile({
  icon,
  emoji,
  name,
  variant = 'primary',
  tint,
  size = 40,
  iconSize,
  iconColor,
  style,
}) {
  const { colors: C, radius } = useTheme();
  const styles = useMemo(() => makeStyles(C, radius), [C, radius]);

  const borderRadius = Math.round(size * 0.34);
  const inner = iconSize || Math.round(size * 0.46);
  const isGlass = variant === 'glass' && !tint;

  const bgColor = useMemo(() => {
    if (tint) return tint;
    if (variant === 'primary') return C.primary;
    const pair = MARK_GRADIENTS[variant];
    return pair ? pair[0] : C.primary;
  }, [tint, variant, C.primary]);

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.body,
          { borderRadius, backgroundColor: isGlass ? 'transparent' : bgColor },
          isGlass && { borderWidth: 1, borderColor: C.border },
        ]}
      >
        <Icon
          name={name}
          emoji={emoji || icon}
          size={inner}
          color={iconColor || (isGlass ? C.text : '#FFFFFF')}
        />
      </View>
    </View>
  );
}

function makeStyles(C, radius) {
  return StyleSheet.create({
    tile: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}