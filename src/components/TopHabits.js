// ============================================================
// TopHabits — "En Çok Tamamlanan Alışkanlıklar" listesi
// items: [{ habit, count }] (logic.js'teki topHabits() çıktısı)
// Her satırda sıra, emoji, ad, tamamlama sayısı ve en çok tamamlanana
// göre orantılı bir ilerleme çubuğu gösterilir.
// ============================================================
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './ui/Text';
import { useTheme } from '../theme';
import Progress from './ui/Progress';

export default function TopHabits({ items }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const maxCount = items.length > 0 ? items[0].count : 1;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>En Çok Tamamlananlar</Text>
      {items.map(({ habit, count }, i) => (
        <View key={habit.id} style={styles.row}>
          <Text style={styles.rank}>{i + 1}</Text>
          <View style={[styles.emojiBox, { backgroundColor: habit.color + '22' }]}>
            <Text style={styles.emoji}>{habit.emoji || '✅'}</Text>
          </View>
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {habit.name}
              </Text>
              <Text style={styles.count}>{count} kez</Text>
            </View>
            {/* Çubuk genişliği ilk sıradaki alışkanlığa oranlanır (animasyonlu ortak Progress) */}
            <Progress
              value={maxCount > 0 ? count / maxCount : 0}
              height={8}
              colors={[habit.color, habit.color]}
              accessibilityLabel={`${habit.name} sıralama ilerlemesi`}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    title: {
      color: C.text,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 22,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    rank: {
      color: C.textMuted,
      fontSize: 13,
      fontWeight: '700',
      width: 18,
      lineHeight: 20,
    },
    emojiBox: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emoji: {
      fontSize: 17,
      lineHeight: 26,
    },
    info: {
      flex: 1,
      minWidth: 0,
      gap: 5,
    },
    nameRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    name: {
      color: C.text,
      fontSize: 13,
      fontWeight: '600',
      flexShrink: 1,
      lineHeight: 20,
    },
    count: {
      color: C.textMuted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 20,
    },
  });
}
