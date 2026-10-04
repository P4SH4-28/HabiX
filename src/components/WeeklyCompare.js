// ============================================================
// WeeklyCompare — "Bu Hafta vs Geçen Hafta" karşılaştırma kartı
// weekly: { currentWeek, lastWeek, diff, trend } (logic.js'teki weeklyComparison)
// Trend oku ▲ / ▼ / ■ ile artış, düşüş veya aynı kaldığını gösterir.
// ============================================================
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './ui/Text';
import { useTheme } from '../theme';
import { useT } from '../i18n';

export default function WeeklyCompare({ weekly }) {
  const { colors: C } = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(C), [C]);
  // Trend bilgisi temaya bağlı renkler kullandığı için bileşen içinde üretilir.
  const trend = (
    weekly.trend === 'up'
      ? { arrow: '▲', color: C.accent, text: t('progress.trendBetter') }
      : weekly.trend === 'down'
        ? { arrow: '▼', color: C.danger, text: t('progress.trendWorse') }
        : { arrow: '■', color: C.textMuted, text: t('progress.trendSame') }
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('progress.weeklyCompare')}</Text>
      <View style={styles.columns}>
        {/* Geçen hafta (7-14 gün önce) */}
        <View style={styles.column}>
          <Text style={styles.columnLabel}>{t('progress.lastWeek')}</Text>
          <Text style={styles.columnValue}>{weekly.lastWeek}</Text>
          <Text style={styles.columnHint}>{t('progress.completions')}</Text>
        </View>
        {/* Bu hafta (son 7 gün) */}
        <View style={[styles.column, styles.columnHighlight]}>
          <Text style={[styles.columnLabel, styles.labelHighlight]}>{t('progress.thisWeek')}</Text>
          <Text style={[styles.columnValue, styles.valueHighlight]}>
            {weekly.currentWeek}
          </Text>
          <Text style={styles.columnHint}>{t('progress.completions')}</Text>
        </View>
      </View>
      {/* Trend satırı: ok + fark + açıklama */}
      <View style={styles.trendRow}>
        <Text style={[styles.arrow, { color: trend.color }]}>{trend.arrow}</Text>
        <Text style={[styles.trendText, { color: trend.color }]}>
          {t('progress.trendDiff', {
            diff: weekly.diff > 0 ? `+${weekly.diff}` : String(weekly.diff),
          })}
        </Text>
        <Text style={styles.trendHint}>{trend.text}</Text>
      </View>
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 16,
      gap: 14,
    },
    title: {
      color: C.text,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 22,
    },
    columns: {
      flexDirection: 'row',
      gap: 10,
    },
    column: {
      flex: 1,
      minWidth: 0,
      backgroundColor: C.surfaceLight,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      gap: 4,
    },
    columnHighlight: {
      borderWidth: 1,
      borderColor: C.primary,
    },
    columnLabel: {
      color: C.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      lineHeight: 16,
    },
    labelHighlight: {
      color: C.primary,
    },
    columnValue: {
      color: C.text,
      fontSize: 22,
      fontWeight: '700',
      lineHeight: 32,
    },
    valueHighlight: {
      color: C.primary,
    },
    columnHint: {
      color: C.textMuted,
      fontSize: 11,
      lineHeight: 16,
    },
    trendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    arrow: {
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 22,
    },
    trendText: {
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 20,
    },
    trendHint: {
      color: C.textMuted,
      fontSize: 13,
      flex: 1,
      minWidth: 0,
      textAlign: 'right',
      lineHeight: 20,
    },
  });
}
