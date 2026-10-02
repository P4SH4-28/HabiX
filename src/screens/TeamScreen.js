// ============================================================
// TeamScreen — "Takımım" ekranı (v3 design system, sıfırdan)
//
// İKİ DURUM:
//   A) Takımım VAR    → takım kartı (amblem + isim + lider/üye metni)
//                        + Davet Et (RN Share) + Ayrıl (danger, onaylı)
//                        + haftalık ortak hedef (Progress 0/1000 XP)
//                        + üye listesi (katkı = xp7d) + not
//   B) Takımım YOK    → kurma formu (TextInput + 9 amblem seçici + "Takım Kur")
//                        + açık takımlara katıl listesi (Katıl) + EmptyState + not
//
// DataContext API: pushToast · useAuth().user.name ·
//   servisler: getTeamFor / getTeamMembers / getTeams / createTeam /
//              joinTeam / leaveTeam (değişmedi).
//
// SAFE AREA: STACK ekranı — AppHeader 'Takımım', alt inset content'te.
// KURALLAR: glow/gradient/blur/loop YOK · h1 yok (AppHeader) ·
//   amblem seçici dekoratif emoji (veri, ikon değil) · danger yalnız "Ayrıl".
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import AvatarCircle from '../components/AvatarCircle';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Icon from '../components/ui/icons';
import IconTile from '../components/ui/IconTile';
import Progress from '../components/ui/Progress';
import SectionHeader from '../components/ui/SectionHeader';
import Skeleton from '../components/ui/Skeleton';
import TextInput from '../components/ui/TextInput';
import {
  createTeam,
  getTeamFor,
  getTeamMembers,
  getTeams,
  joinTeam,
  leaveTeam,
} from '../services/teamService';
import { useTheme } from '../theme';

const TEAM_EMOJIS = ['🏳️', '🦁', '🐺', '🦅', '🐉', '🦈', '🚀', '🎯', '👑'];
const WEEKLY_GOAL_XP = 1000;

function confirmDialog(title, message, okLabel, onOk) {
  Alert.alert(title, message, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: okLabel, style: 'destructive', onPress: onOk },
  ]);
}

