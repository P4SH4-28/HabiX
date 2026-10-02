// ============================================================
// DuelScreen — "Düello" merkezi (v3 design system, YENİ ekran)
//
// BÖLÜMLER:
//   1) Aktif düellolar → statik VS kartı (animasyon YOK): iki skor kolonu,
//      ortada VS, skor payı çubuğu, geri sayım, süre dolduysa "Sonucu Gör"
//   2) Gelen davetler  → Kabul Et / Reddet
//   3) Giden davet      → "Kabul edilmesi bekleniyor"
//   4) Geçmiş           → oturum içi sonuçlar (finish yanıtından) + sunucudan
//      dönen biten kayıtlar; veri yoksa bölüm gizlenir, hiç düello yoksa
//      ana EmptyState (davet gönderme aksiyonlu)
//
// DataContext API (değişmedi): server.duels, acceptDuel/declineDuel/finishDuel
//   → {ok, winner, reward}, refreshServer, refreshing, pushToast, data.settings.
// Geçmiş İPUCU: getMyDuels yalnız açık duelleri getirir → tarih/kazanan
//   geçmişi cihazda tutulur (session state); eski kayıtlarda görünmez.
//
// SAFE AREA: STACK ekranı — AppHeader 'Düello' (STACK_TITLES), alt inset
//   content'te. Giriş: App.js deep-link 'duel/create' + Arkadaşlar'daki
//   "Düello Merkezi" butonu.
// KURALLAR: glow/gradient/blur/loop YOK · animasyon YOK (saat tick'i hariç,
//   30sn interval · sadece re-render) · VS tipi type.stat (h1 bu ekranda yok).
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import AvatarCircle from '../components/AvatarCircle';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Icon from '../components/ui/icons';
import IconTile from '../components/ui/IconTile';
import Pill from '../components/ui/Pill';
import Progress from '../components/ui/Progress';
import SectionHeader from '../components/ui/SectionHeader';
import { useTheme } from '../theme';

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

