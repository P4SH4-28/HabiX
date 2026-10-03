// ============================================================
// LeagueScreen — "Haftalık Ligler" (v3 design system, sıfırdan)
//
// YAPI:
//   1) Lig kartı       → mevcut lig (ikon/renk) + hafta geri sayımı
//                         + sonraki lige ilerleme
//   2) Ödül kartı      → haftalık altın ödülü (claim, haftada bir)
//   3) SIRAN (sticky)  → kendi pozisyonun liste üstünde yapışkan kalır
//                         (ScrollView stickyHeaderIndices)
//   4) Sıralama        → haftalık XP (xp7d, sunucu trendi) + zone'ları:
//                         ilk 3 = yükselme (success), son 3 = düşüş (danger)
//   5) Eşik tablosu    → Bronz/Gümüş/Altın/Platin/Elmas (mevcut lig işaretli)
//
// DataContext API (değişmedi): claimLeagueReward() → {ok, error|reward, league}
//   · refreshServer · pushToast · server.leaderboard (xp7d, isCurrentUser)
//
// SAFE AREA: üst başlık Stack header, alt inset burada.
// KURALLAR: glow/gradient/blur/loop YOK · animasyon ≤300ms ·
//   4 vurgu rengi (primary/altın/success/danger; lig renkleri veri rengidir) ·
//   5 tipografi ölçeği · h1 yok (header).
// ============================================================
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../context/DataContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Icon from '../components/ui/icons';
import Pill from '../components/ui/Pill';
import Progress from '../components/ui/Progress';
import SectionHeader from '../components/ui/SectionHeader';
import {
  getLeague,
  LEAGUES,
  nextLeagueInfo,
  weekEndFor,
  weekKeyFor,
} from '../data/leagues';
import { success } from '../services/sfx';
import { RADIUS, useTheme } from '../theme';

// Zone kuralları (yalnız görsel): en az 6 kişi varsa anlamlıdır.
const PROMO_N = 3;
const RELEG_N = 3;
const ZONE_MIN_LEN = PROMO_N + RELEG_N;

