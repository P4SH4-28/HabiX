// ============================================================
// HomeScreen — "Bugün" sekmesi
// - Karşılama mesajı + XP/seviye çubuğu + bugünkü ilerleme yüzdesi
// - Alışkanlık listesi (tamamla / geri al / sil)
// - Sağ alttaki + butonu ile yeni alışkanlık modalı açılır
// - Seviye atlayınca kutlama modalı App.js kökünde açılır (LevelUpModal)
// - Pomodoro sayacı bu sekmede yer alır (PomodoroTimer)
// "today" değeri DataContext'ten gelir; gece yarısı geçince ekran
// otomatik yeni güne geçer (bayat "bugün" durumu yaşanmaz).
// ============================================================
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AddHabitModal from '../components/AddHabitModal';
import AnimatedCounter from '../components/AnimatedCounter';
import AvatarCircle from '../components/AvatarCircle';
import Card from '../components/Card';
import MemoizedHabitCard from '../components/memoizedHabitCard';
import NotificationBell from '../components/NotificationBell';
import PomodoroTimer from '../components/PomodoroTimer';
import PressableFX from '../components/PressableFX';
import Sheet from '../components/Sheet';
import XpBar from '../components/XpBar';
import Icon from '../components/ui/icons';
import IconTile from '../components/ui/IconTile';
import Progress from '../components/ui/Progress';
import SectionHeader from '../components/ui/SectionHeader';
import { useData } from '../context/DataContext';
import { canClaimQuest, getDailyQuests, questClaimedToday } from '../data/quests';
import { STARTER_HABITS } from '../data/starterHabits';
import {
  bestStreak,
  DAILY_XP_CAP,
  levelFromTotalXp,
  MAX_ACTIVE_HABITS,
} from '../logic';
import { useTheme } from '../theme';

