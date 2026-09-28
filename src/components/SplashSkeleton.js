// ============================================================
// SplashSkeleton.js — Uygulama verisi yüklenirken gösterilen
// iskelet ekranı. Ortak ui/Skeleton primitive'ini kullanır:
// pulse reduce-motion'da durur, renkler temadan gelir
// (eski sabit #22262f kalmadı — açık temalarda da doğru görünür).
// ============================================================
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import Skeleton from './ui/Skeleton';

export default function SplashSkeleton() {
  const { colors: C } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: C.background }]}>
      <View style={styles.topRow}>
        <View style={styles.topText}>
          <Skeleton w={140} h={20} />
          <Skeleton w={190} h={14} style={{ marginTop: 8 }} />
        </View>
        <Skeleton.Circle s={48} />
      </View>

      <Skeleton h={90} r={16} style={{ marginTop: 16 }} />

      {[0, 1, 2].map((i) => (
        <Skeleton key={i} h={64} r={16} style={{ marginTop: 12 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  topText: {
    gap: 2,
  },
});
