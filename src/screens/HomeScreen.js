// ============================================================
// HomeScreen — "Bugün" sekmesi (v3 design system ile sıfırdan)
//
// YAPI:
//   1) Header          → karşılama (h1) + tarih · bildirim · avatar · XP rozeti
//   2) Bugünkü İlerleme→ yüzde (h1/success) + Progress + 3 istatistik
//   3) Seviye kartı     → daire seviye göstergesi + XP ilerlemesi
//   4) Günün Görevleri → dokunulabilir (QuestBoard)
//   5) Pomodoro         → mevcut PomodoroTimer (mantık aynen)
//   6) Alışkanlıklar    → boşta öneri çipleri, doluysa satır kartları
//   7) FAB              → AddHabitModal
//
// DataContext hook'ları ve callback'leri DEĞİŞMEDİ:
//   useData → data, today, toggleHabit, deleteHabit, addHabit,
//             refreshServer, refreshing, pushToast
//   navigation → QuestBoard
//
// KURALLAR: glow/gradient/blur/loop YOK · animasyon ≤300ms
//   (yalnız PressableFX 100ms + Progress 300ms) · 4 vurgu rengi
//   (primary/success/gold/warning) · 9 emoji · 5 tipografi boyutu.
//
// SAFE AREA: üst safe-area AppHeader (TopBar paddingTop: insets.top+6),
//   alt safe-area PillTabBar (paddingBottom: insets.bottom) tarafından
//   tüketilir. Ekran ikisini TEKRAR uygulamaz (çift dolgu olurdu);
//   insets yalnız alt tampon (FAB/scroll) için kullanılır.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, useSharedValue, withSpring } from 'react-native-reanimated';
import AddHabitModal from '../components/AddHabitModal';
import AnimatedCounter from '../components/AnimatedCounter';
import AvatarCircle from '../components/AvatarCircle';
import NotificationBell from '../components/NotificationBell';
import PomodoroTimer from '../components/PomodoroTimer';
import PressableFX from '../components/PressableFX';
import { confirmDialog } from '../components/memoizedHabitCard';
import Card from '../components/ui/Card';
import Icon from '../components/ui/icons';
import IconTile from '../components/ui/IconTile';
import Pill from '../components/ui/Pill';
import Progress from '../components/ui/Progress';
import SectionHeader from '../components/ui/SectionHeader';
import { useData } from '../context/DataContext';
import { canClaimQuest, getDailyQuests, questClaimedToday } from '../data/quests';
import { STARTER_HABITS } from '../data/starterHabits';
import useReducedMotion from '../hooks/useReducedMotion';
import {
  bestStreak,
  calcStreak,
  levelFromTotalXp,
  MAX_ACTIVE_HABITS,
} from '../logic';
import { SHADOWS, useTheme } from '../theme';

