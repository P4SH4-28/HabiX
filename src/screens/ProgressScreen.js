// ============================================================
// ProgressScreen — "Gelişim" sekmesi
// Tüm istatistikler useMemo ile YALNIZCA veri değiştiğinde hesaplanır
// (her çizimde tekrar hesap yapılmaz). Hesaplamalar logic.js'teki
// saf fonksiyonlardan beslenir:
//  - buildDailyCompletions → haftalık grafik + ısı haritası verisi
//  - topHabits            → "En Çok Tamamlananlar" listesi
//  - weeklyComparison     → bu hafta vs geçen hafta kartı
// ============================================================
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AchievementsGrid from '../components/AchievementsGrid';
import Heatmap from '../components/Heatmap';
import StatCard from '../components/StatCard';
import TopHabits from '../components/TopHabits';
import WeekChart from '../components/WeekChart';
import WeeklyCompare from '../components/WeeklyCompare';
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

export default function ProgressScreen() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
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
      <Text style={styles.screenSub}>İlerlemeni izle ve tutarlılığını gör</Text>

      {/* Özet istatistik kartları */}
      <View style={styles.statsRow}>
        <StatCard
          icon="✅"
          label="Toplam Tamamlama"
          value={overview.total}
          color={C.accent}
        />
        <StatCard
          icon="🔥"
          label="En İyi Seri"
          value={overview.best}
          color={C.xp}
        />
      </View>
      <View style={styles.statsRow}>
        <StatCard
          icon="⚡"
          label="Toplam XP"
          value={stats.totalXp}
          color={C.primary}
        />
        <StatCard
          icon="🎯"
          label="Aktif Alışkanlık"
          value={habits.length}
          color={C.xp}
        />
      </View>

      {habits.length > 0 ? (
        <>
          {/* Bu hafta vs geçen hafta karşılaştırması */}
          <WeeklyCompare weekly={overview.weekly} />
          {/* Son 7 günün tamamlama grafiği */}
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

function makeStyles(C) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    content: {
      padding: 20,
      gap: 14,
      paddingBottom: 60,
    },
    screenSub: {
      color: C.textMuted,
      fontSize: 13,
      marginBottom: 4,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
    },
  });
}
