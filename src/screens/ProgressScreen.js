// ============================================================
// ProgressScreen — "Gelişim" sekmesi (tasarım sistemi v3)
//
//   YENİ SİSEM: bölüm yüzeyi = ui/Card · tipografi = Text variant'ları
//   · spacing = token grid (4-48; 10/28 gibi grid dışı boşluk YOK)
//   GLOW YOK · GRADIENT YOK · LOOP YOK.
//
//   İstatistikler useMemo ile YALNIZCA veri değiştiğinde hesaplanır
//   (her çizimde tekrar hesap yapılmaz). Hesaplamalar logic.js'teki
//   saf fonksiyonlardan beslenir:
//    - buildDailyCompletions → haftalık grafik + ısı haritası verisi
//    - topHabits            → "En Çok Tamamlananlar" listesi
//    - weeklyComparison     → bu hafta vs geçen hafta kartı
//   Grafik bileşenleri (WeekChart/Heatmap/...) veri tüketir; hesap
//   tek yerde (overview) yapılır.
// ============================================================
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/ui/Text';
import Card from '../components/ui/Card';
import AchievementsGrid from '../components/AchievementsGrid';
import AnimatedCounter from '../components/AnimatedCounter';
import Heatmap from '../components/Heatmap';
import TopHabits from '../components/TopHabits';
import WeekChart from '../components/WeekChart';
import WeeklyCompare from '../components/WeeklyCompare';
import Icon from '../components/ui/icons';
import { useData } from '../context/DataContext';
import EmptyState from '../components/ui/EmptyState';
import {
  bestStreak,
  buildDailyCompletions,
  topHabits,
  totalCompletions,
  weeklyComparison,
} from '../logic';
import { useTheme } from '../theme';

// Tek yüzeyli istatistik hücresi (StatCard'ın aynısı, HARİCİ yüzey YOK —
// tüm hücreler tek Card'ın içinde durur, kart-içi kart olmaz).
function StatCell({ icon, label, value, color }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeCellStyles(C), [C]);
  return (
    <View style={styles.cell}>
      <View style={[styles.iconBox, { backgroundColor: color + '22' }]}>
        <Icon emoji={icon} size={16} color={color} />
      </View>
      <AnimatedCounter value={value} style={styles.value} />
      <Text variant="micro" style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function makeCellStyles(C) {
  return StyleSheet.create({
    cell: { flex: 1, minWidth: 0, gap: 8 },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    value: { color: C.text, fontSize: 22, fontWeight: '700', lineHeight: 32 },
    label: { color: C.textMuted, fontWeight: '600' },
  });
}

export default function ProgressScreen() {
  const { colors: C, radius, space, type } = useTheme();
  const styles = useMemo(() => makeStyles(C, radius, space, type), [C, radius, space, type]);
  const { data, today } = useData();
  const { habits, stats } = data;

  // Merkezi istatistik hesabı: habits veya today değişince yeniden hesaplanır.
  const overview = useMemo(
    () => ({
      daily: buildDailyCompletions(habits, 35, today),
      top: topHabits(habits, 5),
      weekly: weeklyComparison(habits, today),
      total: totalCompletions(habits),
      best: bestStreak(habits, today),
    }),
    [habits, today]
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Başlık AppHeader'da ("Gelişim") — burada yalnız açıklama satırı,
          böylece ekran başlığı iki kez görünmez. */}
      <Text variant="small" style={styles.screenSub}>
        İlerlemeni izle ve tutarlılığını gör
      </Text>

      {/* Özet istatistikler: TEK yüzeyli Card içinde 2x2 grid */}
      <Card padding="md">
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCell
              icon="✅"
              label="Toplam Tamamlama"
              value={overview.total}
              color={C.accent}
            />
            <StatCell icon="🔥" label="En İyi Seri" value={overview.best} color={C.xp} />
          </View>
          <View style={styles.statsRow}>
            <StatCell icon="⚡" label="Toplam XP" value={stats.totalXp} color={C.primary} />
            <StatCell
              icon="🎯"
              label="Aktif Alışkanlık"
              value={habits.length}
              color={C.xp}
            />
          </View>
        </View>
      </Card>

      {habits.length > 0 ? (
        <>
          {/* Bu hafta vs geçen hafta karşılaştırması */}
          <WeeklyCompare weekly={overview.weekly} />
          {/* Son 7 günün tamamlama grafiği (basit bar chart) */}
          <WeekChart daily={overview.daily} today={today} total={habits.length} />
          {/* Son 5 haftanın ısı haritası */}
          <Heatmap daily={overview.daily} />
          {/* En çok tamamlanan alışkanlıklar (en az 1 tamamlama olan) */}
          {overview.top.length > 0 && <TopHabits items={overview.top} />}
        </>
      ) : (
        <EmptyState
          icon="bar-chart"
          emoji="📊"
          title="Henüz veri yok"
          subtitle="Alışkanlık ekleyip tamamladıkça grafiklerin burada oluşacak."
        />
      )}

      {/* Başarım rozetleri: veri olsa da olmasa da görünür (sosyal rozet vb.). */}
      <AchievementsGrid unlockedIds={data.achievements} />
    </ScrollView>
  );
}

function makeStyles(C, radius, space, type) {
  return StyleSheet.create({
    container: {
      flex: 1,
      minWidth: 0,
      backgroundColor: C.background,
    },
    // Bölüm arası NEFES: 24 (token) · alt: 60 → 48 (grid).
    content: {
      padding: 24,
      gap: 24,
      paddingBottom: 48,
    },
    screenSub: {
      ...type.small,
      color: C.textMuted,
      marginBottom: -12,
    },
    statsGrid: { gap: space.lg },
    statsRow: { flexDirection: 'row', gap: space.md },
  });
}
