// ============================================================
// QuestBoardScreen — "Günün Görevleri" (v3 design system, sıfırdan)
//
// YAPI:
//   1) Özet satırı     → bugün kaç görev tamamlandı + çevrimdışı uyarısı
//   2) Sekmeler        → Günlük · Haftalık · Aylık (SegmentedTabs)
//   3) Günlük          → 4 temel görev (Isınma/Zor I/Zor II/İmkansız)
//                         + VIP bölümü (aktifse) veya VIP tanıtım kartı
//   4) Haftalık/Aylık  → veri yok → EmptyState ("yakında")
//
// DataContext API (değişmedi): claimQuest(id) async · server.connected ·
//   refreshServer/refreshing · vipActive · data.questClaims · data.stats.day
//
// ZAMANLAMA: gün anahtarı sunucu saatinden (today) → 1s tick GEREKMEZ.
// SAFE AREA: üst başlık Stack header (STACK_TITLES), alt inset burada.
//
// KURALLAR: glow/gradient/blur/loop YOK · animasyon ≤300ms (primitive'ler) ·
//   4 vurgu rengi (primary/altın/success/danger) · emoji → Icon/ICON_MAP ·
//   5 tipografi ölçeği (h1 yok — başlık header'da).
// ============================================================
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../context/DataContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Icon from '../components/ui/icons';
import Pill from '../components/ui/Pill';
import Progress from '../components/ui/Progress';
import SectionHeader from '../components/ui/SectionHeader';
import SegmentedTabs from '../components/ui/SegmentedTabs';
import {
  getDailyQuests,
  questClaimedToday,
  questProgress,
  questReward,
  QUEST_DIFFICULTIES,
  QUEST_DIFFICULTY_ORDER,
} from '../data/quests';
import { useTheme } from '../theme';

const TABS = [
  { key: 'daily', label: 'Günlük', icon: '📅' },
  { key: 'weekly', label: 'Haftalık', icon: '📆' },
  { key: 'monthly', label: 'Aylık', icon: '🗓' },
];