export default function HomeScreen() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { data, today, toggleHabit, deleteHabit, addHabit, refreshServer, refreshing, pushToast } =
    useData();
  const navigation = useNavigation();
  const { habits, stats, settings } = data;
  // Seviye bilgisi toplam XP'den türetilir (bkz. logic.js).
  const levelInfo = levelFromTotalXp(stats.totalXp);
  const [modalVisible, setModalVisible] = useState(false);
  // Silme onayı: uzun basınca anında silinmez; önce alt-sheet onayı sorulur.
  const [deleteTarget, setDeleteTarget] = useState(null);

  const confirmDelete = useCallback(
    (id) => {
      const h = habits.find((x) => x.id === id);
      if (h) setDeleteTarget(h);
    },
    [habits]
  );

  const doDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteHabit(deleteTarget.id);
    pushToast({ icon: '🗑️', title: `${deleteTarget.name} silindi`, color: C.danger });
    setDeleteTarget(null);
  }, [deleteTarget, deleteHabit, C.danger, pushToast]);

  // Görev özeti: bugün bitirilen görev sayısı + şu an ödülü hazır olanlar.
  // Görevler her gün havuzdan yeniden seçilir ve günde bir kez alınır.
  const questSummary = useMemo(() => {
    const claims = data.questClaims || {};
    const { base, vip } = getDailyQuests(today);
    const all = [...base, ...vip];
    const doneToday = all.filter((q) => questClaimedToday(q, claims, today)).length;
    const readyCount = all.filter((q) =>
      canClaimQuest(q, data.stats.day, claims, today, data.habits)
    ).length;
    return { doneToday, readyCount, total: all.length };
  }, [data.questClaims, data.stats.day, data.habits, today]);

  // Bugünkü ilerleme: tamamlanan / toplam alışkanlık
  const doneToday = habits.filter((h) => h.completedDates.includes(today)).length;
  const total = habits.length;
  const pct = total > 0 ? doneToday / total : 0;
  const bestStreakValue = bestStreak(habits, today);
  const todayXp = stats.day?.key === today ? stats.day.xpEarned || 0 : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

  // Hızlı başlangıç: boş ekrandaki önerilen alışkanlığı tek dokunuşla ekle.
  const quickAdd = useCallback(
    (h) => {
      addHabit(h.name, h.emoji, h.color);
      pushToast({
        icon: h.emoji,
        title: `${h.name} eklendi! Bugünkü hedefin hazır.`,
        color: h.color,
      });
    },
    [addHabit, pushToast]
  );

  // Liste başlığı: karşılama (avatar + altın), XP çubuğu, pomodoro, ilerleme
  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.topText}>
          <View style={styles.greetingRow}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Icon emoji="👋" size={18} color={C.text} />
          </View>
          <Text style={styles.subGreeting}>
            {total > 0
              ? `Bugün ${doneToday}/${total} alışkanlığını tamamladın`
              : 'Bugünkü ilk alışkanlığını ekle'}
          </Text>
        </View>
        {/* Bildirim zili (gelen arkadaşlık istekleri) */}
        <NotificationBell />
        {/* Profil fotoğrafı (dükkan avatarı) + altın bakiyesi */}
        <View style={styles.profileCol}>
          <AvatarCircle
            avatarId={data.settings.avatarId}
            frameId={data.settings.frameId}
            photo={data.settings.photoUrl}
            size={48}
            ringColor={C.primary}
          />
          <View style={styles.goldChip}>
            <Icon emoji="🪙" size={13} color={C.gold} />
            <AnimatedCounter value={stats.gold || 0} style={styles.goldText} />
          </View>
        </View>
      </View>

      {/* HERO: "Bugün ne durumdayım?" — en üstte, en güçlü vurgu. */}
      <Card style={styles.todayCard}>
        <View style={styles.todayHeader}>
          <Text style={styles.todayTitle}>Bugünkü İlerleme</Text>
          <View style={styles.todayValueRow}>
            <Text style={styles.todayValue}>%</Text>
            <AnimatedCounter value={Math.round(pct * 100)} style={styles.todayValue} />
          </View>
        </View>
        <Progress
          value={pct}
          height={12}
          colors={[C.accent, C.primary]}
          accessibilityLabel={`Bugünkü ilerleme yüzde ${Math.round(pct * 100)}`}
        />
        {/* Özet bloğu: en uzun seri · bugün XP · tamamlanan */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Icon emoji="🔥" size={15} color={C.textMuted} />
            <AnimatedCounter value={bestStreakValue} style={styles.summaryValue} />
            <Text style={styles.summaryLabel}>En uzun seri</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Icon emoji="⚡" size={15} color={C.textMuted} />
            <AnimatedCounter value={todayXp} style={styles.summaryValue} />
            <Text style={styles.summaryLabel}>Bugün XP</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Icon emoji="✅" size={15} color={C.textMuted} />
            <Text style={styles.summaryValue}>
              <AnimatedCounter value={doneToday} style={styles.summaryValue} />/{total}
            </Text>
            <Text style={styles.summaryLabel}>Tamamlanan</Text>
          </View>
        </View>
        <Text style={styles.todayHint}>
          Alışkanlık başına +{settings.xpPerHabit} XP kazanırsın
        </Text>
      </Card>

      <Card>
        <XpBar
          level={levelInfo.level}
          curXp={levelInfo.curXp}
          nextThreshold={levelInfo.nextThreshold}
          todayXp={stats.day?.key === today ? stats.day.xpEarned || 0 : 0}
          todayCap={DAILY_XP_CAP}
        />
      </Card>
      <Card
        style={styles.questCard}
        onPress={() => navigation.navigate('QuestBoard')}
      >
        <View style={styles.questCardTop}>
          <View style={styles.questTitleRow}>
            <Icon emoji="🎯" size={16} color={C.primary} />
            <Text style={styles.questCardTitle}>Günün Görevleri</Text>
          </View>
          {questSummary.readyCount > 0 ? (
            <View style={[styles.questReadyChip, { backgroundColor: C.accent + '1F' }]}>
              <Text style={[styles.questReadyText, { color: C.accent }]}>
                {questSummary.readyCount} hazır
              </Text>
            </View>
          ) : (
            <View style={styles.questWaitRow}>
              <Icon emoji="⏳" size={12} color={C.textMuted} />
              <Text style={styles.questWaitText}>beklemede</Text>
            </View>
          )}
        </View>
        <Text style={styles.questCardHint}>
          {questSummary.doneToday > 0
            ? `Bugün ${questSummary.doneToday}/${questSummary.total} görev tamamladın`
            : 'Henüz görev bitirmedin'}{' '}
          • Görevler her gün sıfırlanır →
        </Text>
      </Card>
      <PomodoroTimer />
      <SectionHeader title={`Alışkanlıklar (${habits.length})`} style={styles.sectionHeader} />
    </View>
  );

  // Kart yüksekliği: border(2) + padding(32) + emoji kutusu(42) = 76;
  // + marginBottom(10) = 86 toplam pitch (getItemLayout offset hesabı için).
  const itemHeight = 86;

  return (
    <View style={styles.container}>
      <FlatList
        data={habits}
        keyExtractor={(item) => item.id}
        getItemLayout={(data, index) => ({ length: itemHeight, offset: index * itemHeight, index })}
        renderItem={({ item }) => (
          <MemoizedHabitCard habit={item} today={today} onToggle={toggleHabit} onDelete={confirmDelete} />
        )}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        // Çek-yenile: sunucuyla senkron (profil + arkadaş + liderlik + görevler).
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refreshServer()}
            tintColor={C.primary}
            colors={[C.primary]}
            progressBackgroundColor={C.surface}
          />
        }
        ListEmptyComponent={
          <EmptyState C={C} styles={styles} onQuickAdd={quickAdd} />
        }
      />
      {/* Yeni alışkanlık ekleme butonu (FAB) — spring basınç FX + haptik */}
      <PressableFX
        style={styles.fab}
        hitSlop={10}
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Yeni alışkanlık ekle"
      >
        <View style={[styles.fabGradient, { backgroundColor: C.primary }]}>
          <Text style={styles.fabIcon}>+</Text>
        </View>
      </PressableFX>
      <AddHabitModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={addHabit}
        habitsCount={habits.length}
        maxHabits={MAX_ACTIVE_HABITS}
      />
      {/* Silme onayı: alt-sheet (anında silinme riskine karşı) */}
      <Sheet
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Alışkanlığı Sil"
      >
        <Text style={styles.confirmText}>
          "{deleteTarget?.name}" silinecek. Bu alışkanlığın serisi ve tamamlama geçmişi
          kaldırılır; işlem geri alınamaz.
        </Text>
        <View style={styles.confirmRow}>
          <PressableFX
            style={[styles.confirmBtn, { backgroundColor: C.surfaceLight }]}
            onPress={() => setDeleteTarget(null)}
          >
            <Text style={styles.confirmBtnMuted}>Vazgeç</Text>
          </PressableFX>
          <PressableFX
            style={[styles.confirmBtn, { backgroundColor: C.danger }]}
            onPress={doDelete}
          >
            <Text style={styles.confirmBtnDanger}>Sil</Text>
          </PressableFX>
        </View>
      </Sheet>
    </View>
  );
}

