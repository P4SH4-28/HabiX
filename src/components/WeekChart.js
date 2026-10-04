// ============================================================
// WeekChart — Son 7 günün tamamlama oranını gösteren çubuk grafik
// Veriyi kendisi hesaplamaz; ProgressScreen'in useMemo ile ürettiği
// merkezi "daily" dizisinden son 7 günü alır (tek hesaplama, çift çalışma yok).
// GUI modernizasyonu (Faz C): çubuklar veri değişince kademeli (stagger)
// yaylanarak yükselir; gün değeri animasyonlu sayaçta sayılır.
// Bar yüksekliği layout prop'u olduğundan JS driver kullanılır.
// ============================================================
import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Text from './ui/Text';
import { dayNameShort } from '../logic';
import { useTheme } from '../theme';
import AnimatedCounter from './AnimatedCounter';

const DAY_COUNT = 7;

export default function WeekChart({ daily, today, total }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const days = daily.slice(-DAY_COUNT);

  const progress = useRef(Array.from({ length: DAY_COUNT }, () => new Animated.Value(0))).current;

  // Veri değişince çubuklar soldan sağa doğru kademeli yükselir.
  useEffect(() => {
    const anims = progress.map((v) =>
      Animated.spring(v, {
        toValue: 1,
        speed: 16,
        bounciness: 10,
        useNativeDriver: false,
      })
    );
    const stagger = Animated.stagger(110, anims);
    stagger.start();
    return () => stagger.stop();
  }, [progress, daily]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Haftalık Tamamlama</Text>
      <View style={styles.chart}>
        {days.map(({ key, date, done, pct }, i) => {
          const isToday = key === today;
          const heightPct = Math.max(6, Math.round(pct * 100));
          return (
            <View key={key} style={styles.column}>
              {/* Günlük tamamlanan/toplam sayısı */}
              <View style={styles.valueWrap}>
                {done > 0 ? (
                  <AnimatedCounter value={done} duration={500} style={[styles.value, isToday && styles.valueToday]} />
                ) : (
                  <Text style={[styles.value, isToday && styles.valueToday]}>0</Text>
                )}
                <Text style={styles.totalSlash}>/{total || 0}</Text>
              </View>
              {/* Çubuk yüksekliği tamamlama oranıyla orantılı */}
              <View style={styles.barTrack}>
                <Animated.View
                  style={[
                    styles.barFill,
                    {
                      height: progress[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: ['6%', `${heightPct}%`],
                      }),
                      backgroundColor: isToday ? C.primary : C.accent,
                    },
                  ]}
                />
              </View>
              {/* Gün adı (bugün vurgulu) */}
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {dayNameShort(date)}
              </Text>
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
      gap: 14,
    },
    title: {
      color: C.text,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 22,
    },
    chart: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      height: 160,
    },
    column: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: 6,
      height: '100%',
      justifyContent: 'flex-end',
    },
    valueWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 1,
    },
    value: {
      color: C.textMuted,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 16,
    },
    totalSlash: {
      color: C.textMuted,
      fontSize: 11,
      opacity: 0.6,
      lineHeight: 16,
    },
    valueToday: {
      color: C.primary,
    },
    barTrack: {
      width: 14,
      height: 90,
      borderRadius: 8,
      backgroundColor: C.surfaceLight,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    barFill: {
      width: '100%',
      borderRadius: 8,
    },
    dayLabel: {
      color: C.textMuted,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 16,
    },
    dayLabelToday: {
      color: C.primary,
      fontWeight: '700',
    },
  });
}