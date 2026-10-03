// ============================================================
// AchievementsScreen — "Başarımlar" ekranı (v3 design system, sıfırdan)
//
// YAPI:
//   1) Özet kartı  → "3/14 başarım açıldı" + kazanılan toplam altın
//   2) 3'lü grid   → açık: altın renkli (GLOW YOK) + kilit açma tarihi
//                    kilitli: gri + 🔒 + ilerleme (0/10) çubuğu
//   3) Detay modal → ikon + açıklama + ödül + tarih/ilerleme + Kapat
//   4) EmptyState  → hiç başarım açılmadıysa (kilitli grid yine görünür)
//
// DataContext API: data, today · data.achievements (id listesi, DEĞİŞMEDİ) ·
//   achievementDates (yeni, geriye uyumlu: {id: epoch_ms} — eski kayıtlarda yok).
// İlerleme mantığı korunur: progressFor + computeAchievementState (data/achievements).
//
// SAFE AREA: STACK ekranı — AppHeader 'Başarımlar', alt inset content'te.
// KURALLAR: glow/gradient/blur/loop YOK · animasyon ≤300ms (Modal fade) ·
//   h1 yok (AppHeader) · 5 tipografi ölçeği.
// ============================================================
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../context/DataContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Icon from '../components/ui/icons';
import IconTile from '../components/ui/IconTile';
import Pill from '../components/ui/Pill';
import Progress from '../components/ui/Progress';
import { ACHIEVEMENTS, computeAchievementState } from '../data/achievements';
import { RADIUS, useTheme } from '../theme';

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

