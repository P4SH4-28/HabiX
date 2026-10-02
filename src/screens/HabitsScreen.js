// ============================================================
// HabitsScreen — "Alışkanlıklar" alt ekranı (stack · v3 design system)
//
// YAPI:
//   1) Başlık        → "Alışkanlıklar" (h1) + limit rozeti + ipucu
//   2) Özet kartı     → bugünün yüzdesi (stat/success) + 3 sayaç
//   3) Arama          → ui/TextInput (ikon + temizle)
//   4) Filtre         → ui/SegmentedTabs (Tümü / Tamamlanan / Bekleyen)
//   5) Liste          → satır kartları (dokun=tamamla, uzun bas=sil)
//   6) FAB            → AddHabitModal
//
// DataContext hook'ları ve callback'leri DEĞİŞMEDİ:
//   useData → data, today, toggleHabit, deleteHabit, addHabit,
//             refreshServer, refreshing, pushToast
//
// SAFE AREA: üst başlık Stack header'ı (AppHeader/TopBar) tarafından
//   karşılanır → ekran üst inset UYGULAMAZ. Alt inset uygulanır
//   (bu ekran tab bar'ın altında değil, stack'te: PillTabBar yok).
//
// KURALLAR: glow/gradient/blur/loop YOK · animasyon ≤300ms ·
//   3 vurgu rengi (primary/success/gold) · statik emoji: 1 (🔥) ·
//   5 tipografi boyutu · h1 yalnız ekran başlığı.
// ============================================================
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AddHabitModal from '../components/AddHabitModal';
import AnimatedCounter from '../components/AnimatedCounter';
import PressableFX from '../components/PressableFX';
import { confirmDialog } from '../components/memoizedHabitCard';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Icon from '../components/ui/icons';
import Pill from '../components/ui/Pill';
import Progress from '../components/ui/Progress';
import SectionHeader from '../components/ui/SectionHeader';
import SegmentedTabs from '../components/ui/SegmentedTabs';
import TextInput from '../components/ui/TextInput';
import { HabitSwipeRow } from './HomeScreen';
import { useData } from '../context/DataContext';
import { bestStreak, calcStreak, levelFromTotalXp, MAX_ACTIVE_HABITS } from '../logic';
import { SHADOWS, useTheme } from '../theme';

const FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'done', label: 'Tamamlanan' },
  { key: 'todo', label: 'Bekleyen' },
];

