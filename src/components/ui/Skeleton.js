// ============================================================
// Skeleton.js — Yükleme iskeleti primitive'i.
// Pulse (titreşim) animasyonu; shimmer KULLANMAZ (göz yormaz, ucuzdur).
// Kullanım: içerik gelene kadar aynı düzeni tutar — boş beyaz ekran yok.
//   <Skeleton h={20} w="60%" />        tek metin satırı
//   <Skeleton.Circle s={48} />         avatar
//   <Skeleton.Card h={120} />          kart alanı
// Reduce-motion açıkken animasyon çalışmaz (düz blok).
// ============================================================
import { useEffect, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import useReducedMotion from '../../hooks/useReducedMotion';

function usePulse(reduced) {
  const anim = useMemo(() => new Animated.Value(0.55), []);
  useEffect(() => {
    if (reduced) {
      anim.setValue(0.7);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 720, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.55, duration: 720, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, reduced]);
  return anim;
}

export default function Skeleton({ w = '100%', h = 14, r, style }) {
  const { colors: C, radius } = useTheme();
  const reduced = useReducedMotion();
  const opacity = usePulse(reduced);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        {
          width: w,
          height: h,
          borderRadius: r != null ? r : Math.min(h / 2, radius.chip),
          backgroundColor: C.surfaceLight,
          opacity,
        },
        style,
      ]}
    />
  );
}

function SkeletonCircle({ s = 48, style }) {
  const { colors: C } = useTheme();
  const reduced = useReducedMotion();
  const opacity = usePulse(reduced);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        { width: s, height: s, borderRadius: s / 2, backgroundColor: C.surfaceLight, opacity },
        style,
      ]}
    />
  );
}

function SkeletonCard({ h = 74, style }) {
  const { colors: C, radius } = useTheme();
  const reduced = useReducedMotion();
  const opacity = usePulse(reduced);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.card,
        { height: h, backgroundColor: C.surface, borderColor: C.border, borderRadius: radius.card, opacity },
        style,
      ]}
    />
  );
}

Skeleton.Circle = SkeletonCircle;
Skeleton.Card = SkeletonCard;

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
  },
  card: {
    borderWidth: 1,
    marginBottom: 10,
  },
});
