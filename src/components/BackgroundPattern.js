// ============================================================
// BackgroundPattern — Zemin katmanı
// v2: gradyan "atmosphere" katmanı KALDIRILDI (zemin saf siyah);
// kalan tek katman temaya özgü emoji dokusudur (çok düşük opaklık).
// Tüm katman pointerEvents="none" — dokunuşları asla engellemez.
// ============================================================
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

export default function BackgroundPattern() {
  const { colors: C } = useTheme();

  return (
    <View style={styles.layer} pointerEvents="none">
      {/* Temaya özgü emoji dokusu (burnu varsa) */}
      {C.pattern ? <EmojiTexture pattern={C.pattern} /> : null}
    </View>
  );
}

function EmojiTexture({ pattern }) {
  const cells = Array.from({ length: 160 });
  return (
    <View style={styles.grid}>
      {cells.map((_, i) => (
        <Text key={i} style={styles.cell}>
          {pattern}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    overflow: 'hidden',
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    opacity: 0.028,
  },
  cell: {
    width: '12.5%',
    fontSize: 18,
    textAlign: 'center',
  },
});
