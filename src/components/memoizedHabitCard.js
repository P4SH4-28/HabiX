// ============================================================
// memoizedHabitCard — Premium habit kartı (React.memo)
// - Reanimated animasyonlu radio/checkbox: tamamlanınca emerald
//   gradient dolu daire spring ile "bonk" + geçici glow halkası
// - Streak pill (🔥/❄️), yarı saydam kenarlık, köşe 20
// - React.memo: değişmeyen prop'lar yeniden render etmez
// ============================================================
import React, { useEffect, useMemo, useRef } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import Text from './ui/Text';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { calcStreak } from '../logic';
import { useData } from '../context/DataContext';
import { useTheme } from '../theme';

// Silme onayı: mobilde doğal Alert, web'de tarayıcının confirm kutusu.
export function confirmDialog(title, message, onOk) {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onOk();
  } else {
    Alert.alert(title, message, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: onOk },
    ]);
  }
}

const SPRING = { damping: 12, stiffness: 260, mass: 0.6 };

const HabitCard = React.memo(function HabitCard({ habit, today, onToggle, onDelete }) {
  const { colors: C, radius } = useTheme();
  const styles = useMemo(() => makeStyles(C, radius), [C, radius]);
  const freezeDay = useData().data.activeEffects?.streakFreeze || null;
  const completedToday = habit.completedDates.includes(today);
  const frozen = !!freezeDay && !completedToday;
  const streak = calcStreak(habit.completedDates, today, freezeDay);

  // Tamamlanma animasyonu: ilk "yapıldı" geçişinde ✓ spring ile gelir,
  // çevresinde accent renkli glow bir kez parlarken söner.
  const prevDone = useRef(completedToday);
  const checkScale = useSharedValue(completedToday ? 1 : 0.4);
  const glowP = useSharedValue(0);

  useEffect(() => {
    if (completedToday && !prevDone.current) {
      checkScale.value = 0.4;
      glowP.value = 0;
      checkScale.value = withSpring(1, SPRING);
      glowP.value = withTiming(1, { duration: 300 });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }
    prevDone.current = completedToday;
  }, [completedToday, checkScale, glowP]);

  const checkAnim = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));
  const glowAnim = useAnimatedStyle(() => ({
    opacity: 0.55 - glowP.value * 0.55,
    transform: [{ scale: 0.6 + glowP.value * 1.15 }],
  }));

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        completedToday && { borderWidth: 1, borderColor: habit.color + '55' },
        pressed && { transform: [{ scale: 0.985 }] },
      ]}
      onLongPress={() =>
        confirmDialog('Alışkanlığı sil', `"${habit.name}" silinecek. Emin misin?`, () =>
          onDelete(habit.id)
        )
      }
      accessibilityRole="button"
      accessibilityLabel={`${habit.name}, ${completedToday ? 'bugün tamamlandı' : 'bugün henüz yapılmadı'}, seri ${streak}`}
      accessibilityHint="Uzun bas: alışkanlığı sil"
    >
      {/* Alışkanlığın rengiyle boyanmış emoji rozeti */}
      <View style={[styles.emojiBox, { backgroundColor: habit.color + '1F' }]}>
        <Text style={styles.emoji}>{habit.emoji || '✅'}</Text>
      </View>

      {/* Tamamlama butonu: dolu emerald gradient = bugün tamamlandı */}
      <Pressable
        style={styles.checkbox}
        onPress={() => onToggle(habit.id)}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!completedToday }}
        accessibilityLabel={`${habit.name} tamamlandı`}
      >
        <View>
          <Animated.View
            pointerEvents="none"
            style={[styles.glowRing, { backgroundColor: C.accent, borderColor: C.accent }, glowAnim]}
          />
          {completedToday ? (
            <Animated.View style={checkAnim}>
              <LinearGradient
                colors={[C.accent, '#0E8F6A']}
                style={styles.checkCircle}
              >
                <Text style={styles.checkmark}>✓</Text>
              </LinearGradient>
            </Animated.View>
          ) : (
            <View style={[styles.checkCircle, styles.checkCircleEmpty]} />
          )}
        </View>
      </Pressable>

      {/* Alışkanlık adı ve bugünkü durumu */}
      <View style={styles.info}>
        <Text style={[styles.name, completedToday && styles.nameDone]} numberOfLines={1}>
          {habit.name}
        </Text>
        <Text style={styles.meta}>
          {completedToday ? 'Bugün tamamlandı' : 'Bugün henüz yapılmadı'}
        </Text>
      </View>

      {/* 🔥/❄️ Seri sayacı pill'i */}
      <View style={[styles.streakBadge]}>
        <Text style={styles.streakIcon}>{frozen ? '❄️' : '🔥'}</Text>
        <Text style={styles.streakText}>{streak}</Text>
      </View>
    </Pressable>
  );
});

function makeStyles(C, radius) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surface,
      borderRadius: radius.card,
      padding: 16,
      marginBottom: 10,
      gap: 12,
    },
    emojiBox: {
      width: 42,
      height: 42,
      borderRadius: radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emoji: {
      fontSize: 22,
      lineHeight: 30,
    },
    checkbox: {
      width: 34,
      alignItems: 'center',
    },
    glowRing: {
      position: 'absolute',
      top: -7,
      left: -7,
      width: 42,
      height: 42,
      borderRadius: 20,
      borderWidth: 2,
      opacity: 0,
    },
    checkCircle: {
      width: 28,
      height: 28,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkCircleEmpty: {
      borderWidth: 2,
      borderColor: C.textMuted + '55',
      backgroundColor: 'transparent',
    },
    checkmark: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 21,
    },
    info: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    name: {
      color: C.text,
      fontSize: 15,
      fontWeight: '600',
      lineHeight: 21,
    },
    nameDone: {
      textDecorationLine: 'line-through',
      color: C.textMuted,
    },
    meta: {
      color: C.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surfaceLight,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 4,
    },
    streakIcon: {
      fontSize: 13,
      lineHeight: 18,
    },
    streakText: {
      color: C.text,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
  });
}

export default HabitCard;