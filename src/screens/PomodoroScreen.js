// ============================================================
// PomodoroScreen — "Odak Zamanı" alt ekranı (v3 design system)
//
// YAPI:
//   1) Üst satır     → durum rozeti (HAZIR/ODAKTA/DURAKLADI) + XP ödülü
//   2) Süre seçici    → 15 / 25 / 45 dk (yalnız boşta değişir)
//   3) Halka         → 60 parçacıklı View progress ring (SVG YOK)
//                      + ortada kalan süre + toplam süre
//   4) Kontroller     → Başlat · Duraklat · Devam · Sıfırla
//   5) Özet          → toplam seans / bugün
//   6) Son 5 seans    → data.sessionLog (DataContext)
//
// DataContext API (1A+2A genişletmeleri, geriye uyumlu):
//   startPomodoro(durationMs?) · resetPomodoro(durationMs?) ·
//   pausePomodoro · resumePomodoro · completePomodoro ·
//   data.pomodoro { state, endAt, remainingMs, sessionMs } · data.sessionLog
//
// ZAMANLAMA: endAt tabanlı (serverNow) → arka planda/kapalıyken doğru;
//   500ms tick YALNIZCA 'running' iken çalışır.
//
// SAFE AREA: üst başlık Stack header'ı (STACK_TITLES['Pomodoro']) karşılar;
//   alt inset bu ekran uygular.
//
// KURALLAR: glow/gradient/blur/loop YOK · animasyon YOK (tick render,
//   ≤300ms gerekirse) · 3 vurgu rengi (primary/success/gold) ·
//   emoji glyph yok (Icon → Ionicons) · 5 tipografi boyutu + displayXl (yalnız timer).
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../context/DataContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Icon from '../components/ui/icons';
import Pill from '../components/ui/Pill';
import SectionHeader from '../components/ui/SectionHeader';
import SegmentedTabs from '../components/ui/SegmentedTabs';
import { formatDuration, POMODORO_DURATION_MS } from '../logic';
import { RADIUS, useTheme } from '../theme';

const SEGMENTS = 60; // halka parçacığı (SVG yok → View dizisi)
const RING = 220; // halka kapsayıcısı (px)
const SLOT_H = 200; // parçacık yuvası yüksekliği = halka çapı
const DURATIONS = [
  { key: '15', label: '15 dk', ms: 15 * 60 * 1000 },
  { key: '25', label: '25 dk', ms: 25 * 60 * 1000 },
  { key: '45', label: '45 dk', ms: 45 * 60 * 1000 },
];
const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const pad2 = (n) => String(n).padStart(2, '0');

// timestamp → "Bugün 14:32" / "Dün 14:32" / "6 Ekim 14:32"
function whenLabel(at, todayKey) {
  const d = new Date(at);
  const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (key === todayKey) return `Bugün ${time}`;
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  const yKey = `${y.getFullYear()}-${pad2(y.getMonth() + 1)}-${pad2(y.getDate())}`;
  if (yKey === todayKey) return `Dün ${time}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${time}`;
}

