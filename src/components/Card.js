// ============================================================
// Card.js — Yüzey primitive'i (v2: sade yüzey, net kenarlık, 20px radius).
//   onPress → 0.985 press geri bildirimi (reduced-motion'da kapalı)
//   selected → primary tonlu kenarlık (ListRow seçili durumu)
//   padding → token ile; varsayılan space.lg (16)
// v2'de KALDIRILDI: glowColor ışıma, glass (BlurView), SHADOWS.card gölgesi.
// ============================================================
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import useReducedMotion from '../hooks/useReducedMotion';

export default function Card({
  children,
  style,
  onPress,
  selected,
  padding,
  ...rest
}) {
  const { colors: C, radius, space } = useTheme();
  const reduced = useReducedMotion();
  const styles = useMemo(() => makeStyles(C, radius), [C, radius]);
  const pad = padding ?? space.lg;

  const cardStyle = [
    styles.card,
    {
      padding: pad,
      backgroundColor: C.surface,
    },
    selected && styles.selected,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          ...cardStyle,
          pressed && !reduced && { transform: [{ scale: 0.985 }] },
        ]}
        accessibilityRole="button"
        {...rest}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle} {...rest}>
      {children}
    </View>
  );
}

function makeStyles(C, radius) {
  return StyleSheet.create({
    card: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: C.border,
    },
    selected: {
      borderColor: C.primary + '66',
    },
  });
}
