// ============================================================
// AchievementsGrid — Başarım (rozet) ızgarası
// Gelişim sekmesinin altında tüm başarımları gösterir.
// Açılmış olanlar renkli ve ikonlu; açılmamışlar karartılmış ve 🔒.
// ============================================================
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './ui/Text';
import { ACHIEVEMENTS } from '../data/achievements';
import { useTheme } from '../theme';
import { useT } from '../i18n';

export default function AchievementsGrid({ unlockedIds }) {
  const { colors: C } = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(C), [C]);
  const unlockedSet = new Set(unlockedIds || []);
  const unlockedCount = unlockedSet.size;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{`🏆 ${t('achievement.title')}`}</Text>
        <Text style={styles.counter}>
          {unlockedCount}/{ACHIEVEMENTS.length}
        </Text>
      </View>

      <View style={styles.grid}>
        {ACHIEVEMENTS.map((a) => {
          const unlocked = unlockedSet.has(a.id);
          return (
            <View key={a.id} style={[styles.badge, !unlocked && styles.badgeLocked]}>
              <View style={[styles.iconCircle, !unlocked && styles.iconCircleLocked]}>
                <Text style={[styles.icon, !unlocked && styles.iconLocked]}>
                  {unlocked ? a.icon : '🔒'}
                </Text>
              </View>
              <Text style={[styles.badgeTitle, !unlocked && styles.badgeTitleLocked]} numberOfLines={2}>
                {a.title}
              </Text>
              <Text style={styles.badgeDesc} numberOfLines={2}>
                {a.desc}
              </Text>
              {/* Başarımın altın ödülü (kilitliyken de görünür — hedef verir) */}
              <Text style={styles.badgeReward}>+{a.reward} 🪙</Text>
            </View>
          );
        })}
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
      marginBottom: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    title: {
      color: C.text,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 22,
    },
    counter: {
      color: C.gold,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 20,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    badge: {
      width: '31%',
      alignItems: 'center',
      backgroundColor: C.background,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 4,
    },
    badgeLocked: {
      opacity: 0.55,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 999,
      backgroundColor: 'rgba(124, 92, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    iconCircleLocked: {
      backgroundColor: 'rgba(138, 148, 166, 0.15)',
    },
    icon: {
      fontSize: 22,
      lineHeight: 32,
    },
    iconLocked: {
      opacity: 0.8,
    },
    badgeTitle: {
      color: C.text,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 16,
    },
    badgeTitleLocked: {
      color: C.textMuted,
    },
    badgeDesc: {
      color: C.textMuted,
      fontSize: 11,
      textAlign: 'center',
      marginTop: 2,
      lineHeight: 16,
    },
    badgeReward: {
      color: C.gold,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 3,
      lineHeight: 16,
    },
  });
}