export default function PomodoroScreen() {
  const { colors: C, type } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const {
    data,
    today,
    startPomodoro,
    pausePomodoro,
    resumePomodoro,
    resetPomodoro,
    completePomodoro,
  } = useData();

  const pomodoro = data.pomodoro;
  const state = pomodoro.state; // 'idle' | 'running' | 'paused'
  const xpReward = data.settings.pomodoroXp || 50;
  const sessionLog = data.sessionLog || [];

  // ---------- zamanlama ----------
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (state !== 'running') return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [state]);

  const remainingMs =
    state === 'running' ? Math.max(0, pomodoro.endAt - now) : pomodoro.remainingMs;

  // Oturum toplamı: 1A ile gelen sessionMs; eski kayıtlarda kalan süredir.
  const totalMs =
    typeof pomodoro.sessionMs === 'number' && pomodoro.sessionMs > 0
      ? pomodoro.sessionMs
      : pomodoro.remainingMs > 0
        ? pomodoro.remainingMs
        : POMODORO_DURATION_MS;

  // Süre dolunca ödül YALNIZCA bir kez tetiklenir (ref koruması).
  // DataContext'te de aynı kontrol var; çift çağrı guard'larla imkânsız.
  const completedRef = useRef(false);
  useEffect(() => {
    if (state !== 'running') {
      completedRef.current = false;
      return;
    }
    if (remainingMs <= 0 && !completedRef.current) {
      completedRef.current = true;
      completePomodoro();
    }
  }, [remainingMs, state, completePomodoro]);

  // ---------- türetilmiş ----------
  const progress =
    totalMs > 0 ? Math.max(0, Math.min(1, 1 - remainingMs / totalMs)) : 0;
  const filled = Math.round(progress * SEGMENTS);

  const selectedKey = useMemo(() => {
    const mins = Math.round((state === 'idle' ? pomodoro.remainingMs : totalMs) / 60000);
    const hit = DURATIONS.find((d) => d.ms === mins * 60 * 1000);
    return hit ? hit.key : '25';
  }, [state, pomodoro.remainingMs, totalMs]);

  const chip =
    state === 'running'
      ? { label: 'ODAKTA', color: C.success }
      : state === 'paused'
        ? { label: 'DURAKLADI', color: C.gold }
        : { label: 'HAZIR', color: C.textMuted };

  // ---------- eylemler ----------
  const onSelectDuration = (key) => {
    if (state !== 'idle') return; // seans sürerken süre değiştirilemez
    const opt = DURATIONS.find((d) => d.key === key);
    if (opt) resetPomodoro(opt.ms); // seçici + halka DataContext ile senkron
  };
  const onStart = () => startPomodoro(totalMs);
  const onReset = () => resetPomodoro(totalMs);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(24, insets.bottom + 24) },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ---------- 1) DURUM + ÖDÜL ---------- */}
      <View style={styles.topRow}>
        <Pill size="sm" bg={chip.color + '1A'} color={chip.color}>
          {chip.label}
        </Pill>
        <Pill size="sm" icon="⚡" bg={C.gold + '1A'} color={C.gold}>
          +{xpReward} XP · +15 🪙
        </Pill>
      </View>

      {/* ---------- 2) SÜRE SEÇİCİ ---------- */}
      <Card>
        <Text variant="micro" style={styles.microLabel}>SÜRE</Text>
        <SegmentedTabs options={DURATIONS} value={selectedKey} onChange={onSelectDuration} />
        <Text variant="small" style={styles.hint}>
          {state === 'idle'
            ? 'Seçili süre bir sonraki seansa uygulanır.'
            : 'Seans sürerken süre değiştirilemez.'}
        </Text>
      </Card>

      {/* ---------- 3) HALKA ---------- */}
      <View
        style={styles.ringWrap}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Kalan süre ${formatDuration(remainingMs)}`}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.round(progress * 100),
        }}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <View
            key={i}
            style={[
              styles.segSlot,
              { transform: [{ rotate: `${(360 / SEGMENTS) * i}deg` }] },
            ]}
          >
            <View
              style={[
                styles.segDot,
                {
                  backgroundColor:
                    i < filled ? (state === 'running' ? C.success : C.primary) : C.surfaceLight,
                },
              ]}
            />
          </View>
        ))}
        <View style={styles.ringCenter}>
          <Text variant="displayXl" style={styles.time}>{formatDuration(remainingMs)}</Text>
          <Text variant="micro" style={styles.timeSub}>
            {state === 'running' ? 'kalan süre' : `toplam ${Math.round(totalMs / 60000)} dk`}
          </Text>
        </View>
      </View>

      {/* ---------- 4) KONTROLLER ---------- */}
      <View style={styles.controls}>
        {state === 'idle' && (
          <Button
            label="Başlat"
            variant="primary"
            size="lg"
            fullWidth
            icon="▶"
            onPress={onStart}
          />
        )}
        {state === 'running' && (
          <>
            <Button
              label="Duraklat"
              variant="secondary"
              size="lg"
              icon="⏸"
              style={styles.btnFlex}
              onPress={pausePomodoro}
            />
            <Button label="Sıfırla" variant="ghost" size="lg" icon="↺" onPress={onReset} />
          </>
        )}
        {state === 'paused' && (
          <>
            <Button
              label="Devam"
              variant="primary"
              size="lg"
              icon="▶"
              style={styles.btnFlex}
              onPress={resumePomodoro}
            />
            <Button label="Sıfırla" variant="ghost" size="lg" icon="↺" onPress={onReset} />
          </>
        )}
      </View>

      {/* ---------- 5) ÖZET ---------- */}
      <View style={styles.statsRow}>
        <Card padding="sm" style={styles.statCard}>
          <Icon emoji="🍅" size={16} color={C.primary} />
          <Text variant="h3" style={styles.statValue}>{data.stats.pomodoroCount || 0}</Text>
          <Text variant="micro" style={styles.statLabel}>TOPLAM SEANS</Text>
        </Card>
        <Card padding="sm" style={styles.statCard}>
          <Icon emoji="📅" size={16} color={C.success} />
          <Text variant="h3" style={styles.statValue}>{data.stats.day?.pomodoro || 0}</Text>
          <Text variant="micro" style={styles.statLabel}>BUGÜN</Text>
        </Card>
      </View>

      {/* ---------- 6) SON 5 SEANS ---------- */}
      <View>
        <SectionHeader title="Son 5 Seans" />
        <Card>
          {sessionLog.length === 0 ? (
            <EmptyState
              compact
              name="timer"
              title="Henüz seans yok"
              subtitle="İlk odak seansını bitirdiğinde burada listelenir."
            />
          ) : (
            sessionLog
              .slice()
              .reverse()
              .map((s, i) => (
                <View key={`${s.at}_${i}`} style={styles.sessionRow}>
                  <Icon emoji="🍅" size={16} color={C.textMuted} />
                  <Text variant="body" style={styles.sessionName}>{s.dk} dk odak</Text>
                  <Text variant="micro" style={styles.sessionWhen}>{whenLabel(s.at, today)}</Text>
                </View>
              ))
          )}
        </Card>
      </View>
    </ScrollView>
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
      gap: 16,
    },

    // ---- üst satır ----
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },

    // ---- süre seçici ----
    microLabel: {
      ...type.micro,
      color: C.textMuted,
      marginBottom: 8,
      lineHeight: 14,
    },
    hint: {
      ...type.small,
      color: C.textMuted,
      marginTop: 8,
      lineHeight: 18,
    },

    // ---- halka ----
    ringWrap: {
      width: RING,
      height: RING,
      alignSelf: 'center',
      marginVertical: 8,
    },
    segSlot: {
      position: 'absolute',
      width: 5,
      height: SLOT_H,
      left: (RING - 5) / 2,
      top: (RING - SLOT_H) / 2,
    },
    segDot: {
      width: 5,
      height: 9,
      borderRadius: RADIUS.sm,
    },
    ringCenter: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    time: {
      ...type.displayXl,
      color: C.text,
      lineHeight: 56,
    },
    timeSub: {
      ...type.micro,
      color: C.textMuted,
      lineHeight: 14,
    },

    // ---- kontroller ----
    controls: {
      flexDirection: 'row',
      gap: 10,
    },
    btnFlex: {
      flex: 1,
      minWidth: 0,
    },

    // ---- özet ----
    statsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    statCard: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: 4,
    },
    statValue: {
      ...type.h3,
      color: C.text,
      fontVariant: ['tabular-nums'],
      lineHeight: 24,
    },
    statLabel: {
      ...type.micro,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 14,
    },

    // ---- seans satırı ----
    sessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    sessionName: {
      ...type.body,
      color: C.text,
      flex: 1,
      minWidth: 0,
      lineHeight: 21,
    },
    sessionWhen: {
      ...type.micro,
      color: C.textMuted,
      lineHeight: 14,
    },
  });
}
