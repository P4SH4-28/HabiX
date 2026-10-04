// ============================================================
// Onboarding — ilk açılış tanıtım rehberi
// 4 sayfalık tanıtım: Alışkanlıklar → XP/Altın → Pomodoro & Görevler
// → Kişisel yolculuk. Her sayfa kendi gradient amblemine sahip.
// "Başla" → AsyncStorage bayrağı, bir daha gösterilmez. Admin görmez.
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './ui/Text';
import BackgroundPattern from './BackgroundPattern';
import GradientButton from './GradientButton';
import SoftButton from './ui/SoftButton';
import IconTile from './ui/IconTile';
import { useT } from '../i18n';
import { useTheme } from '../theme';

const ONBOARDED_KEY = '@habit_tracker_onboarded';

// Sayfa metinleri çeviri anahtarlarıdır; render'da t() ile çözülür.
const PAGES = [
  {
    name: 'body',
    variant: 'primary',
    titleKey: 'onboarding.p1Title',
    textKey: 'onboarding.p1Text',
  },
  {
    name: 'flash',
    variant: 'xp',
    titleKey: 'onboarding.p2Title',
    textKey: 'onboarding.p2Text',
  },
  {
    name: 'timer',
    variant: 'accent',
    titleKey: 'onboarding.p3Title',
    textKey: 'onboarding.p3Text',
  },
  {
    name: 'leaf',
    variant: 'violet',
    titleKey: 'onboarding.p4Title',
    textKey: 'onboarding.p4Text',
  },
];

export default function Onboarding({ onComplete }) {
  const { colors: C, radius } = useTheme();
  const t = useT();
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(ONBOARDED_KEY);
        if (!seen) setVisible(true);
      } catch (e) {
        console.warn('Onboarding bayrağı okunamadı:', e);
      }
    })();
  }, []);

  const finish = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(ONBOARDED_KEY, '1');
    } catch (e) {
      console.warn('Onboarding bayrağı yazılamadı:', e);
    }
    if (onComplete) onComplete();
  };

  if (!visible) return null;

  const p = PAGES[page];
  const last = page === PAGES.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <BackgroundPattern />
      <View
        style={[
          styles.card,
          {
            backgroundColor: C.surface,
            borderRadius: radius.card,
          },
        ]}
      >
        <IconTile name={p.name} variant={p.variant} size={96} />
        <Text style={[styles.title, { color: C.text }]}>{t(p.titleKey)}</Text>
        <Text style={[styles.text, { color: C.textMuted }]}>{t(p.textKey)}</Text>

        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { width: i === page ? 26 : 8 },
                { backgroundColor: i === page ? C.primary : C.border },
              ]}
            />
          ))}
        </View>

        <GradientButton
          label={last ? t('onboarding.start') : t('onboarding.next')}
          onPress={() => (last ? finish() : setPage((x) => x + 1))}
          style={styles.nextButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <SoftButton label={t('onboarding.skip')} variant="subtle" size="sm" onPress={finish} style={styles.skip} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 100,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    padding: 32,
    gap: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 32,
  },
  text: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 14,
    height: 8,
  },
  dot: {
    height: 8,
    borderRadius: 8,
  },
  nextButton: {
    alignSelf: 'stretch',
  },
  skip: {
    alignSelf: 'center',
    marginTop: 2,
  },
});