// Kalan süreyi "3g 4s" / "1s 12dk" biçiminde gösterir (DuelCard ile aynı).
function formatRemaining(endsAt, now) {
  const ms = Date.parse(endsAt) - now;
  if (!Number.isFinite(ms) || ms <= 0) return 'bitti';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}g ${hours}s`;
  if (hours > 0) return `${hours}s ${mins}dk`;
  return `${mins}dk`;
}

function formatDate(ms) {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

// Geçmiş satırının sonucu → etiket + tema renk anahtarı.
const HISTORY_META = {
  win: { label: 'KAZANDIN', tone: 'success' },
  lose: { label: 'KAYBETTİN', tone: 'danger' },
  draw: { label: 'BERABERE', tone: 'muted' },
};

export default function DuelScreen({ navigation }) {
  const { colors: C, type } = useTheme();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const insets = useSafeAreaInsets();
  const { user: authUser } = useAuth();
  const { data, server, acceptDuel, declineDuel, finishDuel, refreshServer, refreshing, pushToast } =
    useData();

  const meName = authUser?.name || data.settings.name || 'Sen';
  const [now, setNow] = useState(() => Date.now());
  const [busyId, setBusyId] = useState(null);
  const [history, setHistory] = useState([]);

  const duels = server?.duels || [];
  const incoming = duels.filter((d) => d.status === 'pending' && !d.isChallenger);
  const outgoing = duels.filter((d) => d.status === 'pending' && d.isChallenger);
  const active = duels.filter((d) => d.status === 'active');
  const anyOpen = incoming.length + outgoing.length + active.length > 0;

  // Geri sayım: yalnız aktif düello varken 30 sn'de bir tazele (tick, animasyon değil).
  useEffect(() => {
    if (active.length === 0) return undefined;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [active.length]);

  const onRefresh = useCallback(() => refreshServer(), [refreshServer]);

  const handleAccept = async (id) => {
    if (busyId) return;
    setBusyId(id);
    const r = await acceptDuel(id);
    setBusyId(null);
    if (!r.ok) pushToast({ icon: '⚠️', title: r.error || 'Kabul edilemedi', color: C.danger });
  };

  const handleDecline = async (id) => {
    if (busyId) return;
    setBusyId(id);
    const r = await declineDuel(id);
    setBusyId(null);
    if (!r.ok) pushToast({ icon: '⚠️', title: r.error || 'Reddedilemedi', color: C.danger });
  };

  const handleFinish = async (duel) => {
    if (busyId) return;
    setBusyId(duel.id);
    const r = await finishDuel(duel.id);
    setBusyId(null);
    if (!r.ok) {
      pushToast({ icon: '⚠️', title: r.error || 'Düello bitirilemedi', color: C.danger });
      return;
    }
    const outcome = r.winner ? (r.winner === meName ? 'win' : 'lose') : 'draw';
    if (outcome === 'draw') {
      pushToast({ icon: '⚔️', title: 'Düello berabere bitti!', color: C.textMuted });
    }
    setHistory((prev) => [
      {
        key: `h_${duel.id}_${Date.now()}`,
        opponent: duel.opponent,
        outcome,
        xp: r.reward?.xp || 0,
        gold: r.reward?.gold || 0,
        at: Date.now(),
      },
      ...prev,
    ]);
  };

  const goFriends = () => navigation.navigate('Main', { screen: 'Social' });

  // ---------- VS kartı (statik) ----------
  const renderActive = (duel) => {
    const myGain = Math.max(0, (duel.myXp || 0) - (duel.startXpMe || 0));
    const theirGain = Math.max(0, (duel.opponentXp || 0) - (duel.startXpThem || 0));
    const total = myGain + theirGain;
    const myPct = total > 0 ? myGain / total : 0.5;
    const remaining = formatRemaining(duel.endsAt, now);
    const finished = remaining === 'bitti';

    return (
      <Card key={duel.id} style={styles.vsCard}>
        <View style={styles.vsHead}>
          <Pill size="sm" bg={C.accent + '1A'} color={C.accent}>
            7 GÜNLÜK XP YARIŞI
          </Pill>
          <View style={styles.vsClock}>
            <Icon name="time-outline" size={13} color={finished ? C.success : C.textMuted} />
            <Text style={[styles.vsClockText, finished && { color: C.success }]}>
              {finished ? 'süre doldu' : `kalan ${remaining}`}
            </Text>
          </View>
        </View>

        <View style={styles.vsRow}>
          <View style={styles.vsSide}>
            <AvatarCircle
              avatarId={data.settings.avatarId}
              photo={data.settings.photoUrl || null}
              frameId={data.settings.frameId}
              size={54}
              ringColor={C.primary}
            />
            <Text style={styles.vsName} numberOfLines={1}>
              {meName}
            </Text>
            <Text style={[styles.vsGain, { color: C.xp }]}>+{myGain} XP</Text>
          </View>

          <View style={styles.vsCenter}>
            <Text style={styles.vsMark}>VS</Text>
          </View>

          <View style={styles.vsSide}>
            <AvatarCircle emoji="🙂" size={54} ringColor={C.border} />
            <Text style={styles.vsName} numberOfLines={1}>
              {duel.opponent}
            </Text>
            <Text style={[styles.vsGain, { color: C.textMuted }]}>+{theirGain} XP</Text>
          </View>
        </View>

        <Progress
          value={myPct}
          height={10}
          colors={[C.primary, C.primaryDark]}
          accessibilityLabel={`Düello skoru: sen ${myGain}, rakip ${theirGain} XP`}
        />
        <View style={styles.vsScoreRow}>
          <Text style={styles.vsScore}>Sen +{myGain}</Text>
          <Text style={[styles.vsScore, styles.vsScoreRight]}>Rakip +{theirGain}</Text>
        </View>

        {finished ? (
          <Button
            label="Sonucu Gör"
            fullWidth
            size="sm"
            loading={busyId === duel.id}
            onPress={() => handleFinish(duel)}
          />
        ) : null}
      </Card>
    );
  };

  // ---------- gelen davet ----------
  const renderInvite = (duel) => (
    <Card key={`in_${duel.id}`} style={styles.inviteCard}>
      <View style={styles.inviteHead}>
        <AvatarCircle emoji="📨" size={44} ringColor={C.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.inviteTitle}>{duel.opponent} seni düelloya davet etti</Text>
          <Text style={styles.inviteDesc}>
            7 günlük XP yarışı — kazanan +100 XP ve +50 altın alır.
          </Text>
        </View>
      </View>
      <View style={styles.inviteActions}>
        <Button
          label="Kabul Et"
          size="sm"
          style={{ flex: 1 }}
          loading={busyId === duel.id}
          onPress={() => handleAccept(duel.id)}
        />
        <Button
          label="Reddet"
          variant="ghost"
          size="sm"
          style={{ flex: 1 }}
          disabled={!!busyId}
          onPress={() => handleDecline(duel.id)}
        />
      </View>
    </Card>
  );

  // ---------- giden davet ----------
  const renderOutgoing = (duel) => (
    <Card key={`out_${duel.id}`} padding="sm" style={styles.pendingRow}>
      <IconTile icon="swords" emoji="⚔️" variant="glass" size={38} iconSize={17} />
      <View style={{ flex: 1 }}>
        <Text style={styles.pendingTitle}>{duel.opponent}</Text>
        <Text style={styles.pendingSub}>Davet gönderildi · kabul edilmesi bekleniyor</Text>
      </View>
      <Pill size="sm" bg={C.surfaceLight} color={C.textMuted}>
        BEKLİYOR
      </Pill>
    </Card>
  );

  // ---------- geçmiş ----------
  const renderHistoryRow = (h) => {
    const meta = HISTORY_META[h.outcome] || HISTORY_META.draw;
    const toneColor =
      meta.tone === 'success' ? C.success : meta.tone === 'danger' ? C.danger : C.textMuted;
    return (
      <Card key={h.key} padding="sm" style={styles.histRow}>
        <IconTile
          icon="swords"
          emoji={h.outcome === 'win' ? '🏆' : h.outcome === 'lose' ? '💔' : '🤝'}
          variant={h.outcome === 'win' ? 'gold' : 'glass'}
          size={38}
          iconSize={17}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.histTitle}>{h.opponent}</Text>
          <Text style={styles.histSub}>
            {formatDate(h.at)}
            {h.xp ? ` · +${h.xp} XP` : ''}
            {h.gold ? ` · +${h.gold} 🪙` : ''}
          </Text>
        </View>
        <Pill size="sm" bg={toneColor + '22'} color={toneColor}>
          {meta.label}
        </Pill>
      </Card>
    );
  };

  const contentStyle = [
    styles.content,
    { paddingBottom: Math.max(24, insets.bottom + 24) },
  ];
  const refreshProps = {
    refreshing,
    onRefresh,
    tintColor: C.primary,
    colors: [C.primary],
    progressBackgroundColor: C.surface,
  };

  // ================= HİÇ DÜELLO YOK =================
  if (!anyOpen && history.length === 0) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl {...refreshProps} />}
      >
        <EmptyState
          name="swords"
          emoji="⚔️"
          title="Henüz düello yok"
          subtitle="Arkadaşlar sekmesinden birine düello daveti gönder — 7 gün boyunca XP yarışı başlar. Kazanan +100 XP ve +50 altın alır."
          actionLabel="Arkadaşlardan Davet Gönder"
          onAction={goFriends}
        />
        <View style={styles.rulesCard}>
          <Icon emoji="📜" size={14} color={C.gold} />
          <Text style={styles.rulesText}>
            Düello başlangıcından bu yana en çok XP kazanan taraf kazanır. Süre
            dolduğunda "Sonucu Gör" ile sonucu sunucu belirler ve ödül anında
            verilir.
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ================= DÜELLO VAR =================
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl {...refreshProps} />}
    >
      {active.length > 0 ? (
        <>
          <SectionHeader title="Aktif Düellolar" />
          {active.map(renderActive)}
        </>
      ) : null}

      {incoming.length > 0 ? (
        <>
          <SectionHeader title="Gelen Davetler" />
          {incoming.map(renderInvite)}
        </>
      ) : null}

      {outgoing.length > 0 ? (
        <>
          <SectionHeader title="Bekleyen Davet" />
          {outgoing.map(renderOutgoing)}
        </>
      ) : null}

      {history.length > 0 ? (
        <>
          <SectionHeader title="Geçmiş" />
          {history.map(renderHistoryRow)}
        </>
      ) : null}

      <View style={styles.rulesCard}>
        <Icon emoji="💡" size={13} color={C.primary} />
        <Text style={styles.rulesText}>
          {anyOpen
            ? 'Skorlar her senkronda tazelenir; süre dolunca "Sonucu Gör" ile kazananı belirleyip ödülleri alabilirsin.'
            : 'Açık düello yok — yeni davet geldiğinde burada listelenir.'}
        </Text>
      </View>

      {!anyOpen ? (
        <Button label="Arkadaşlardan Davet Gönder" variant="secondary" fullWidth onPress={goFriends} />
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
      gap: 12,
    },

    // ---- VS ----
    vsCard: {
      gap: 12,
    },
    vsHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    vsClock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    vsClockText: {
      ...type.micro,
      color: C.textMuted,
      fontVariant: ['tabular-nums'],
    },
    vsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
    },
    vsSide: {
      flex: 1,
      alignItems: 'center',
      gap: 5,
    },
    vsCenter: {
      width: 54,
      alignItems: 'center',
    },
    vsMark: {
      ...type.stat,
      color: C.textMuted,
      letterSpacing: 1,
    },
    vsName: {
      ...type.small,
      color: C.text,
      fontWeight: '700',
      maxWidth: '100%',
      textAlign: 'center',
    },
    vsGain: {
      ...type.small,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    vsScoreRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: -4,
    },
    vsScore: {
      ...type.micro,
      color: C.textMuted,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    vsScoreRight: {
      textAlign: 'right',
    },

    // ---- davet ----
    inviteCard: {
      gap: 12,
      borderColor: C.accent + '66',
      borderWidth: 1,
    },
    inviteHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    inviteTitle: {
      ...type.bodyStrong,
      color: C.text,
    },
    inviteDesc: {
      ...type.small,
      color: C.textMuted,
      marginTop: 2,
      lineHeight: 17,
    },
    inviteActions: {
      flexDirection: 'row',
      gap: 10,
    },

    // ---- bekleyen ----
    pendingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    pendingTitle: {
      ...type.bodyStrong,
      color: C.text,
    },
    pendingSub: {
      ...type.micro,
      color: C.textMuted,
      marginTop: 2,
    },

    // ---- geçmiş ----
    histRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    histTitle: {
      ...type.bodyStrong,
      color: C.text,
      fontSize: 14,
    },
    histSub: {
      ...type.micro,
      color: C.textMuted,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },

    // ---- kural notu ----
    rulesCard: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: C.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
      marginTop: 4,
      alignItems: 'flex-start',
    },
    rulesText: {
      ...type.small,
      color: C.textMuted,
      flex: 1,
      lineHeight: 18,
    },
  });
}