// Boş durum: kullanıcıyı tek dokunuşla başlatan 🌱 ve hazır
// "Hızlı başlangıç" alışkanlık çipleri. v2: sonsuz zıplama döngüsü kaldırıldı.
function EmptyState({ C, styles, onQuickAdd }) {
  return (
    <View style={styles.emptyBox}>
      <IconTile emoji="🌱" variant="accent" size={66} />
      <Text style={styles.emptyTitle}>İlk alışkanlığını ekle</Text>
      <Text style={styles.emptyText}>
        Hazır bir başlangıç seç veya + butonuna dokun. Her tamamlama XP + altın kazandırır!
      </Text>
      <View style={styles.starterWrap}>
        {STARTER_HABITS.map((h) => (
          <PressableFX
            key={h.name}
            style={[
              styles.starterChip,
              { borderColor: h.color + '55' },
            ]}
            onPress={() => onQuickAdd(h)}
          >
            <Text style={styles.starterEmoji}>{h.emoji}</Text>
            <Text style={styles.starterChipText}>{h.name}</Text>
          </PressableFX>
        ))}
      </View>
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      gap: 14,
    },
    greeting: {
      color: C.text,
      fontSize: 22,
      fontWeight: '800',
    },
    greetingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    topText: {
      flex: 1,
      paddingRight: 12,
    },
    profileCol: {
      alignItems: 'center',
      gap: 6,
    },
    goldChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: C.surface,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    goldIcon: {
      fontSize: 13,
    },
    goldText: {
      color: C.gold,
      fontSize: 13,
      fontWeight: '800',
    },
    subGreeting: {
      color: C.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    card: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 16,
    },
    todayCard: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 16,
      gap: 10,
    },
    questCard: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 16,
      gap: 6,
    },
    questCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    questCardTitle: {
      color: C.text,
      fontSize: 15,
      fontWeight: '800',
    },
    questTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    questReadyChip: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    questReadyText: {
      fontSize: 11,
      fontWeight: '800',
    },
    questWaitText: {
      color: C.textMuted,
      fontSize: 11,
      fontWeight: '700',
    },
    questWaitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    questCardHint: {
      color: C.textMuted,
      fontSize: 13,
      lineHeight: 17,
    },
    todayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
      gap: 1,
    },
    summaryIcon: {
      fontSize: 15,
    },
    summaryValue: {
      color: C.text,
      fontSize: 15,
      fontWeight: '800',
    },
    summaryLabel: {
      color: C.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    summaryDivider: {
      width: 1,
      height: 26,
      backgroundColor: C.border,
    },
    todayTitle: {
      color: C.text,
      fontSize: 15,
      fontWeight: '700',
    },
    todayValue: {
      color: C.accent,
      fontSize: 26,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    todayValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    todayHint: {
      color: C.textMuted,
      fontSize: 11,
    },
    sectionHeader: {
      marginTop: 8,
      marginBottom: 4,
    },
    listContent: {
      paddingBottom: 120,
    },
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 24,
      width: 64,
      height: 64,
      shadowColor: C.primary,
      shadowOpacity: 0.55,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 12,
    },
    fabGradient: {
      width: 64,
      height: 64,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fabIcon: {
      color: C.onPrimary,
      fontSize: 32,
      fontWeight: '800',
      lineHeight: 36,
    },
    emptyBox: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 24,
      marginTop: 20,
    },
    emptyEmoji: {
      fontSize: 44,
      marginBottom: 12,
    },
    emptyTitle: {
      color: C.text,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 6,
    },
    emptyText: {
      color: C.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 20,
    },
    confirmText: {
      color: C.text,
      fontSize: 15,
      lineHeight: 21,
    },
    confirmRow: {
      flexDirection: 'row',
      gap: 10,
    },
    confirmBtn: {
      flex: 1,
      borderRadius: 16,
      paddingVertical: 13,
      alignItems: 'center',
    },
    confirmBtnMuted: {
      color: C.text,
      fontWeight: '700',
    },
    confirmBtnDanger: {
      color: '#fff',
      fontWeight: '800',
    },
    starterWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 10,
      marginTop: 22,
      maxWidth: 340,
    },
    starterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.surface,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    starterChipPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.97 }],
    },
    starterEmoji: {
      fontSize: 17,
    },
    starterChipText: {
      color: C.text,
      fontSize: 13,
      fontWeight: '700',
    },
  });
}