// Kilit açma tarihini "12 Eki 2026" biçimine çevirir (Hermes Intl'e güvenmeden).
function formatDate(ms) {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Sayısal başarımın ilerlemesi: { cur, target } döndürür (yoksa null).
// Kilitli kartlarda çubuk ve "x/y" bu değerle çizilir.
function progressFor(achievement, state) {
  switch (achievement.id) {
    case 'first_habit':
      return { cur: state.habitCount, target: 1 };
    case 'first_done':
      return { cur: state.totalCompletions, target: 1 };
    case 'done_10':
      return { cur: state.totalCompletions, target: 10 };
    case 'done_50':
      return { cur: state.totalCompletions, target: 50 };
    case 'done_100':
      return { cur: state.totalCompletions, target: 100 };
    case 'streak_3':
      return { cur: state.bestStreak, target: 3 };
    case 'streak_7':
      return { cur: state.bestStreak, target: 7 };
    case 'streak_30':
      return { cur: state.bestStreak, target: 30 };
    case 'level_5':
      return { cur: state.level, target: 5 };
    case 'level_10':
      return { cur: state.level, target: 10 };
    case 'xp_1000':
      return { cur: state.totalXp, target: 1000 };
    case 'friend_1':
      return { cur: state.friendCount, target: 1 };
    case 'focus_1':
      return { cur: state.pomodoroCount, target: 1 };
    case 'focus_10':
      return { cur: state.pomodoroCount, target: 10 };
    default:
      return null;
  }
}

export default function AchievementsScreen() {
  const { colors: C, type } = useTheme();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const insets = useSafeAreaInsets();
  const { data, today } = useData();

  const unlockedIds = data.achievements || [];
  const dates = data.achievementDates || {};
  const state = computeAchievementState(data, today);
  const unlockedCount = unlockedIds.length;
  const totalReward = ACHIEVEMENTS.filter((a) => unlockedIds.includes(a.id)).reduce(
    (s, a) => s + (a.reward || 0),
    0
  );

  const [selected, setSelected] = useState(null);

  const close = () => setSelected(null);

  const selUnlocked = selected ? unlockedIds.includes(selected.id) : false;
  const selProg = selected ? progressFor(selected, state) : null;
  const selPct = selProg ? Math.min(1, selProg.cur / selProg.target) : 0;
  const selDate = selected && dates[selected.id] ? formatDate(dates[selected.id]) : null;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(24, insets.bottom + 24) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---------- ÖZET ---------- */}
        <Card style={styles.summaryCard}>
          <IconTile icon="trophy" emoji="🏆" variant="gold" size={52} iconSize={24} />
          <View style={styles.summaryInfo}>
            <Text variant="bodyStrong" style={styles.summaryTitle}>
              {unlockedCount}/{ACHIEVEMENTS.length} başarım açıldı
            </Text>
            <View style={styles.summarySubRow}>
              <Icon emoji="🪙" size={12} color={C.gold} />
              <Text variant="small" style={styles.summarySub}>
                Açtıkların toplam {totalReward} altın kazandırdı
              </Text>
            </View>
          </View>
        </Card>

        {/* ---------- EMPTY (hiç açılmadı) ---------- */}
        {unlockedCount === 0 ? (
          <EmptyState
            compact
            name="trophy"
            emoji="🏆"
            title="Henüz başarım yok"
            subtitle="İlk alışkanlığını ekleyip tamamladığında ilk başarım burada otomatik açılır — ödülün anında envanterine düşer."
          />
        ) : null}

        {/* ---------- 3'LÜ GRID ---------- */}
        <View style={styles.grid}>
          {ACHIEVEMENTS.map((a) => {
            const unlocked = unlockedIds.includes(a.id);
            const prog = progressFor(a, state);
            const pct = prog ? Math.min(1, prog.cur / prog.target) : 0;
            const date = dates[a.id] ? formatDate(dates[a.id]) : null;
            return (
              <Pressable
                key={a.id}
                onPress={() => setSelected(a)}
                accessibilityRole="button"
                accessibilityLabel={`${a.title} — ${unlocked ? 'açıldı' : 'kilitli'}. Detay`}
                style={({ pressed }) => [
                  styles.cell,
                  unlocked ? styles.cellUnlocked : styles.cellLocked,
                  pressed && styles.cellPressed,
                ]}
              >
                <View style={[styles.cellIcon, unlocked ? styles.cellIconOn : styles.cellIconOff]}>
                  <Icon emoji={unlocked ? a.icon : '🔒'} size={20} color={unlocked ? C.text : C.textMuted} />
                </View>
                <Text variant="micro" style={[styles.cellTitle, !unlocked && styles.cellTitleOff]} numberOfLines={2}>
                  {a.title}
                </Text>
                {unlocked ? (
                  date ? (
                    <Text variant="micro" style={styles.cellDate}>{date}</Text>
                  ) : (
                    <Text variant="micro" style={styles.cellDate}>Açıldı</Text>
                  )
                ) : prog ? (
                  <View style={styles.cellProgRow}>
                    <Progress
                      value={pct}
                      height={6}
                      colors={[C.primary, C.primaryDark]}
                      accessibilityLabel={`${a.title} ilerlemesi`}
                    />
                    <Text variant="micro" style={styles.cellProgText}>
                      {Math.min(prog.cur, prog.target)}/{prog.target}
                    </Text>
                  </View>
                ) : (
                  <Text variant="micro" style={styles.cellHint}>Şart bekleniyor</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.noteBox}>
          <Icon emoji="💡" size={13} color={C.primary} style={{ marginTop: 2 }} />
          <Text variant="small" style={styles.noteText}>
            Başarımlar otomatik açılır; altın ödülü hemen envanterine eklenir ve
            ekranın üstünde kısa bir bildirim görürsün.
          </Text>
        </View>
      </ScrollView>

      {/* ---------- DETAY MODAL ---------- */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet}>
            <Card style={styles.sheetCard}>
              <IconTile
                icon={selUnlocked ? 'trophy' : 'lock'}
                emoji={selected ? (selUnlocked ? selected.icon : '🔒') : ''}
                variant={selUnlocked ? 'gold' : 'default'}
                size={64}
                iconSize={28}
              />
              <Text variant="h3" style={styles.sheetTitle}>{selected?.title}</Text>
              <Text variant="small" style={styles.sheetDesc}>{selected?.desc}</Text>

              <View style={styles.sheetChips}>
                <Pill size="sm" bg={C.gold + '22'} color={C.gold}>
                  <Icon emoji="🪙" size={11} color={C.gold} /> +{selected?.reward || 0}
                </Pill>
                <Pill
                  size="sm"
                  bg={selUnlocked ? C.success + '22' : C.surfaceLight}
                  color={selUnlocked ? C.success : C.textMuted}
                >
                  {selUnlocked ? 'AÇILDI' : 'KİLİTLİ'}
                </Pill>
              </View>

              {selUnlocked ? (
                <View style={styles.sheetDateRow}>
                  <Icon name="calendar-outline" size={14} color={C.textMuted} />
                  <Text variant="small" style={styles.sheetDateText}>
                    {selDate ? `${selDate} tarihinde açıldı` : 'Kilit açma tarihi kaydedilmemiş'}
                  </Text>
                </View>
              ) : selProg ? (
                <View style={styles.sheetProgWrap}>
                  <View style={styles.sheetProgHead}>
                    <Text variant="micro" style={styles.sheetProgLabel}>İLERLEME</Text>
                    <Text variant="micro" style={styles.sheetProgValue}>
                      {Math.min(selProg.cur, selProg.target)}/{selProg.target}
                    </Text>
                  </View>
                  <Progress
                    value={selPct}
                    height={8}
                    colors={[C.primary, C.primaryDark]}
                    accessibilityLabel={`${selected?.title} ilerlemesi`}
                  />
                </View>
              ) : (
                <Text variant="small" style={styles.sheetHint}>Şartını sağladığında otomatik açılır.</Text>
              )}

              <Button label="Kapat" variant="ghost" fullWidth onPress={close} />
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(C, type) {
  return StyleSheet.create({
    container: {
      flex: 1,
      minWidth: 0,
      backgroundColor: C.background,
    },
    content: {
      padding: 20,
      gap: 12,
    },

    // ---- özet ----
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    summaryInfo: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    summarySubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    summaryTitle: {
      ...type.bodyStrong,
      color: C.text,
      lineHeight: 21,
    },
    summarySub: {
      ...type.small,
      color: C.textMuted,
      lineHeight: 18,
    },

    // ---- grid ----
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    cell: {
      flexBasis: '31%',
      flexGrow: 1,
      borderRadius: 16,
      borderWidth: 1,
      paddingVertical: 14,
      paddingHorizontal: 8,
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.surface,
      minHeight: 116,
      justifyContent: 'center',
    },
    cellUnlocked: {
      borderColor: C.gold + '66',
      backgroundColor: C.surface,
    },
    cellLocked: {
      borderColor: C.border,
      backgroundColor: C.surfaceLight,
      opacity: 0.9,
    },
    cellPressed: {
      opacity: 0.7,
    },
    cellIcon: {
      width: 42,
      height: 42,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellIconOn: {
      backgroundColor: C.gold + '22',
    },
    cellIconOff: {
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    cellTitle: {
      ...type.micro,
      color: C.text,
      fontWeight: '700',
      textAlign: 'center',
      fontSize: 11,
      lineHeight: 14,
    },
    cellTitleOff: {
      color: C.textMuted,
    },
    cellDate: {
      ...type.micro,
      color: C.gold,
      fontVariant: ['tabular-nums'],
      lineHeight: 14,
    },
    cellProgRow: {
      width: '100%',
      gap: 4,
    },
    cellProgText: {
      ...type.micro,
      color: C.textMuted,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
      lineHeight: 14,
    },
    cellHint: {
      ...type.micro,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 14,
    },

    // ---- not ----
    noteBox: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: C.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
      marginTop: 4,
    },
    noteText: {
      ...type.small,
      color: C.textMuted,
      flex: 1,
      minWidth: 0,
      lineHeight: 18,
    },

    // ---- modal ----
    backdrop: {
      flex: 1,
      minWidth: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      padding: 24,
    },
    sheet: {
      width: '100%',
    },
    sheetCard: {
      alignItems: 'center',
      gap: 12,
      paddingVertical: 24,
    },
    sheetTitle: {
      ...type.h3,
      color: C.text,
      textAlign: 'center',
      lineHeight: 24,
    },
    sheetDesc: {
      ...type.small,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 18,
    },
    sheetChips: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    sheetDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.surfaceLight,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    sheetDateText: {
      ...type.small,
      color: C.textMuted,
      fontVariant: ['tabular-nums'],
      lineHeight: 18,
    },
    sheetProgWrap: {
      width: '100%',
      gap: 6,
    },
    sheetProgHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    sheetProgLabel: {
      ...type.micro,
      color: C.textMuted,
      lineHeight: 14,
    },
    sheetProgValue: {
      ...type.micro,
      color: C.primary,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      lineHeight: 14,
    },
    sheetHint: {
      ...type.small,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}