function formatCountdown(ms) {
  const totalHours = Math.max(0, Math.floor(ms / 3600000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days} gün ${hours} saat`;
  return `${hours} saat`;
}

export default function LeagueScreen() {
  const { colors: C, type } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const { data, server, claimLeagueReward, refreshServer, pushToast, refreshing } = useData();
  const [claiming, setClaiming] = useState(false);

  // Kendi ligim: sunucunun 7 günlük XP trendinden (en güncel senkron).
  const me = server.leaderboard.find((p) => p.isCurrentUser);
  const myXp7d = me?.xp7d || 0;
  const myLeague = getLeague(myXp7d);
  const nextInfo = nextLeagueInfo(myXp7d);

  // Hafta: Pazartesi başlar, Pazar biter.
  const weekKey = weekKeyFor(new Date());
  const countdownMs = weekEndFor(new Date()).getTime() - Date.now();
  const claim = data.settings.leagueClaim || null;
  const claimAvailable = claim?.week !== weekKey;

  // Sıralama (haftalık XP) + lig rozetleri.
  const sorted = useMemo(
    () =>
      [...server.leaderboard]
        .sort((a, b) => (b.xp7d || 0) - (a.xp7d || 0))
        .map((p) => ({ ...p, league: getLeague(p.xp7d || 0) })),
    [server.leaderboard]
  );
  const myRank = sorted.findIndex((p) => p.isCurrentUser);
  const zonesOn = sorted.length >= ZONE_MIN_LEN;
  const zoneOf = (i) =>
    !zonesOn ? 'none' : i < PROMO_N ? 'promo' : i >= sorted.length - RELEG_N ? 'releg' : 'none';

  // ---------- haftalık ödül ----------
  const handleClaim = useCallback(async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      await refreshServer();
      const r = claimLeagueReward();
      if (r.ok === false) {
        pushToast({ icon: '⚠️', title: r.error || 'Ödül alınamadı', color: C.danger });
      } else {
        success();
        pushToast({
          icon: '🏆',
          title: `Ödül alındı! +${r.reward} altın · ${r.league.name} ligi`,
          color: C.gold,
        });
      }
    } finally {
      setClaiming(false);
    }
  }, [claiming, refreshServer, claimLeagueReward, pushToast, C.danger, C.gold]);

  // Sıralama satırı (listede kullanılan).
  const renderRow = (p, i) => {
    const isMe = p.isCurrentUser;
    const zone = zoneOf(i);
    return (
      <View
        key={p.id}
        style={[
          styles.rankRow,
          isMe && styles.rankRowMe,
          zone === 'promo' && styles.zonePromo,
          zone === 'releg' && styles.zoneReleg,
        ]}
      >
        <Text variant="small" style={styles.rankNum}>{i + 1}</Text>
        <Icon emoji={p.league.emoji} size={15} color={C.textMuted} />
        <Text variant="small" style={[styles.rankName, isMe && styles.rankNameMe]} numberOfLines={1}>
          {p.username}
          {isMe ? ' (sen)' : ''}
        </Text>
        <Text variant="small" style={styles.rankXp}>{p.xp7d || 0} XP</Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(24, insets.bottom + 24) },
      ]}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[3]}
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
      {/* ---------- 1) LİG KARTI ---------- */}
      <Card style={[styles.leagueCard, { borderColor: myLeague.color + '88' }]}>
        <View style={styles.leagueTop}>
          <View style={styles.leagueLeft}>
            <View style={[styles.leagueIconWrap, { backgroundColor: myLeague.color + '22' }]}>
              <Icon emoji={myLeague.emoji} size={26} color={myLeague.color} />
            </View>
            <View style={styles.leagueTitles}>
              <Text variant="h3" style={[styles.leagueName, { color: myLeague.color }]}>
                {myLeague.name} Lig
              </Text>
              <Text variant="small" style={styles.leagueXp}>Bu hafta {myXp7d} XP kazandın</Text>
            </View>
          </View>
          <View style={styles.weekWrap}>
            <Text variant="micro" style={styles.weekLabel}>HAFTA BİTER</Text>
            <Text variant="bodyStrong" style={styles.weekCount}>{formatCountdown(countdownMs)}</Text>
          </View>
        </View>
        <View style={styles.leagueProgress}>
          <Progress
            value={nextInfo.next ? Math.min(1, myXp7d / nextInfo.next.minXp) : 1}
            height={8}
            colors={[myLeague.color]}
            accessibilityLabel={
              nextInfo.next
                ? `Sonraki lige ilerleme yüzde ${Math.round(
                    Math.min(100, (myXp7d / nextInfo.next.minXp) * 100)
                  )}`
                : 'En üst lig'
            }
          />
          <Text variant="small" style={styles.leagueProgressText}>
            {nextInfo.next
              ? `${nextInfo.needed} XP kala ${nextInfo.next.emoji} ${nextInfo.next.name}`
              : 'En üst lige ulaştın!'}
          </Text>
        </View>
      </Card>

      {/* ---------- 2) HAFTALIK ÖDÜL ---------- */}
      <Card style={styles.rewardCard}>
        <View style={styles.rewardHead}>
          <Icon emoji="🎁" size={16} color={C.gold} />
          <Text variant="h3" style={styles.rewardTitle}>Haftalık lig ödülü</Text>
        </View>
        <Text variant="small" style={styles.rewardDesc}>
          {claimAvailable
            ? `Bu hafta ${myLeague.name} liginde bitirirsen +${myLeague.reward} altın kazanırsın. Pazar gecesi yatmadan almayı unutma!`
            : `Bu haftanın ödülü alındı: +${
                LEAGUES.find((l) => l.id === claim?.tier)?.reward || 0
              } (${LEAGUES.find((l) => l.id === claim?.tier)?.name})`}
        </Text>
        <Button
          label={claimAvailable ? 'Ödülü Al' : 'Bu hafta alındı'}
          size="md"
          variant={claimAvailable ? 'primary' : 'secondary'}
          icon={claimAvailable ? '🪙' : '✓'}
          fullWidth
          disabled={!claimAvailable}
          loading={claiming}
          onPress={handleClaim}
        />
      </Card>

      {/* ---------- SIRALAMA BAŞLIĞI ---------- */}
      <SectionHeader title="Bu Hafta — Sıralama" />

      {/* ---------- 3) SIRA KARTI (STICKY) ---------- */}
      <View style={styles.stickyWrap}>
        <Card padding="sm" style={styles.selfCard}>
          <Text variant="micro" style={styles.selfLabel}>SENİN SIRAN</Text>
          <View style={styles.selfRow}>
            <Text variant="stat" style={[styles.selfRank, { color: C.primary }]}>
              {myRank >= 0 ? `#${myRank + 1}` : '—'}
            </Text>
            <Icon emoji={myLeague.emoji} size={16} color={myLeague.color} />
            <Text variant="bodyStrong" style={styles.selfName} numberOfLines={1}>
              {me ? `${me.username} (sen)` : 'Sıralama yükleniyor…'}
            </Text>
            {zonesOn && myRank >= 0 ? (
              <Pill
                size="sm"
                bg={
                  (zoneOf(myRank) === 'promo' ? C.success : zoneOf(myRank) === 'releg' ? C.danger : C.primary) + '1A'
                }
                color={
                  zoneOf(myRank) === 'promo'
                    ? C.success
                    : zoneOf(myRank) === 'releg'
                      ? C.danger
                      : C.primary
                }
              >
                {zoneOf(myRank) === 'promo'
                  ? 'Yükselme'
                  : zoneOf(myRank) === 'releg'
                    ? 'Düşme'
                    : 'Koruma'}
              </Pill>
            ) : null}
            <Text variant="bodyStrong" style={styles.selfXp}>{myXp7d} XP</Text>
          </View>
        </Card>
      </View>

      {/* ---------- 4) SIRALAMA LİSTESİ ---------- */}
      <Card padding="sm" style={styles.rankCard}>
        {zonesOn ? (
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: C.success }]} />
              <Text variant="micro" style={styles.legendText}>Yükselme (ilk {PROMO_N})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: C.danger }]} />
              <Text variant="micro" style={styles.legendText}>Düşme (son {RELEG_N})</Text>
            </View>
          </View>
        ) : null}
        {sorted.length === 0 ? (
          <EmptyState
            compact
            name="podium"
            title="Sıralama henüz yok"
            subtitle="Liderlik için seviye 5 olman ve internet bağlantısı gerekir. Veri yüklenince haftalık XP sıralaması burada görünür."
          />
        ) : (
          sorted.map(renderRow)
        )}
      </Card>

      {/* ---------- 5) EŞİK TABLOSU ---------- */}
      <SectionHeader title="Lig Eşikleri" />
      <Card padding="sm">
        {LEAGUES.map((l) => {
          const current = l.id === myLeague.id;
          return (
            <View key={l.id} style={[styles.tierRow, current && styles.tierRowCurrent]}>
              <Icon emoji={l.emoji} size={18} color={l.color} />
              <Text variant="bodyStrong" style={[styles.tierName, { color: l.color }]}>{l.name}</Text>
              <Text variant="small" style={styles.tierMin}>haftada {l.minXp} XP</Text>
              <View style={styles.tierReward}>
                <Icon emoji="🪙" size={11} color={C.gold} />
                <Text variant="small" style={styles.tierRewardText}>+{l.reward}</Text>
              </View>
              {current ? (
                <Pill size="sm" bg={C.primary + '1A'} color={C.primary}>
                  Mevcut
                </Pill>
              ) : null}
            </View>
          );
        })}
      </Card>

      <Text variant="small" style={styles.note}>
        Lig XP'n sunucudaki 7 günlük kazanç trendinden hesaplanır — cihaz verisi
        oynatılamaz. Her hafta Pazartesi sıfırlanır; ödül Pazar gecesi alınır ve
        haftada bir kezdir.
      </Text>
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
      gap: 14,
    },

    // ---- lig kartı ----
    leagueCard: {
      gap: 14,
      borderWidth: 1,
    },
    leagueTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    leagueLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    leagueIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leagueTitles: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    leagueName: {
      ...type.h3,
      lineHeight: 24,
    },
    leagueXp: {
      ...type.small,
      color: C.textMuted,
      fontVariant: ['tabular-nums'],
      lineHeight: 18,
    },
    weekWrap: {
      alignItems: 'flex-end',
      gap: 2,
    },
    weekLabel: {
      ...type.micro,
      color: C.textMuted,
      lineHeight: 14,
    },
    weekCount: {
      ...type.bodyStrong,
      color: C.text,
      fontVariant: ['tabular-nums'],
      lineHeight: 21,
    },
    leagueProgress: {
      gap: 6,
    },
    leagueProgressText: {
      ...type.small,
      color: C.textMuted,
      fontWeight: '600',
      lineHeight: 18,
    },

    // ---- ödül ----
    rewardCard: {
      gap: 8,
    },
    rewardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    rewardTitle: {
      ...type.h3,
      color: C.text,
      lineHeight: 24,
    },
    rewardDesc: {
      ...type.small,
      color: C.textMuted,
      lineHeight: 18,
    },

    // ---- sticky sıra ----
    stickyWrap: {
      // yapışkan kart opaque olmalı (altındaki içerik görünmesin)
      backgroundColor: C.background,
    },
    selfCard: {
      backgroundColor: C.surfaceLight,
      borderColor: C.primary + '55',
      borderWidth: 1,
      gap: 6,
    },
    selfLabel: {
      ...type.micro,
      color: C.textMuted,
      lineHeight: 14,
    },
    selfRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    selfRank: {
      ...type.stat,
      fontVariant: ['tabular-nums'],
      lineHeight: 30,
    },
    selfName: {
      ...type.bodyStrong,
      color: C.text,
      flex: 1,
      minWidth: 0,
      lineHeight: 21,
    },
    selfXp: {
      ...type.bodyStrong,
      color: C.textMuted,
      fontVariant: ['tabular-nums'],
      lineHeight: 21,
    },

    // ---- sıralama ----
    rankCard: {
      gap: 4,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: RADIUS.full,
    },
    legendText: {
      ...type.micro,
      color: C.textMuted,
      lineHeight: 14,
    },
    rankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: 12,
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
    },
    rankRowMe: {
      backgroundColor: C.primary + '14',
    },
    zonePromo: {
      borderLeftColor: C.success,
    },
    zoneReleg: {
      borderLeftColor: C.danger,
    },
    rankNum: {
      ...type.small,
      color: C.textMuted,
      fontWeight: '700',
      width: 22,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
      lineHeight: 18,
    },
    rankName: {
      ...type.small,
      color: C.text,
      flex: 1,
      minWidth: 0,
      fontWeight: '600',
      lineHeight: 18,
    },
    rankNameMe: {
      fontWeight: '700',
      color: C.primary,
    },
    rankXp: {
      ...type.small,
      color: C.textMuted,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      lineHeight: 18,
    },

    // ---- eşik tablosu ----
    tierRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 12,
    },
    tierRowCurrent: {
      backgroundColor: C.surfaceLight,
    },
    tierName: {
      ...type.bodyStrong,
      flex: 1,
      minWidth: 0,
      lineHeight: 21,
    },
    tierMin: {
      ...type.small,
      color: C.textMuted,
      fontVariant: ['tabular-nums'],
      lineHeight: 18,
    },
    tierReward: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    tierRewardText: {
      ...type.small,
      color: C.gold,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      lineHeight: 18,
    },

    note: {
      ...type.small,
      color: C.textMuted,
      lineHeight: 18,
    },
  });
}
