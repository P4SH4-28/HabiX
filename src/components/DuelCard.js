// ============================================================
// DuelCard — arkadaş düellosu kartı (7 günlük XP yarışı)
// Durumlar:
// - pending (gelen davet): Kabul / Red butonları
// - pending (giden davet): bekleniyor bilgisi
// - active: canlı skor çubuğu + kalan süre (+ süre dolduysa "Bitir")
// Kazanan, bitiş anında düello başlangıcından bu yana en çok XP
// kazanan taraftır; ödülü sunucu verir (duel-action).
// ============================================================
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from './ui/Text';
import { useT } from '../i18n';
import { useTheme } from '../theme';
import IconTile from './ui/IconTile';
import Progress from './ui/Progress';

// Kalan süreyi "3g 4s" / "1s 12dk" biçiminde gösterir (dil duyarlı).
function formatRemaining(endsAt, t) {
  const ms = Date.parse(endsAt) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return t('time.ended');
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return t('time.dh', { d: days, h: hours });
  if (hours > 0) return t('time.hm', { h: hours, m: mins });
  return t('time.m', { m: mins });
}

// Süre doldu mu (bağımsız hesap: çevrilmiş metinle karşılaştırma yapılmaz).
function isFinished(endsAt) {
  const ms = Date.parse(endsAt) - Date.now();
  return !Number.isFinite(ms) || ms <= 0;
}

export default function DuelCard({ duel, onAccept, onDecline, onFinish }) {
  const { colors: C } = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(C), [C]);

  const remaining = formatRemaining(duel.endsAt, t);
  const finished = isFinished(duel.endsAt);

  if (duel.status === 'pending' && !duel.isChallenger) {
    // Gelen davet: kabul / red.
    return (
      <View style={[styles.card, { borderWidth: 1, borderColor: C.accent }]}>
        <IconTile icon="swords" emoji="⚔️" variant="danger" size={54} iconSize={24} />
        <View style={styles.body}>
          <Text style={styles.title}>{t('duel.inviteTitle', { name: duel.opponent })}</Text>
          <Text style={styles.desc}>{t('duel.inviteDesc')}</Text>
          <View style={styles.actions}>
            <Pressable
              style={styles.acceptBtn}
              onPress={() => onAccept(duel.id)}
              accessibilityRole="button"
              accessibilityLabel={t('duel.a11yAccept', { name: duel.opponent })}
            >
              <Text style={styles.acceptText}>{t('common.accept')}</Text>
            </Pressable>
            <Pressable
              style={styles.declineBtn}
              onPress={() => onDecline(duel.id)}
              accessibilityRole="button"
              accessibilityLabel={t('duel.a11yDecline', { name: duel.opponent })}
            >
              <Text style={styles.declineText}>{t('common.decline')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // Giden davet (bekleniyor) veya aktif düello.
  const myGain = Math.max(0, duel.myXp - duel.startXpMe);
  const theirGain = Math.max(0, duel.opponentXp - duel.startXpThem);
  const total = myGain + theirGain;
  const myPct = total > 0 ? (myGain / total) * 100 : 50;

  return (
    <View style={[styles.card]}>
      <IconTile icon="swords" emoji="⚔️" variant="glass" size={54} iconSize={24} />
      <View style={styles.body}>
        <Text style={styles.title}>
          {duel.status === 'pending'
            ? t('duel.sentTitle', { name: duel.opponent })
            : t('duel.title', { name: duel.opponent })}
        </Text>
        <Text style={styles.desc}>
          {duel.status === 'pending' ? t('duel.waiting') : t('duel.timeLeft', { remaining })}
        </Text>
        {duel.status === 'active' && (
          <>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreText}>{t('duel.scoreYou', { xp: myGain })}</Text>
              <Text style={styles.scoreText}>{t('duel.scoreOpp', { name: duel.opponent, xp: theirGain })}</Text>
            </View>
            <Progress
              value={myPct / 100}
              height={8}
              colors={[C.primary, C.primaryDark]}
              accessibilityLabel={t('duel.a11yProgress', { pct: Math.round(myPct) })}
            />
            {finished ? (
              <Pressable
                style={styles.acceptBtn}
                onPress={() => onFinish(duel.id)}
                accessibilityRole="button"
                accessibilityLabel={t('duel.a11yResult')}
              >
                <View style={styles.finishBtnContent}>
                  <Text style={styles.acceptText}>{t('duel.seeResult')}</Text>
                  <IconTile icon="trophy" emoji="🏆" variant="gold" size={18} iconSize={10} />
                </View>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 14,
      gap: 12,
      alignItems: 'center',
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    title: {
      color: C.text,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 22,
    },
    desc: {
      color: C.textMuted,
      fontSize: 13,
      lineHeight: 20,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    acceptBtn: {
      backgroundColor: C.primary,
      borderRadius: 12,
      paddingHorizontal: 16,
      minHeight: 44,
      justifyContent: 'center',
    },
    acceptText: {
      color: C.onPrimary,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 20,
    },
    finishBtnContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    declineBtn: {
      backgroundColor: C.surfaceLight,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    declineText: {
      color: C.textMuted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 20,
    },
    scoreRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    scoreText: {
      color: C.textMuted,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 16,
    },
  });
}