export default function TeamScreen() {
  const { colors: C, type } = useTheme();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { pushToast } = useData();
  const myName = user?.name || '';

  const [loading, setLoading] = useState(true);
  const [myTeam, setMyTeam] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [members, setMembers] = useState([]);
  const [openTeams, setOpenTeams] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState(TEAM_EMOJIS[0]);

  const refresh = useCallback(async () => {
    const t = await getTeamFor(myName);
    if (!t.ok) {
      setLoading(false);
      return;
    }
    setMyTeam(t.team);
    setMyRole(t.role);
    if (t.team) {
      const m = await getTeamMembers(t.team.id);
      setMembers(m.ok ? m.members : []);
      setOpenTeams([]);
    } else {
      setMembers([]);
      const list = await getTeams();
      setOpenTeams(list.ok ? list.teams : []);
    }
    setLoading(false);
  }, [myName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const weeklyXp = members.reduce((s, m) => s + (m.xp7d || 0), 0);
  const goalPct = Math.min(1, weeklyXp / WEEKLY_GOAL_XP);
  const goalDone = weeklyXp >= WEEKLY_GOAL_XP;

  const handleCreate = async () => {
    if (creating || !newName.trim()) return;
    setCreating(true);
    try {
      const r = await createTeam(newName.trim(), newEmoji, myName);
      if (!r.ok) {
        pushToast({ icon: '⚠️', title: r.error || 'Takım kurulamadı', color: C.danger });
      } else {
        setNewName('');
        setNewEmoji(TEAM_EMOJIS[0]);
        await refresh();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = (team) => {
    confirmDialog(
      `"${team.name}" takımına katıl`,
      `${team.emoji} ${team.name} — ${team.memberCount} üye. Katılmak istediğine emin misin?`,
      'Katıl',
      async () => {
        const r = await joinTeam(team.id, myName);
        if (!r.ok) {
          pushToast({ icon: '⚠️', title: r.error || 'Katılım başarısız', color: C.danger });
          return;
        }
        await refresh();
      }
    );
  };

  const handleLeave = () => {
    const isLeader = myRole === 'leader';
    confirmDialog(
      isLeader ? 'Takımı dağıt' : 'Takımdan ayrıl',
      isLeader
        ? 'Lider olduğun için ayrılınca takım tamamen silinir (üyeler de düşer). Emin misin?'
        : 'Takımdan ayrılmak istediğine emin misin?',
      isLeader ? 'Dağıt' : 'Ayrıl',
      async () => {
        const r = await leaveTeam(myTeam.id, myName, myRole);
        if (!r.ok) {
          pushToast({ icon: '⚠️', title: r.error || 'İşlem başarısız', color: C.danger });
          return;
        }
        await refresh();
      }
    );
  };

  const handleInvite = async () => {
    try {
      await Share.share({
        message: `${myTeam?.emoji || '🎯'} "${myTeam?.name || ''}" takımına katıl — HabiX'te birlikte haftalık XP toplayalım!`,
      });
    } catch {
      // paylaşım iptal edildi → sessizce geç
    }
  };

  const contentStyle = [
    styles.content,
    { paddingBottom: Math.max(24, insets.bottom + 24) },
  ];

  if (loading) {
    return (
      <View style={[styles.container, styles.content]}>
        <Skeleton h={132} r={18} />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} h={64} r={14} style={{ marginTop: 12 }} />
        ))}
      </View>
    );
  }

  // ================= TAKIMIM VAR =================
  if (myTeam) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- takım kartı ---- */}
        <Card style={styles.teamCard}>
          <View style={styles.teamHeader}>
            <IconTile emoji={myTeam.emoji} size={56} iconSize={26} variant="glass" />
            <View style={styles.teamInfo}>
              <Text style={styles.teamName} numberOfLines={1}>
                {myTeam.name}
              </Text>
              <Text style={styles.teamMeta}>
                Lider: {myTeam.leader} · {members.length} üye
              </Text>
              <View style={styles.teamPills}>
                <Text style={styles.teamRole}>
                  {myRole === 'leader' ? '👑 Sen lider' : '👤 Üyesin'}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.teamActions}>
            <Button
              label="Davet Et"
              variant="secondary"
              size="sm"
              icon={<Icon name="share-outline" size={14} color={C.text} />}
              onPress={handleInvite}
              style={styles.actionFlex}
            />
            <Button
              label={myRole === 'leader' ? 'Dağıt' : 'Ayrıl'}
              variant="danger"
              size="sm"
              onPress={handleLeave}
              style={styles.actionFlex}
            />
          </View>
        </Card>

        {/* ---- haftalık hedef ---- */}
        <Card style={styles.goalCard}>
          <View style={styles.goalTop}>
            <View style={styles.goalTitleRow}>
              <Icon emoji={goalDone ? '🎉' : '🎯'} size={15} color={goalDone ? C.success : C.primary} />
              <Text style={styles.goalTitle}>
                {goalDone ? 'Haftalık hedef tamam!' : 'Haftalık ortak hedef'}
              </Text>
            </View>
            <Text style={styles.goalXp}>
              {weeklyXp}/{WEEKLY_GOAL_XP} XP
            </Text>
          </View>
          <Progress
            value={goalPct}
            height={10}
            trackColor={C.surfaceLight}
            colors={goalDone ? [C.success] : [C.primary, C.primaryDark]}
            accessibilityLabel={`Haftalık takım hedefi yüzde ${Math.round(goalPct * 100)}`}
          />
          <Text style={styles.goalHint}>
            Her üyenin bu haftaki XP kazancı ortak hedefe sayılır.
          </Text>
        </Card>

        {/* ---- üyeler ---- */}
        <SectionHeader title="Üyeler" />
        {members.length > 0 ? (
          <Card padding="none" style={styles.membersCard}>
            {members.map((m) => (
              <View key={m.username} style={styles.memberRow}>
                <AvatarCircle
                  avatarId={m.avatarId || 'av_fox'}
                  emoji={m.avatarId ? undefined : m.emoji}
                  frameId={m.frameId}
                  photo={m.photoUrl || null}
                  size={36}
                />
                <View style={styles.memberInfo}>
                  <Text
                    style={[styles.memberName, m.role === 'leader' && styles.memberLeader]}
                    numberOfLines={1}
                  >
                    {m.username}
                    {m.username === myName ? ' (sen)' : ''}
                  </Text>
                  <View style={styles.memberMetaRow}>
                    <PillInline>{m.xp7d || 0} XP/7g</PillInline>
                    <View style={styles.streakRow}>
                      <Icon emoji="🔥" size={10} color={C.accent} />
                      <Text style={styles.streakText}>{m.streak || 0}</Text>
                    </View>
                  </View>
                </View>
                {m.role === 'leader' ? (
                  <Icon emoji="👑" size={16} color={C.gold} />
                ) : null}
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState
            compact
            name="people"
            title="Üye bilgileri yüklenemedi"
            subtitle="Bağlantı sorunu olabilir. Uygulamayı yeniden açtığında liste tekrar denenir."
          />
        )}

        <View style={styles.noteBox}>
          <Icon emoji="💡" size={13} color={C.primary} style={{ marginTop: 2 }} />
          <Text style={styles.noteText}>
            Takım arkadaşına üstteki "Davet Et" ile paylaşım gönderebilir ya da
            takım adını söyleyebilirsin — birlikte 1000 XP hedefi herkesin
            katkısıyla ilerler.
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ================= TAKIMIM YOK =================
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ---- kurma formu ---- */}
      <Card style={styles.createCard}>
        <View style={styles.createHead}>
          <IconTile emoji="🚩" size={44} iconSize={20} variant="primary" />
          <View style={{ flex: 1 }}>
            <Text style={styles.createTitle}>Yeni takım kur</Text>
            <Text style={styles.createSub}>Lider olursun — adını ve amblemını seç.</Text>
          </View>
        </View>

        <TextInput
          label="TAKIM ADI"
          value={newName}
          onChangeText={setNewName}
          placeholder="Takım adı (2-30 karakter)"
          maxLength={30}
          hint="En fazla 30 karakter."
        />

        <Text style={styles.emojiLabel}>AMBLEM</Text>
        <View style={styles.emojiRow}>
          {TEAM_EMOJIS.map((e) => {
            const active = newEmoji === e;
            return (
              <Pressable
                key={e}
                style={[styles.emojiPick, active && styles.emojiPickActive]}
                onPress={() => setNewEmoji(e)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Amblem ${e}`}
              >
                <Text style={styles.emojiPickText}>{e}</Text>
              </Pressable>
            );
          })}
        </View>

        <Button
          label={creating ? 'Kuruluyor…' : 'Takım Kur'}
          fullWidth
          disabled={!newName.trim() || creating}
          loading={creating}
          onPress={handleCreate}
        />
      </Card>

      {/* ---- açık takımlar ---- */}
      <SectionHeader title="Açık takımlara katıl" />
      {openTeams.length > 0 ? (
        <View style={styles.openList}>
          {openTeams.map((t) => (
            <Card key={t.id} padding="sm" style={styles.openRow}>
              <IconTile emoji={t.emoji} size={40} iconSize={18} variant="glass" />
              <View style={styles.openInfo}>
                <Text style={styles.openName} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={styles.openMeta}>
                  Lider: {t.leader} · {t.memberCount} üye
                </Text>
              </View>
              <Button label="Katıl" size="sm" onPress={() => handleJoin(t)} />
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          compact
          name="people"
          title="Henüz açık takım yok"
          subtitle="İlk takımı sen kur — arkadaşların seni listede görüp katılabilir."
        />
      )}

      <View style={styles.noteBox}>
        <Icon emoji="💡" size={13} color={C.primary} style={{ marginTop: 2 }} />
        <Text style={styles.noteText}>
          Herkes en fazla bir takımda olabilir. Lider ayrılınca takım silinir;
          üyeler lider adını (veya paylaşımı) kullanarak katılırlar.
        </Text>
      </View>
    </ScrollView>
  );
}

// Küçük metin rozeti (xp7d) — ayrı import açmamak için satır içi.
function PillInline({ children }) {
  const { colors: C, type } = useTheme();
  return (
    <Text style={{ ...type.micro, color: C.textMuted, fontWeight: '700' }}>
      {children}
    </Text>
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

    // ---- takım kartı ----
    teamCard: {
      gap: 14,
    },
    teamHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    teamInfo: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    teamName: {
      ...type.h3,
      color: C.text,
    },
    teamMeta: {
      ...type.small,
      color: C.textMuted,
    },
    teamPills: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 2,
    },
    teamRole: {
      ...type.micro,
      color: C.primary,
      fontWeight: '700',
    },
    teamActions: {
      flexDirection: 'row',
      gap: 10,
    },
    actionFlex: {
      flex: 1,
    },

    // ---- hedef ----
    goalCard: {
      gap: 8,
      backgroundColor: C.surfaceLight,
    },
    goalTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    goalTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    goalTitle: {
      ...type.small,
      color: C.text,
      fontWeight: '700',
    },
    goalXp: {
      ...type.small,
      color: C.primary,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    goalHint: {
      ...type.micro,
      color: C.textMuted,
      lineHeight: 16,
    },

    // ---- üyeler ----
    membersCard: {
      paddingVertical: 4,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 9,
      paddingHorizontal: 12,
    },
    memberInfo: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    memberName: {
      ...type.bodyStrong,
      color: C.text,
      fontSize: 14,
    },
    memberLeader: {
      color: C.gold,
    },
    memberMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    streakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    streakText: {
      ...type.micro,
      color: C.textMuted,
      fontVariant: ['tabular-nums'],
    },

    // ---- kur formu ----
    createCard: {
      gap: 14,
    },
    createHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    createTitle: {
      ...type.bodyStrong,
      color: C.text,
      fontSize: 16,
    },
    createSub: {
      ...type.small,
      color: C.textMuted,
      marginTop: 2,
    },
    emojiLabel: {
      ...type.micro,
      color: C.textMuted,
      marginBottom: -6,
    },
    emojiRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    emojiPick: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: C.surfaceLight,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiPickActive: {
      borderColor: C.primary,
      backgroundColor: C.primary + '22',
    },
    emojiPickText: {
      fontSize: 22,
    },

    // ---- açık takımlar ----
    openList: {
      gap: 8,
    },
    openRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    openInfo: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    openName: {
      ...type.bodyStrong,
      color: C.text,
    },
    openMeta: {
      ...type.micro,
      color: C.textMuted,
    },

    // ---- not ----
    noteBox: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: C.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
      marginTop: 4,
    },
    noteText: {
      ...type.small,
      color: C.textMuted,
      flex: 1,
      lineHeight: 18,
    },
  });
}
