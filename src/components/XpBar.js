import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './ui/Text';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import Progress from './ui/Progress';

// Günlük XP göstergesi (anti-farm şeffaflığı): bugünkü kazanılan XP,
// günlük tavanla birlikte gösterilir. Tavan dolduysa kırmızı uyarı rengi.
// Premium: gradient seviye rozeti + animasyonlu dolu çubuk + soft glow.
export default function XpBar({ level, curXp, nextThreshold, todayXp = null, todayCap = null }) {
  const { colors: C } = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(C), [C]);
  const percent = Math.min(100, (curXp / nextThreshold) * 100);
  const capReached = todayCap != null && todayXp != null && todayXp >= todayCap;
  return (
    <View style={styles.row}>
      <LinearGradient
        colors={[C.primary, C.primaryDark]}
        style={styles.badge}
      >
        <Text style={styles.levelNumber}>{level}</Text>
        <Text style={styles.levelLabel}>{t('xp.level')}</Text>
      </LinearGradient>
      <View style={styles.block}>
        <View style={styles.header}>
          <Text style={styles.label}>{t('xp.label')}</Text>
          <Text style={styles.value}>
            {curXp} / {nextThreshold} XP
          </Text>
        </View>
        <Progress
          value={percent / 100}
          height={12}
          colors={capReached ? [C.danger, '#B91C5C'] : [C.xp, C.accent]}
          accessibilityLabel={t('xp.progressLabel', { pct: Math.round(percent) })}
        />
        {todayCap != null && todayXp != null ? (
          <Text style={[styles.hint, capReached && styles.hintCap]}>
            {capReached
              ? t('xp.capFull', { cur: todayXp, cap: todayCap })
              : t('xp.todayWithNext', {
                  cur: todayXp,
                  cap: todayCap,
                  left: nextThreshold - curXp,
                })}
          </Text>
        ) : (
          <Text style={styles.hint}>{t('xp.nextLevelLeft', { left: nextThreshold - curXp })}</Text>
        )}
      </View>
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    badge: {
      width: 76,
      height: 76,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    levelNumber: {
      color: C.onPrimary,
      fontSize: 22,
      fontWeight: '700',
      lineHeight: 32,
    },
    levelLabel: {
      color: C.onPrimary + 'CC',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      lineHeight: 16,
    },
    block: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    label: {
      color: C.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
    },
    value: {
      color: C.xp,
      fontSize: 13,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      lineHeight: 20,
    },
    hint: {
      color: C.textMuted,
      fontSize: 11,
      lineHeight: 16,
    },
    hintCap: {
      color: C.danger,
      fontWeight: '700',
    },
  });
}
