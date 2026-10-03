// ============================================================
// LeaderboardScreen — "Liderlik" sekmesi (v3 design system, sıfırdan)
//
// YAPI:
//   1) Sekmeler      → Global (canlı toplam XP) · Arkadaşlar · Haftalık (xp7d)
//   2) Podium        → ilk 3 büyük kart (2-1-3 sırası, madalya renkleri)
//   3) Liste 4+      → sıra + avatar + isim + lig rozeti + XP (satır → profil)
//   4) Sticky footer → kendi sıran HER ZAMAN ekranda (tab barın üstünde)
//   5) Kilidi        → seviye 5'e kadar kilit ekranı (ilerleme çubuğu)
//   6) EmptyState    → sekme boşsa (arkadaş yok / haftalık XP yok / veri yok)
//
// DataContext API (değişmedi): data, today, leaderboardMinLevel/MinXp,
//   refreshServer, refreshing · useAuth().user ·
//   getLeaderboardData(name) → { ok, leaderboard } | { ok:false, error }
//
// SAFE AREA: TAB ekranı — üst başlık AppHeader (TAB_TITLES['Liderlik']),
//   alt PillTabBar tarafından karşılanır; sticky footer ekranın EN ALTINDA
//   (tab bar'ın hemen üstünde) durur.
//
// KURALLAR: glow/gradient/blur/loop YOK · animasyon ≤300ms (primitive) ·
//   4 vurgu rengi (primary/altın/success/danger; lig renkleri VERİ rengidir) ·
//   5 tipografi ölçeği · h1 yok (header).
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/ui/Text';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PlayerProfileModal from '../components/PlayerProfileModal';
import AvatarCircle from '../components/AvatarCircle';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Icon from '../components/ui/icons';
import IconTile from '../components/ui/IconTile';
import Pill from '../components/ui/Pill';
import Progress from '../components/ui/Progress';
import SegmentedTabs from '../components/ui/SegmentedTabs';
import { getAvatarEmoji } from '../data/shop';
import { getLeague } from '../data/leagues';
import { bestStreak, levelFromTotalXp } from '../logic';
import { getLeaderboardData } from '../services/leaderboardService';
import { useTheme } from '../theme';

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
const TABS = [
  { key: 'global', label: 'Global' },
  { key: 'friends', label: 'Arkadaşlar' },
  { key: 'weekly', label: 'Haftalık' },
];