export default function HabitsScreen() {
  const { colors: C, type } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const {
    data,
    today,
    toggleHabit,
    deleteHabit,
    addHabit,
    refreshServer,
    refreshing,
    pushToast,
  } = useData();
  const { habits, stats } = data;
  const freezeDay = data.activeEffects?.streakFreeze || null;

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);

  // ---------- türetilmiş veriler ----------
  const doneToday = habits.filter((h) => h.completedDates.includes(today)).length;
  const total = habits.length;
  const pct = total > 0 ? doneToday / total : 0;
  const bestStreakValue = bestStreak(habits, today);
  const level = levelFromTotalXp(stats.totalXp).level;
  const atMax = total >= MAX_ACTIVE_HABITS;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return habits.filter((h) => {
      const isDone = h.completedDates.includes(today);
      const matchFilter =
        filter === 'all' || (filter === 'done' ? isDone : !isDone);
      return matchFilter && (!q || h.name.toLowerCase().includes(q));
    });
  }, [habits, query, filter, today]);

  // ---------- callback'ler (DataContext ile aynen) ----------
  const openAdd = useCallback(() => setModalVisible(true), []);

  const confirmDelete = useCallback(
    (id) => {
      const h = habits.find((x) => x.id === id);
      if (!h) return;
      confirmDialog(
        'Alışkanlığı Sil',
        `"${h.name}" silinecek. Seri ve tamamlama geçmişi kaldırılır; işlem geri alınamaz.`,
        () => {
          deleteHabit(h.id);
          pushToast({ icon: '🗑️', title: `${h.name} silindi`, color: C.danger });
        }
      );
    },
    [habits, deleteHabit, pushToast, C.danger]
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(96, insets.bottom + 88) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refreshServer()}
            tintColor={C.primary}
            colors={[C.primary]}
            progressBackgroundColor={C.surface}
          />
        }
      >
        {/* ---------- 1) BAŞLIK ---------- */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>Alışkanlıklar</Text>
          <Pill
            size="sm"
            bg={atMax ? C.gold + '1A' : C.primary + '1A'}
            color={atMax ? C.gold : C.primary}
          >
            {total}/{MAX_ACTIVE_HABITS}
          </Pill>
        </View>
        <Text style={styles.subtitle}>Dokun → tamamla · uzun bas → sil</Text>

        {/* ---------- 2) ÖZET ---------- */}
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.h3}>Bugünkü İlerleme</Text>
            <Text style={styles.pctValue}>{Math.round(pct * 100)}%</Text>
          </View>
          <Progress
            value={pct}
            height={6}
            colors={[C.primary, C.primary]}
            accessibilityLabel={`Bugünkü ilerleme yüzde ${Math.round(pct * 100)}`}
          />
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Icon emoji="🔥" size={16} color={C.textMuted} />
              <Text style={styles.statLabel}>En uzun seri</Text>
              <AnimatedCounter value={bestStreakValue} style={styles.statValue} />
            </View>
            <View style={styles.statCol}>
              <Ionicons name="checkmark-circle" size={16} color={C.textMuted} />
              <Text style={styles.statLabel}>Tamamlanan</Text>
              <Text style={styles.statValue}>
                <AnimatedCounter value={doneToday} style={styles.statValue} />/{total}
              </Text>
            </View>
            <View style={styles.statCol}>
              <Ionicons name="star" size={16} color={C.textMuted} />
              <Text style={styles.statLabel}>Seviye</Text>
              <AnimatedCounter value={level} style={styles.statValue} />
            </View>
          </View>
        </Card>

        {/* ---------- 3) ARAMA ---------- */}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Alışkanlık ara"
          returnKeyType="search"
          icon={<Ionicons name="search" size={18} color={C.textMuted} />}
          rightIcon={
            query ? (
              <Ionicons name="close-circle" size={18} color={C.textMuted} />
            ) : null
          }
          onRightIconPress={() => setQuery('')}
        />

        {/* ---------- 4) FİLTRE ---------- */}
        <SegmentedTabs options={FILTERS} value={filter} onChange={setFilter} />

        {/* ---------- 5) LİSTE ---------- */}
        <SectionHeader
          title={`Liste (${visible.length})`}
          actionLabel="Yeni ekle"
          onAction={openAdd}
        />

        {total === 0 ? (
          <EmptyState
            name="leaf"
            title="Henüz alışkanlık yok"
            subtitle="İlk alışkanlığını ekleyerek serini başlat."
            actionLabel="Alışkanlık ekle"
            onAction={openAdd}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            compact
            name="search"
            title="Sonuç yok"
            subtitle="Aramanı veya filtreni değiştir."
          />
        ) : (
          visible.map((h) => (
            <HabitSwipeRow
              key={h.id}
              habit={h}
              done={h.completedDates.includes(today)}
              streak={calcStreak(h.completedDates, today, freezeDay)}
              onToggle={(id) => toggleHabit(id)}
              onDelete={confirmDelete}
            />
          ))
        )}
      </ScrollView>

      {/* ---------- 6) FAB ---------- */}
      <PressableFX
        style={[styles.fab, { bottom: Math.max(20, insets.bottom + 8) }]}
        hitSlop={10}
        onPress={openAdd}
        disabled={atMax}
        accessibilityRole="button"
        accessibilityLabel="Yeni alışkanlık ekle"
      >
        <View style={[styles.fabCircle, atMax && styles.fabOff]}>
          <Ionicons name="add" size={26} color={C.onPrimary} />
        </View>
      </PressableFX>

      <AddHabitModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={addHabit}
        habitsCount={total}
        maxHabits={MAX_ACTIVE_HABITS}
      />
    </View>
  );
}

function makeStyles(C, type) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    content: {
      padding: 20,
      gap: 14,
    },

    // ---- başlık ----
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    title: {
      ...type.h1,
      color: C.text,
      flexShrink: 1,
    },
    subtitle: {
      ...type.small,
      color: C.textMuted,
      marginTop: -6,
    },

    // ---- özet ----
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    h3: {
      ...type.h3,
      color: C.text,
    },
    pctValue: {
      ...type.stat,
      color: C.success,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 4,
    },
    statCol: {
      alignItems: 'center',
      gap: 4,
      flex: 1,
    },
    statLabel: {
      ...type.micro,
      color: C.textMuted,
      textAlign: 'center',
    },
    statValue: {
      ...type.h3,
      color: C.text,
      fontVariant: ['tabular-nums'],
    },

    // ---- alışkanlık satırı: HabitSwipeRow (HomeScreen'den import) ----

    // ---- FAB ----
    fab: {
      position: 'absolute',
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      ...SHADOWS.card,
    },
    fabCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fabOff: {
      backgroundColor: C.surfaceLight,
    },
  });
}