const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export default function HomeScreen() {
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
  const navigation = useNavigation();
  const { habits, stats, settings } = data;
  const freezeDay = data.activeEffects?.streakFreeze || null;
  const levelInfo = levelFromTotalXp(stats.totalXp);
  const [modalVisible, setModalVisible] = useState(false);

  // ---------- türetilmiş veriler ----------
  const doneToday = habits.filter((h) => h.completedDates.includes(today)).length;
  const total = habits.length;
  const pct = total > 0 ? doneToday / total : 0;
  const bestStreakValue = bestStreak(habits, today);
  const todayXp = stats.day?.key === today ? stats.day.xpEarned || 0 : 0;
  const levelPct =
    levelInfo.nextThreshold > 0
      ? Math.min(1, levelInfo.curXp / levelInfo.nextThreshold)
      : 0;
  const xpLeft = Math.max(0, levelInfo.nextThreshold - levelInfo.curXp);

  const now = new Date();
  const dateLabel = `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

  // Görev özeti: bugün bitirilen + ödülü hazır olan görevler.
  const questSummary = useMemo(() => {
    const claims = data.questClaims || {};
    const { base, vip } = getDailyQuests(today);
    const all = [...base, ...vip];
    const doneCount = all.filter((q) => questClaimedToday(q, claims, today)).length;
    const readyCount = all.filter((q) =>
      canClaimQuest(q, data.stats.day, claims, today, data.habits)
    ).length;
    return { doneCount, readyCount, total: all.length };
  }, [data.questClaims, data.stats.day, data.habits, today]);

  // ---------- callback'ler (DataContext ile aynen) ----------
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

  const openQuests = useCallback(() => navigation.navigate('QuestBoard'), [navigation]);
  // "Tümünü gör" → App.js'de kayıtlı "Habits" stack route'u (yığından geri döner).
  const openHabits = useCallback(() => navigation.navigate('Habits'), [navigation]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(120, insets.bottom + 100) },
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
        {/* ---------- 1) HEADER ---------- */}
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.greeting} numberOfLines={1}>
              {greeting}
            </Text>
            <Text style={styles.dateText} numberOfLines={1}>
              {dateLabel}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <NotificationBell />
            <AvatarCircle
              avatarId={data.settings.avatarId}
              frameId={data.settings.frameId}
              photo={data.settings.photoUrl}
              size={40}
              ringColor={C.primary}
            />
            <Pill size="sm" bg={C.gold + '1A'} color={C.gold}>
              <AnimatedCounter value={stats.totalXp || 0} /> XP
            </Pill>
          </View>
        </View>

        {/* ---------- 2) BUGÜNKÜ İLERLEME ---------- */}
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
              <Icon emoji="⚡" size={16} color={C.textMuted} />
              <Text style={styles.statLabel}>Bugün XP</Text>
              <AnimatedCounter value={todayXp} style={styles.statValue} />
            </View>
            <View style={styles.statCol}>
              <Ionicons name="checkmark-circle" size={16} color={C.textMuted} />
              <Text style={styles.statLabel}>Tamamlanan</Text>
              <Text style={styles.statValue}>
                <AnimatedCounter value={doneToday} style={styles.statValue} />/{total}
              </Text>
            </View>
          </View>
          <Text style={styles.hint}>
            Alışkanlık başına +{settings.xpPerHabit} XP kazanırsın
          </Text>
        </Card>

        {/* ---------- 3) SEVİYE KARTI ---------- */}
        <Card variant="elevated">
          <View style={styles.levelRow}>
            <View style={styles.levelCircle}>
              <Text style={styles.levelNum}>{levelInfo.level}</Text>
              <Text style={styles.levelLabel}>SEVİYE</Text>
            </View>
            <View style={styles.levelInfo}>
              <Text style={styles.h3}>Deneyim</Text>
              <Text style={styles.xpText}>
                {levelInfo.curXp} / {levelInfo.nextThreshold} XP
              </Text>
              <Progress
                value={levelPct}
                height={6}
                colors={[C.primary, C.primary]}
                accessibilityLabel={`Seviye ilerlemesi yüzde ${Math.round(levelPct * 100)}`}
              />
              <Text style={styles.hint}>Sonraki seviyeye {xpLeft} XP kaldı</Text>
            </View>
          </View>
        </Card>

        {/* ---------- 4) GÜNÜN GÖREVLERİ ---------- */}
        <Card onPress={openQuests} accessibilityLabel="Günün görevleri">
          <View style={styles.rowBetween}>
            <View style={styles.titleRow}>
              <Icon emoji="🎯" size={16} color={C.primary} />
              <Text style={styles.h3}>Günün Görevleri</Text>
            </View>
            <View style={styles.statusRow}>
              <Text
                style={[
                  styles.status,
                  { color: questSummary.readyCount > 0 ? C.success : C.warning },
                ]}
              >
                {questSummary.readyCount > 0
                  ? `${questSummary.readyCount} hazır`
                  : 'beklemede'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
            </View>
          </View>
          <Text style={styles.hint}>
            {questSummary.doneCount > 0
              ? `Bugün ${questSummary.doneCount}/${questSummary.total} görev tamamladın`
              : 'Henüz görev bitirmedin'}{' '}
            • Görevler her gün sıfırlanır →
          </Text>
        </Card>

        {/* ---------- 5) POMODORO (mevcut bileşen, mantık aynen) ---------- */}
        <PomodoroTimer />

        {/* ---------- 6) ALIŞKANLIKLAR ---------- */}
        <SectionHeader
          title={`Alışkanlıklar (${habits.length})`}
          actionLabel="Tümünü gör →"
          onAction={openHabits}
        />

        {habits.length === 0 ? (
          <EmptySuggestions onQuickAdd={quickAdd} />
        ) : (
          habits.map((h) => (
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

      {/* ---------- 7) FAB ---------- */}
      <PressableFX
        style={styles.fab}
        hitSlop={10}
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Yeni alışkanlık ekle"
      >
        <View style={styles.fabCircle}>
          <Ionicons name="add" size={26} color={C.onPrimary} />
        </View>
      </PressableFX>

      <AddHabitModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={addHabit}
        habitsCount={habits.length}
        maxHabits={MAX_ACTIVE_HABITS}
      />
    </View>
  );
}

// ---------- Swipe'lı alışkanlık satırı (HabitsScreen de import eder) ----------
// Sola kaydır → kırmızı "Sil" butonu açılır · tam kaydır → confirmDialog + sil
// · uzun bas → aynı onay (yedek) · tap → tamamla (açıkken kapatır).
// gesture-handler KURULU DEĞİL → PanResponder + Reanimated.
const ROW_OPEN_X = 96; // açık konum = Sil butonu genişliği
const ROW_FULL_X = 140; // kaydırma kiliti (clamped)
const ROW_OPEN_MIN = -48; // buradan açıksa açık konuma otur
const ROW_FULL_MIN = -120; // buradan ilerisi = tam kaydırma (onay + sil)
const ROW_SPRING = { duration: 200, dampingRatio: 0.95 }; // ≤200ms

export function HabitSwipeRow({ habit, done, streak, onToggle, onDelete }) {
  const { colors: C, type } = useTheme();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const reduced = useReducedMotion();
  const openRef = useRef(false);
  const tx = useSharedValue(0);
  // PanResponder tek sefer oluşturulur; handler'lar ref üzerinden güncel kalır.
  const cbRef = useRef({ onToggle, onDelete, habit });
  cbRef.current = { onToggle, onDelete, habit };

  // Prensip: animasyon başlatan bileşen unmount olurken iptal etmeli.
  useEffect(() => () => cancelAnimation(tx), [tx]);

  const springTo = (target) => {
    tx.value = reduced ? target : withSpring(target, ROW_SPRING);
  };
  const setOpenState = (next) => {
    openRef.current = next;
  };

  const responderRef = useRef(null);
  if (!responderRef.current) {
    responderRef.current = PanResponder.create({
      // Yalnız yatay hareket olayı "kapar" (dikey scroll/normal tap bozulmaz).
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderMove: (_, g) => {
        const base = openRef.current ? -ROW_OPEN_X : 0;
        tx.value = Math.max(-ROW_FULL_X, Math.min(0, base + g.dx));
      },
      onPanResponderRelease: (_, g) => {
        const x = tx.value;
        const fullSwipe = x <= ROW_FULL_MIN || (x <= ROW_OPEN_MIN && g.vx < -1.0);
        if (fullSwipe) {
          setOpenState(false);
          springTo(0);
          cbRef.current.onDelete(cbRef.current.habit.id);
          return;
        }
        if (x <= ROW_OPEN_MIN || g.vx < -0.5) {
          setOpenState(true);
          springTo(-ROW_OPEN_X);
        } else {
          setOpenState(false);
          springTo(0);
        }
      },
      onPanResponderTerminate: () => {
        springTo(openRef.current ? -ROW_OPEN_X : 0);
      },
    });
  }

  const handlePress = () => {
    if (openRef.current) {
      setOpenState(false);
      springTo(0);
      return;
    }
    onToggle(habit.id);
  };

  return (
    <View style={styles.swipeBox}>
      <Pressable
        style={styles.deleteBtn}
        onPress={() => onDelete(habit.id)}
        accessibilityRole="button"
        accessibilityLabel={`Sil: ${habit.name}`}
      >
        <Ionicons name="trash" size={18} color={C.onPrimary} />
        <Text style={styles.deleteLabel}>Sil</Text>
      </Pressable>

      <Animated.View
        style={[styles.slide, { transform: [{ translateX: tx }] }]}
        {...responderRef.current.panHandlers}
      >
        <PressableFX
          onPress={handlePress}
          onLongPress={() => onDelete(habit.id)}
          scale={0.98}
          accessibilityLabel={`${habit.name}, ${done ? 'tamamlandı' : 'tamamlanmadı'}, ${streak} gün seri, silmek için sola kaydır`}
          accessibilityState={{ selected: done }}
        >
          <Card>
            <View style={styles.habitRow}>
              <IconTile emoji={habit.emoji} tint={habit.color} size={40} />
              <View style={styles.habitInfo}>
                <Text style={styles.habitName} numberOfLines={1}>
                  {habit.name}
                </Text>
                <Text style={styles.habitStreak}>
                  {streak > 0 ? `🔥 ${streak} gün seri` : 'Bugün başla'}
                </Text>
              </View>
              <View style={[styles.checkbox, done && styles.checkboxOn]}>
                {done ? <Ionicons name="checkmark" size={16} color={C.onPrimary} /> : null}
              </View>
            </View>
          </Card>
        </PressableFX>
      </Animated.View>
    </View>
  );
}

// ---------- Boş durum: ikon + başlık + 6 hızlı başlangıç çipi (2 sütun) ----------
function EmptySuggestions({ onQuickAdd }) {
  const { colors: C, type } = useTheme();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  return (
    <View style={styles.emptyBox}>
      <IconTile name="leaf" tint={C.success} size={64} />
      <Text style={styles.h3}>İlk alışkanlığını ekle</Text>
      <Text style={styles.emptyText}>Hazır bir başlangıç seç veya + butonuna dokun</Text>
      <View style={styles.chipGrid}>
        {STARTER_HABITS.map((h) => (
          <Card
            key={h.name}
            variant="outline"
            padding="sm"
            style={styles.chip}
            onPress={() => onQuickAdd(h)}
            accessibilityLabel={`Ekle: ${h.name}`}
          >
            <View style={styles.chipRow}>
              <Text style={styles.chipEmoji}>{h.emoji}</Text>
              <Text style={styles.chipText} numberOfLines={1}>
                {h.name}
              </Text>
            </View>
          </Card>
        ))}
      </View>
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
      paddingHorizontal: 20,
      paddingTop: 16,
      gap: 16,
    },

    // ---- header ----
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    greeting: {
      ...type.h1,
      color: C.text,
    },
    dateText: {
      ...type.small,
      color: C.textMuted,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    // ---- ortak ----
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 1,
    },
    h3: {
      ...type.h3,
      color: C.text,
    },
    hint: {
      ...type.small,
      color: C.textMuted,
    },

    // ---- bugünkü ilerleme ----
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

    // ---- seviye ----
    levelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    levelCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    levelNum: {
      ...type.stat,
      color: C.onPrimary,
    },
    levelLabel: {
      ...type.micro,
      color: C.onPrimary,
      opacity: 0.85,
    },
    levelInfo: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    xpText: {
      ...type.small,
      color: C.gold,
      fontVariant: ['tabular-nums'],
    },

    // ---- görev ----
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    status: {
      ...type.micro,
    },

    // ---- alışkanlık satırı (swipe) ----
    swipeBox: {
      borderRadius: 16,
      overflow: 'hidden',
    },
    deleteBtn: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: ROW_OPEN_X,
      backgroundColor: C.danger,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    deleteLabel: {
      ...type.small,
      fontWeight: '600',
      color: C.onPrimary,
    },
    slide: {
      // translateX Reanimated shared value ile sürülür
    },
    habitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    habitInfo: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    habitName: {
      ...type.h3,
      color: C.text,
    },
    habitStreak: {
      ...type.small,
      color: C.textMuted,
    },
    checkbox: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxOn: {
      backgroundColor: C.success,
      borderColor: C.success,
    },

    // ---- boş durum ----
    emptyBox: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 24,
      paddingHorizontal: 4,
    },
    emptyText: {
      ...type.small,
      color: C.textMuted,
      textAlign: 'center',
    },
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 12,
      alignSelf: 'stretch',
    },
    chip: {
      width: '47.5%',
    },
    chipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    chipEmoji: {
      fontSize: 16,
    },
    chipText: {
      ...type.small,
      color: C.text,
      flexShrink: 1,
    },

    // ---- FAB ----
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 20,
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
  });
}