export default function LeaderboardScreen() {
  const { colors: C, type } = useTheme();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const { data, today, leaderboardMinLevel, leaderboardMinXp, refreshServer, refreshing } =
    useData();
  const { user: authUser } = useAuth();
  const PODIUM_COLORS = useMemo(() => ({ 1: C.gold, 2: C.silver, 3: C.bronze }), [C]);

  const { stats, friends, players } = data;
  const meName = authUser?.name || 'Sen';
  const myLevel = levelFromTotalXp(stats.totalXp).level;
  const locked = myLevel < leaderboardMinLevel;

  const [tab, setTab] = useState('global');
  const [selected, setSelected] = useState(null);
  const [live, setLive] = useState(null); // null=yükleniyor | {ok} | {ok:false}

  const loadLive = useCallback(async () => {
    setLive(await getLeaderboardData(authUser?.name));
  }, [authUser?.name]);

  useEffect(() => {
    loadLive();
  }, [loadLive]);

  const onRefresh = useCallback(() => {
    loadLive();
    refreshServer();
  }, [loadLive, refreshServer]);

  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);

  // ---------- havuz: canlı varsa onu, yoksa players+friends ----------
  const entries = useMemo(() => {
    const decorate = (e) => ({
      ...e,
      league: getLeague(e.xp7d || 0),
      isFriend: !e.isMe && friendIds.has(e.id),
    });
    if (live?.ok) {
      return live.leaderboard
        .map((p) =>
          decorate({
            id: p.id,
            name: p.username,
            avatarId: p.isCurrentUser ? data.settings.avatarId : p.avatarId,
            frameId: p.isCurrentUser ? data.settings.frameId : p.frameId,
            photoUrl: p.isCurrentUser ? data.settings.photoUrl : p.photoUrl,
            emoji: p.isCurrentUser ? getAvatarEmoji(data.settings.avatarId) : '😀',
            totalXp: p.xp,
            coins: p.coins,
            xp7d: p.xp7d || 0,
            isMe: p.isCurrentUser,
            flagged: !!p.flagged,
          })
        )
        .sort((a, b) => b.totalXp - a.totalXp);
    }
    const poolIds = new Set(players.map((p) => p.id));
    const extraFriends = friends.filter((f) => !poolIds.has(f.id) && f.name !== meName);
    return [
      {
        id: 'me',
        name: meName,
        emoji: getAvatarEmoji(data.settings.avatarId),
        avatarId: data.settings.avatarId,
        frameId: data.settings.frameId,
        photoUrl: data.settings.photoUrl,
        totalXp: stats.totalXp,
        xp7d: 0,
        isMe: true,
        streak: bestStreak(data.habits, today),
      },
      ...players
        .filter((p) => p.name !== meName)
        .map((p) => ({ ...p, xp7d: p.xp7d || 0, isMe: false })),
      ...extraFriends.map((f) => ({ ...f, xp7d: f.xp7d || 0, isMe: false })),
    ]
      .sort((a, b) => b.totalXp - a.totalXp)
      .map(decorate);
  }, [live, players, friends, stats.totalXp, friendIds, data.habits, data.settings, today, meName]);

  // ---------- sekmeye göre liste ----------
  const view = useMemo(() => {
    if (tab === 'friends') {
      const list = entries.filter((e) => e.isMe || e.isFriend);
      return { list: [...list].sort((a, b) => b.totalXp - a.totalXp), empty: 'friends' };
    }
    if (tab === 'weekly') {
      const withXp = entries.filter((e) => (e.xp7d || 0) > 0);
      return {
        list: [...withXp].sort((a, b) => (b.xp7d || 0) - (a.xp7d || 0)),
        empty: withXp.length === 0 ? 'weekly' : null,
      };
    }
    return { list: entries, empty: entries.length === 0 ? 'all' : null };
  }, [tab, entries]);

  const myIndex = view.list.findIndex((e) => e.isMe);
  const meEntry = myIndex >= 0 ? view.list[myIndex] : null;

  const refreshProps = {
    refreshing,
    onRefresh,
    tintColor: C.primary,
    colors: [C.primary],
    progressBackgroundColor: C.surface,
  };

  // ================= KİLİT EKRANI =================
  if (locked) {
    const neededXp = Math.max(0, leaderboardMinXp - stats.totalXp);
    const pct = Math.min(100, (stats.totalXp / leaderboardMinXp) * 100);
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl {...refreshProps} />}
      >
        <Card style={styles.lockCard}>
          <IconTile icon="trophy" emoji="🏆" variant="gold" size={64} iconSize={28} />
          <Text variant="h3" style={styles.lockTitle}>Liderlik Tablosu Kilitli</Text>
          <Text variant="small" style={styles.lockText}>
            {leaderboardMinLevel}. seviyeye ulaştığında tablo açılır ve herkesin
            ilerlemesini görüp profillerini ziyaret edebilirsin.
          </Text>
          <View style={styles.lockBarHead}>
            <Text variant="micro" style={styles.lockBarLabel}>SEVİYE {leaderboardMinLevel} YOLU</Text>
            <Text variant="micro" style={styles.lockBarValue}>%{Math.round(pct)}</Text>
          </View>
          <Progress
            value={pct / 100}
            height={10}
            colors={[C.gold]}
            accessibilityLabel={`Seviye ${leaderboardMinLevel} yolunun yüzdesi ${Math.round(pct)}`}
          />
          <Text variant="small" style={styles.lockHint}>
            Şu an Seviye {myLevel} — {neededXp} XP daha kazanmalısın
          </Text>
        </Card>
      </ScrollView>
    );
  }

  // ================= AÇIK TABLO =================
  const podium = view.list.slice(0, 3);
  const rest = view.list.slice(3);
  const podiumOrder = podium.length === 3 ? [1, 0, 2] : podium.map((_, i) => i);

  const renderRow = (e, i) => {
    const rank = i + 1;
    return (
      <Card
        key={e.id}
        padding="sm"
        style={[styles.row, e.isMe && styles.rowMe]}
        onPress={() => setSelected(e)}
        accessibilityLabel={`${rank}. sıra ${e.name}, ${e.totalXp} XP. Profili gör`}
      >
        <Text variant="small" style={styles.rankNum}>{rank}</Text>
        <AvatarCircle
          avatarId={e.avatarId}
          photo={e.photoUrl}
          frameId={e.frameId}
          size={36}
          ringColor={rank <= 3 ? PODIUM_COLORS[rank] : undefined}
        />
        <View style={styles.rowInfo}>
          <View style={styles.rowNameLine}>
            <Text variant="bodyStrong" style={styles.rowName} numberOfLines={1}>
              {e.name}
              {e.isMe ? <Text style={styles.meTag}> (sen)</Text> : null}
            </Text>
            {e.flagged ? (
              <Pill size="sm" bg={C.danger + '1A'} color={C.danger}>
                ŞÜPHELİ
              </Pill>
            ) : null}
          </View>
          <View style={styles.rowMeta}>
            <Pill
              size="sm"
              bg={e.league.color + '22'}
              color={e.league.color}
              accessibilityLabel={`${e.league.name} lig`}
            >
              {e.league.emoji} {e.league.name}
            </Pill>
            {e.isFriend ? (
              <Pill size="sm" bg={C.primary + '1A'} color={C.primary}>
                ARKADAŞ
              </Pill>
            ) : null}
            {e.xp7d > 0 ? (
              <Text variant="micro" style={styles.rowWeek}>7g: +{e.xp7d} XP</Text>
            ) : null}
          </View>
        </View>
        <Text variant="small" style={styles.rowXp}>{e.totalXp} XP</Text>
        <Icon name="chevron-forward" size={16} color={C.textMuted} />
      </Card>
    );
  };

  const emptyBlock =
    view.empty === 'friends' ? (
      <EmptyState
        compact
        name="people"
        title="Henüz arkadaş yok"
        subtitle="Liderlik tablosundan profil ziyaretiyle arkadaşlık isteği gönder — onaylandıklarında burada yarışırlar."
      />
    ) : view.empty === 'weekly' ? (
      <EmptyState
        compact
        name="stats-chart"
        title="Bu hafta henüz XP yok"
        subtitle="Haftalık sıralama 7 günlük XP kazancına göredir. Alışkanlık tamamlayıp XP kazanınca burada listelenirsin."
      />
    ) : view.empty === 'all' ? (
      <EmptyState
        compact
        name="trophy"
        title="Sıralama yüklenemedi"
        subtitle="Çek-yenile ile tekrar deneyebilirsin — bağlantı gelince liste burada görünür."
      />
    ) : null;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl {...refreshProps} />}
      >
        <SegmentedTabs options={TABS} value={tab} onChange={setTab} />

        {live === null ? (
          <Pill size="sm" bg={C.surfaceLight} color={C.textMuted}>
            Canlı sıralama yükleniyor…
          </Pill>
        ) : null}

        {live && !live.ok ? (
          <View style={styles.offlineBox}>
            <Icon emoji="📡" size={14} color={C.danger} />
            <Text variant="small" style={styles.offlineText}>
              Canlı liderlik verisi alınamadı — önbellek gösteriliyor.
            </Text>
            <Button
              label="Yenile"
              size="sm"
              variant="secondary"
              onPress={() => {
                refreshServer();
                loadLive();
              }}
            />
          </View>
        ) : null}

        {emptyBlock}

        {/* ---------- PODIUM (ilk 3) ---------- */}
        {!emptyBlock && podium.length > 0 ? (
          <View style={styles.podiumRow}>
            {podiumOrder.map((idx) => {
              const e = podium[idx];
              const rank = idx + 1;
              const isTop = rank === 1;
              return (
                <Card
                  key={e.id}
                  onPress={() => setSelected(e)}
                  style={[
                    styles.podiumCard,
                    isTop && styles.podiumCardTop,
                    e.isMe && styles.podiumMe,
                  ]}
                  accessibilityLabel={`${rank}. sıra ${e.name}, ${e.totalXp} XP`}
                >
                  <Icon emoji={MEDALS[rank]} size={20} color={PODIUM_COLORS[rank]} />
                  <AvatarCircle
                    avatarId={e.avatarId}
                    photo={e.photoUrl}
                    frameId={e.frameId}
                    size={isTop ? 52 : 44}
                    ringColor={PODIUM_COLORS[rank]}
                  />
                  <Text variant="small" style={styles.podiumName} numberOfLines={1}>
                    {e.name}
                  </Text>
                  <Text variant="small" style={[styles.podiumXp, { color: PODIUM_COLORS[rank] }]}>
                    {tab === 'weekly' ? `${e.xp7d} XP` : `${e.totalXp} XP`}
                  </Text>
                  {e.isMe ? (
                    <Pill size="sm" bg={C.primary + '1A'} color={C.primary}>
                      SEN
                    </Pill>
                  ) : null}
                </Card>
              );
            })}
          </View>
        ) : null}

        {/* ---------- LİSTE (4+) ---------- */}
        <View style={styles.list}>{rest.map(renderRow)}</View>

        {/* Podiumda olmayan tek kişilik durumda liste boş kalmasın diye
            (me alone in friends tab) satır zaten view.list'te varsa çizilir: */}
        {rest.length === 0 && podium.length === view.list.length ? null : null}

        <Text variant="small" style={styles.note}>
          Profillere dokunabilir, gelişim verilerini görebilir ve arkadaşlık isteği
          gönderebilirsin.
        </Text>
      </ScrollView>

      {/* ---------- STICKY BOTTOM: kendi sıran ---------- */}
      {meEntry && myIndex >= 0 ? (
        <View style={styles.footer}>
          <Card padding="sm" style={styles.selfCard}>
            <Text variant="stat" style={styles.selfRank}>#{myIndex + 1}</Text>
            <AvatarCircle
              avatarId={meEntry.avatarId}
              photo={meEntry.photoUrl}
              frameId={meEntry.frameId}
              size={34}
              ringColor={C.primary}
            />
            <View style={styles.selfInfo}>
              <Text variant="bodyStrong" style={styles.selfName} numberOfLines={1}>
                {meEntry.name} (sen)
              </Text>
              <View style={styles.selfMeta}>
                <Pill size="sm" bg={meEntry.league.color + '22'} color={meEntry.league.color}>
                  {meEntry.league.emoji} {meEntry.league.name}
                </Pill>
              </View>
            </View>
            <Text variant="h3" style={styles.selfXp}>
              {tab === 'weekly' ? `+${meEntry.xp7d} 7g` : `${meEntry.totalXp} XP`}
            </Text>
          </Card>
        </View>
      ) : null}

      {/* Profil ziyareti modalı */}
      <PlayerProfileModal player={selected} onClose={() => setSelected(null)} />
    </View>
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
      paddingBottom: 24,
    },

    // ---- kilit ----
    lockCard: {
      alignItems: 'center',
      gap: 12,
      marginTop: 12,
      paddingVertical: 24,
    },
    lockTitle: {
      ...type.h3,
      color: C.text,
      lineHeight: 24,
    },
    lockText: {
      ...type.small,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 18,
    },
    lockBarHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
    },
    lockBarLabel: {
      ...type.micro,
      color: C.textMuted,
      lineHeight: 14,
    },
    lockBarValue: {
      ...type.micro,
      color: C.gold,
      fontVariant: ['tabular-nums'],
      lineHeight: 14,
    },
    lockHint: {
      ...type.small,
      color: C.textMuted,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
      lineHeight: 18,
    },

    // ---- uyarı ----
    offlineBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: C.danger + '14',
      borderRadius: 16,
      padding: 12,
    },
    offlineText: {
      ...type.small,
      color: C.text,
      flex: 1,
      minWidth: 0,
      fontWeight: '600',
      lineHeight: 18,
    },

    // ---- podium ----
    podiumRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 10,
    },
    podiumCard: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
      paddingVertical: 14,
    },
    podiumCardTop: {
      paddingVertical: 20,
      borderColor: C.gold + '66',
    },
    podiumMe: {
      borderColor: C.primary,
    },
    podiumName: {
      ...type.small,
      color: C.text,
      fontWeight: '700',
      maxWidth: '100%',
      lineHeight: 18,
    },
    podiumXp: {
      ...type.small,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      lineHeight: 18,
    },

    // ---- liste ----
    list: {
      gap: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    rowMe: {
      borderColor: C.primary,
      backgroundColor: C.primary + '0F',
    },
    rankNum: {
      ...type.small,
      color: C.textMuted,
      fontWeight: '700',
      width: 24,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
      lineHeight: 18,
    },
    rowInfo: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    rowNameLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    rowName: {
      ...type.bodyStrong,
      color: C.text,
      flexShrink: 1,
      lineHeight: 21,
    },
    meTag: {
      color: C.primary,
    },
    rowMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    rowWeek: {
      ...type.micro,
      color: C.textMuted,
      fontVariant: ['tabular-nums'],
      lineHeight: 14,
    },
    rowXp: {
      ...type.small,
      color: C.xp,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      lineHeight: 18,
    },

    note: {
      ...type.small,
      color: C.textMuted,
      lineHeight: 18,
    },

    // ---- sticky bottom ----
    footer: {
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    selfCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: C.surfaceLight,
      borderColor: C.primary + '66',
      borderWidth: 1,
    },
    selfRank: {
      ...type.stat,
      color: C.primary,
      minWidth: 52,
      textAlign: 'center',
      lineHeight: 30,
    },
    selfInfo: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    selfName: {
      ...type.bodyStrong,
      color: C.text,
      lineHeight: 21,
    },
    selfMeta: {
      flexDirection: 'row',
      gap: 6,
    },
    selfXp: {
      ...type.h3,
      color: C.text,
      fontVariant: ['tabular-nums'],
      lineHeight: 24,
    },
  });
}
