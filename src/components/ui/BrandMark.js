// ============================================================
// BrandMark.js — Auth/onboarding markası: amblem + isim.
// v2: düz birincil zemin (gradient/glow yok) + ikon emoji tablosundan gelir.
// ============================================================
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import Icon from './icons';

export default function BrandMark({
  name = 'HabiX',
  emblem = '🎯',
  subtitle,
  size = 88,
}) {
  const { colors: C } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.amblemWrap}>
        <View
          style={[
            styles.amblem,
            {
              width: size,
              height: size,
              borderRadius: size * 0.3,
              backgroundColor: C.primary,
            },
          ]}
        >
          <Icon emoji={emblem} size={size * 0.4} color="#FFFFFF" />
        </View>
      </View>
      <Text style={[styles.name, { color: C.text }]}>{name}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: C.textMuted }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 6,
  },
  amblemWrap: {
    marginBottom: 10,
  },
  amblem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
});