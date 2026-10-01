// ============================================================
// Card.js — Yüzey primitive'i (modern kart: net kenarlık, 20px radius,
// katmanlı gölge, isteğe bağlı glassmorphism).
//   onPress   → 0.985 press geri bildirimi (reduced-motion'da kapalı)
//   glowColor → renkli dış ışıma; `selected` ile daha parlak
//   glass     → BlurView arka katman + yarı saydam zemin (opt-in)
//   flat      → gölgeyi kapat (zaten gölgeli bir yüzeyin üstünde)
//   padding   → token ile; varsayılan space.lg (16)
// ============================================================
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { SHADOWS, tint, useTheme } from '../theme';
import useReducedMotion from '../hooks/useReducedMotion';

export default function Card({
  children,
  style,
  onPress,
  glowColor,
  selected,
  glass = false,
  flat = false,
  padding,
  ...rest
}) {
  const { colors: C, radius, space, glow } = useTheme();
  const reduced = useReducedMotion();
  const styles = useMemo(() => makeStyles(C, radius), [C, radius]);
  const glowStyle = glowColor
    ? glow(glowColor, {
        opacity: selected ? 0.28 : 0.14,
        radius: 26,
        offset: 8,
        elevation: selected ? 12 : 6,
      })
    : null;
  const pad = padding ?? space.lg;

  const cardStyle = [
    styles.card,
    {
      padding: pad,
      backgroundColor: glass ? tint(C.surface, '66') : C.surface,
      overflow: glass ? 'hidden' : undefined,
    },
    !flat && SHADOWS.card,
    glowStyle,
    selected && styles.selected,
    style,
  ];

  const overlay = glass ? (
    <BlurView intensity={24} tint="dark" style={styles.glass} pointerEvents="none" />
  ) : null;

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
        {overlay}
        {children}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle} {...rest}>
      {overlay}
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
    glass: {
      ...StyleSheet.absoluteFillObject,
    },
    selected: {
      borderColor: C.primary + '66',
    },
  });
}
