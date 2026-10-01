// ============================================================
// Skeleton.js — Yükleme iskeleti primitive'i.
// v2: pulse (sonsuz titreme) animasyonu KALDIRILDI → sabit soluk blok.
// Kullanım: içerik gelene kadar aynı düzeni tutar — boş beyaz ekran yok.
//   <Skeleton h={20} w="60%" />        tek metin satırı
//   <Skeleton.Circle s={48} />         avatar
//   <Skeleton.Card h={120} />          kart alanı
// ============================================================
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';

const SKELETON_OPACITY = 0.7;

export default function Skeleton({ w = '100%', h = 14, r, style }) {
  const { colors: C, radius } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        {
          width: w,
          height: h,
          borderRadius: r != null ? r : Math.min(h / 2, radius.chip),
          backgroundColor: C.surfaceLight,
          opacity: SKELETON_OPACITY,
        },
        style,
      ]}
    />
  );
}

function SkeletonCircle({ s = 48, style }) {
  const { colors: C } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        {
          width: s,
          height: s,
          borderRadius: s / 2,
          backgroundColor: C.surfaceLight,
          opacity: SKELETON_OPACITY,
        },
        style,
      ]}
    />
  );
}

function SkeletonCard({ h = 74, style }) {
  const { colors: C, radius } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.card,
        {
          height: h,
          backgroundColor: C.surface,
          borderColor: C.border,
          borderRadius: radius.card,
          opacity: SKELETON_OPACITY,
        },
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
