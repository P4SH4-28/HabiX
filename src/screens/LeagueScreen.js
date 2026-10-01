// ============================================================
// LeagueScreen — "Haftalık Ligler" ekranı (sol menüden açılır)
// 7 günlük XP'ye (xp7d — sunucu trendi) göre lig rütbesi gösterilir;
// arkadaşların da aynı liglerde sıralanır. Hafta sonunda (Pazar)
// ulaştığın lige göre altın ödülünü bir kez alırsın.
// ============================================================
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useData } from '../context/DataContext';
import { getLeague, LEAGUES, nextLeagueInfo, weekEndFor, weekKeyFor } from '../data/leagues';
import { success } from '../services/sfx';
import Progress from '../components/ui/Progress';
import { useTheme } from '../theme';
import Icon from '../components/ui/icons';

function formatCountdown(ms) {
  const totalHours = Math.max(0, Math.floor(ms / 3600000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days} gün ${hours} saat`;
  return `${hours} saat`;
}

export default function LeagueScreen() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { data, server, claimLeagueReward, refreshServer, pushToast } = useData();
  const [claiming, setClaiming] = useState(false);

  // Kendi ligim: sunucunun 7 günlük XP trendinden (en güncel senkron).
  const me = server.leaderboard.find((p) => p.isCurrentUser);
  const myXp7d = me?.xp7d || 0;
  const myLeague = getLeague(myXp7d);
  const nextInfo = nextLeagueInfo(myXp7d);

  // Hafta bilgisi: Pazartesi başlar, Pazar biter.
  const weekKey = weekKeyFor(new Date());
  const countdownMs = weekEndFor(new Date()).getTime() - Date.now();
  const claim = data.settings.leagueClaim || null;
  const claimAvailable = claim?.week !== weekKey;

  // Arkadaşlar: 7 günlük XP'ye göre sıralı, lig rozetleriyle.
  const sorted = [...server.leaderboard]
    .sort((a, b) => (b.xp7d || 0) - (a.xp7d || 0))
    .map((p) => ({ ...p, league: getLeague(p.xp7d || 0) }));

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      await refreshServer();
      const r = claimLeagueReward();
      if (r.ok === false) {
        pushToast({
          icon: '⚠️',
          title: r.error || 'Bu haftanın ödülü zaten alındı',
          color: C.danger,
        });
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
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Kendi lig kartı */}
      <View style={[styles.tierCard, { borderColor: myLeague.color + '88' }]}>
        <View style={styles.tierTop}>
          <View style={styles.tierLeft}>
            <View style={[styles.tierEmojiWrap, { backgroundColor: myLeague.color + '22' }]}>
              <Icon emoji={myLeague.emoji} size={26} color={myLeague.color} />
            </View>
            <View>
              <Text style={[styles.tierName, { color: myLeague.color }]}>{myLeague.name} Lig</Text>
              <Text style={styles.tierXp}>Bu hafta {myXp7d} XP kazandın</Text>
            </View>
          </View>
          <View style={styles.weekChip}>
            <Text style={styles.weekChipText}>Hafta biter</Text>
            <Text style={styles.weekChipCount}>{formatCountdown(countdownMs)}</Text>
          </View>
        </View>
        <View style={styles.tierProgress}>
          <Progress
            value={nextInfo.next ? Math.min(1, myXp7d / nextInfo.next.minXp) : 1}
            height={10}
            colors={[myLeague.color, myLeague.color]}
            accessibilityLabel={
              nextInfo.next
                ? `Sonraki lige kalan yüzde ${Math.max(0, Math.round((1 - myXp7d / nextInfo.next.minXp) * 100))}`
                : 'En üst lig'
            }
          />
          <Text style={styles.tierProgressText}>
            {nextInfo.next
              ? `${nextInfo.needed} XP kala ${nextInfo.next.emoji} ${nextInfo.next.name}`
              : 'En üst lige ulaştın!'}
          </Text>
        </View>
      </View>

      {/* Haftalık ödül */}
      <View style={styles.rewardCard}>
        <View style={styles.rewardTitleRow}>
          <Icon emoji="🎁" size={15} color={C.gold} />
          <Text style={styles.rewardTitle}>Haftalık lig ödülü</Text>
        </View>
        <View style={styles.rewardDescRow}>
          <Icon emoji="🪙" size={12} color={C.gold} />
          <Text style={styles.rewardDesc}>
            {claimAvailable
              ? `Bu hafta ${myLeague.name} liginde bitirirsen +${myLeague.reward} kazanırsın. Pazar gecesi yatmadan almayı unutma!`
              : `Bu haftanın ödülü alındı: +${LEAGUES.find((l) => l.id === claim?.tier)?.reward || 0} (${LEAGUES.find((l) => l.id === claim?.tier)?.name})`}
          </Text>
        </View>
        <Pressable
          style={[styles.claimBtn, !claimAvailable && styles.claimBtnDone]}
          disabled={!claimAvailable || claiming}
          onPress={handleClaim}
        >
          {claimAvailable ? (
            <Text style={styles.claimBtnText}>Ödülü Al</Text>
          ) : (
            <View style={styles.claimBtnDoneRow}>
              <Icon emoji="✅" size={13} color={C.primary} />
              <Text style={[styles.claimBtnText, styles.claimBtnTextDone]}>Bu hafta alındı</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Lig tablosu */}
      <Text style={styles.sectionTitle}>Bu hafta — sıralama</Text>
      <View style={styles.rankCard}>
        {sorted.map((p, i) => {
          const isMe = p.isCurrentUser;
          return (
            <View key={p.id} style={[styles.rankRow, isMe && styles.rankRowMe]}>
              <Text style={styles.rankNum}>{i + 1}</Text>
              <Text style={styles.rankEmoji}>
                <Icon emoji={p.league.emoji} size={16} color={C.textMuted} />
              </Text>
              <Text style={[styles.rankName, isMe && styles.rankNameMe]} numberOfLines={1}>
                {p.username}
                {isMe ? ' (sen)' : ''}
              </Text>
              <Text style={styles.rankXp}>{p.xp7d || 0} XP</Text>
            </View>
          );
        })}
        {sorted.length === 0 ? (
          <Text style={styles.emptyText}>
            Liderlik için seviye 5 olman ve internet bağlantısı gerekir. Veri
            yüklenince sıralama burada görünür.
          </Text>
        ) : null}
      </View>

      {/* Lig eşikleri */}
      <Text style={styles.sectionTitle}>Lig eşikleri</Text>
      <View style={styles.leaguesCard}>
        {LEAGUES.map((l) => (
          <View key={l.id} style={styles.leagueRow}>
            <Text style={styles.leagueEmoji}>
              <Icon emoji={l.emoji} size={18} color={C.textMuted} />
            </Text>
            <Text style={[styles.leagueName, { color: l.color }]}>{l.name}</Text>
            <Text style={styles.leagueMin}>haftada {l.minXp} XP</Text>
            <View style={styles.leagueRewardRow}>
              <Icon emoji="🪙" size={11} color={C.gold} />
              <Text style={styles.leagueReward}>+{l.reward}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.noteBox}>
        <Icon emoji="💡" size={13} color={C.primary} style={styles.noteIcon} />
        <Text style={styles.noteText}>
          Lig XP'n sunucudaki 7 günlük kazanç trendinden hesaplanır — cihaz
          verisi oynatılamaz. Her hafta Pazartesi günü sıfırlanır; ödül Pazar
          gecesi alınır ve haftada bir kezdir.
        </Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    content: {
      padding: 20,
      gap: 14,
      paddingBottom: 60,
    },
    tierCard: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 16,
      gap: 14,
    },
    tierTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    tierLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    tierEmojiWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tierName: {
      fontSize: 17,
      fontWeight: '700',
    },
    tierXp: {
      color: C.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    weekChip: {
      alignItems: 'flex-end',
    },
    weekChipText: {
      color: C.textMuted,
      fontSize: 11,
    },
    weekChipCount: {
      color: C.text,
      fontSize: 13,
      fontWeight: '700',
    },
    tierProgress: {
      gap: 6,
    },
    tierProgressText: {
      color: C.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    rewardCard: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 14,
      gap: 8,
    },
    rewardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    rewardTitle: {
      color: C.text,
      fontSize: 15,
      fontWeight: '700',
    },
    rewardDescRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    rewardDesc: {
      color: C.textMuted,
      fontSize: 13,
      lineHeight: 18,
      flex: 1,
    },
    claimBtn: {
      backgroundColor: C.primary,
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    claimBtnDoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    claimBtnDone: {
      backgroundColor: C.primary + '22',
    },
    claimBtnText: {
      color: C.onPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    claimBtnTextDone: {
      color: C.primary,
    },
    sectionTitle: {
      color: C.textMuted,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 6,
    },
    rankCard: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 6,
    },
    rankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: 12,
    },
    rankRowMe: {
      backgroundColor: C.primary + '18',
    },
    rankNum: {
      color: C.textMuted,
      fontSize: 13,
      fontWeight: '700',
      width: 22,
      textAlign: 'center',
    },
    rankEmoji: {
      fontSize: 15,
    },
    rankName: {
      flex: 1,
      color: C.text,
      fontSize: 13,
      fontWeight: '600',
    },
    rankNameMe: {
      fontWeight: '700',
    },
    rankXp: {
      color: C.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    emptyText: {
      color: C.textMuted,
      fontSize: 13,
      lineHeight: 18,
      padding: 12,
    },
    leaguesCard: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 6,
    },
    leagueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 9,
      paddingHorizontal: 12,
    },
    leagueEmoji: {
      fontSize: 17,
    },
    leagueName: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
    },
    leagueMin: {
      color: C.textMuted,
      fontSize: 13,
    },
    leagueRewardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    leagueReward: {
      color: C.gold,
      fontSize: 13,
      fontWeight: '700',
    },
    noteBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 14,
    },
    noteIcon: {
      marginTop: 2,
    },
    noteText: {
      color: C.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}