export default function QuestBoardScreen() {
  const { colors: C, type } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const navigation = useNavigation();
  const { data, today, claimQuest, server, refreshServer, refreshing, vipActive } = useData();

  const [tab, setTab] = useState('daily');
  const [claimingId, setClaimingId] = useState(null);

  const claims = data.questClaims || {};
  const dayStats = data.stats.day;
  const offline = server.connected === false;

  const { base: todayQuests, vip: todayVipQuests } = getDailyQuests(today);
  const allToday = [...todayQuests, ...(vipActive ? todayVipQuests : [])];
  const doneToday = allToday.filter((q) => questClaimedToday(q, claims, today)).length;
  const vipDaysLeft = Math.max(
    0,
    Math.ceil(((data.settings.vipUntil || 0) - Date.now()) / 86400000)
  );

  const handleClaim = useCallback(
    async (questId) => {
      if (claimingId || offline) return;
      setClaimingId(questId);
      try {
        await claimQuest(questId);
      } finally {
        setClaimingId(null);
      }
    },
    [claimingId, offline, claimQuest]
  );

  // ---------- ortak görev kartı (temel + VIP) ----------
  const renderQuest = (quest) => {
    const diff = QUEST_DIFFICULTIES[quest.difficulty];
    const progress = questProgress(quest, dayStats, claims, today, data.habits);
    const claimed = questClaimedToday(quest, claims, today);
    const ready = !claimed && progress >= quest.target;
    const pct = Math.min(100, (progress / quest.target) * 100);
    const reward = questReward(quest, vipActive);
    const busy = claimingId === quest.id;
    return (
      <Card key={quest.id} padding="sm" style={styles.questCard}>
        <View style={styles.questHead}>
          <Icon emoji={quest.emoji} size={18} color={C.primary} />
          <Text style={styles.questTitle} numberOfLines={1}>
            {quest.title}
          </Text>
          <Pill size="sm">{diff.emoji} {diff.label}</Pill>
        </View>
        <Text style={styles.questDesc} numberOfLines={2}>
          {quest.desc}
        </Text>
        <View style={styles.rewardRow}>
          <Pill size="sm" icon="⚡" bg={C.primary + '1A'} color={C.primary}>
            +{reward.xp} XP
          </Pill>
          <Pill size="sm" icon="🪙" bg={C.gold + '1A'} color={C.gold}>
            +{reward.gold}
          </Pill>
          {quest.id.startsWith('vip_') ? (
            <Pill size="sm" bg={C.gold + '1A'} color={C.gold}>
              VIP ÖDÜL
            </Pill>
          ) : null}
        </View>
        <Progress
          value={pct / 100}
          height={6}
          colors={[C.primary]}
          accessibilityLabel={`${quest.title} ilerlemesi yüzde ${Math.round(pct)}`}
        />
        <View style={styles.questFoot}>
          <Text style={styles.progressText}>
            {progress}/{quest.target}
            {ready ? ' · ödül hazır!' : ''}
          </Text>
          {claimed ? (
            <Pill size="sm" icon="✅" bg={C.success + '1A'} color={C.success}>
              Tamamlandı
            </Pill>
          ) : (
            <Button
              label={ready ? 'Ödülü Al' : 'Devam Et'}
              size="sm"
              variant={ready ? 'primary' : 'secondary'}
              disabled={!ready || offline}
              loading={busy}
              onPress={() => handleClaim(quest.id)}
              accessibilityLabel={`${quest.title} — ${ready ? 'ödül al' : 'devam ediyor'}`}
            />
          )}
        </View>
      </Card>
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
      {/* ---------- ÖZET ---------- */}
      <Text style={styles.summary}>
        Görevler her gece yarısı yenilenir. Bugün{' '}
        <Text style={styles.summaryStrong}>
          {doneToday}/{allToday.length}
        </Text>{' '}
        görev tamamladın.
      </Text>

      {offline ? (
        <View style={styles.offlineBox}>
          <Icon emoji="📡" size={14} color={C.danger} />
          <Text style={styles.offlineText}>
            Sunucuya bağlanılamıyor — ödüller sunucu onayı gerektirdiği için şu an
            alınamaz. Bağlantı gelince yeniden dene.
          </Text>
        </View>
      ) : null}

      {/* ---------- SEKMELER ---------- */}
      <SegmentedTabs options={TABS} value={tab} onChange={setTab} />

      {/* ---------- GÜNLÜK ---------- */}
      {tab === 'daily' ? (
        <View style={styles.section}>
          <SectionHeader title="Temel Görevler" actionLabel={`${doneToday}/${allToday.length}`} />
          {QUEST_DIFFICULTY_ORDER.map((d) => {
            const quest = todayQuests.find((q) => q.difficulty === d);
            return quest ? renderQuest(quest) : null;
          })}

          {/* VIP bölümü */}
          {vipActive ? (
            <View style={styles.vipWrap}>
              <SectionHeader title="VIP Ekstra Görevler" />
              <View style={styles.vipBadgeRow}>
                <Icon emoji="👑" size={13} color={C.gold} />
                <Text style={styles.vipBadgeText}>
                  VIP aktif · {vipDaysLeft} gün kaldı · temel görevlerde ×1.5 ödül
                </Text>
              </View>
              {todayVipQuests.map((q) => renderQuest(q))}
            </View>
          ) : (
            <Card style={styles.vipPromo}>
              <View style={styles.vipPromoHead}>
                <Icon emoji="👑" size={20} color={C.gold} />
                <Text style={styles.vipPromoTitle}>VIP ol, +4 görev kazan</Text>
              </View>
              <Text style={styles.vipPromoText}>
                +4 ekstra VIP görev, temel görevlerde ×1.5 ödül çarpanı ve Season Pass
                VIP ödülleri. Altınla satın alınır.
              </Text>
              <Button
                label="VIP üyeliği incele"
                size="md"
                variant="secondary"
                icon="👑"
                fullWidth
                onPress={() => navigation.navigate('SeasonPass')}
              />
            </Card>
          )}

          <Text style={styles.note}>
            Tüm görevler otomatik sayaçlarla ölçülür (Yaptım yoktur); ödüller
            sunucu onayıyla verilir ve günde bir kez alınır.
          </Text>
        </View>
      ) : null}

      {/* ---------- HAFTALIK / AYLIK ---------- */}
      {tab !== 'daily' ? (
        <Card>
          <EmptyState
            compact
            name="calendar"
            title={tab === 'weekly' ? 'Haftalık görevler yakında' : 'Aylık görevler yakında'}
            subtitle="Şu an yalnızca günlük görevler açık. Yeni görev türleri sonraki güncellemelerde burada listelenecek."
          />
        </Card>
      ) : null}
    </ScrollView>
  );
}

function makeStyles(C, type) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    content: {
      padding: 20,
      gap: 14,
    },

    // ---- özet ----
    summary: {
      ...type.small,
      color: C.textMuted,
    },
    summaryStrong: {
      color: C.text,
      fontWeight: '700',
    },
    offlineBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: C.danger + '14',
      borderRadius: 16,
      padding: 12,
    },
    offlineText: {
      ...type.small,
      color: C.text,
      flex: 1,
      fontWeight: '600',
    },

    section: {
      gap: 10,
    },

    // ---- görev kartı ----
    questCard: {
      gap: 10,
    },
    questHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    questTitle: {
      ...type.bodyStrong,
      color: C.text,
      flex: 1,
      minWidth: 0,
    },
    questDesc: {
      ...type.small,
      color: C.textMuted,
    },
    rewardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    questFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    progressText: {
      ...type.micro,
      color: C.textMuted,
      fontVariant: ['tabular-nums'],
    },

    // ---- VIP ----
    vipWrap: {
      gap: 10,
      backgroundColor: C.gold + '0D',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.gold + '33',
      padding: 12,
    },
    vipBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    vipBadgeText: {
      ...type.micro,
      color: C.gold,
    },
    vipPromo: {
      gap: 10,
      backgroundColor: C.gold + '0D',
      borderColor: C.gold + '33',
      borderWidth: 1,
    },
    vipPromoHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    vipPromoTitle: {
      ...type.h3,
      color: C.text,
    },
    vipPromoText: {
      ...type.small,
      color: C.textMuted,
    },

    note: {
      ...type.small,
      color: C.textMuted,
    },
  });
}
