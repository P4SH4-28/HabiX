// ============================================================
// AdminScreen — "Yönetici Paneli" (v3 design system, sıfırdan)
//
// BÖLÜMLER:
//   1) İSTATİSTİKLER → canlı sunucu verisinden derlenen 4 sayaç +
//      sistem durumu (bağlantı + son senkron + Yenile)
//   2) KULLANICI ARAMA → sonuç listesi (durum rozetleri) · EmptyState
//   3) SEÇİLİ KULLANICI → detay + hediye ver/al + şüpheli bayrağını kaldır
//      + ödüll/ceza (normal bölge)
//   4) TEHLİKELİ BÖLGE → yasakla/kaldır, ceza kes, para transferi (danger)
//   5) DENETİM GÜNLÜĞÜ → son 30 işlem · EmptyState
//
// DataContext API: server (leaderboard/duels/connected/lastSync),
//   refreshServer · AuthContext: user (adminName) ·
//   adminAction: search_users | get_user | ban | unban | adjust |
//   transfer | grant | revoke | unflag | logs.
//
// NOT: admin-action'da istatistik endpoint'i YOK → sayımlar mevcut
//   `server` senkron verisinden hesaplanır (etiketler buna göre dürüst).
//
// SAFE AREA: STACK ekranı — AppHeader 'Yönetici Paneli', alt inset
//   content'te (KeyboardAvoidingView ile).
// KURALLAR: glow/gradient/blur/loop YOK · h1 yok · danger yalnız
//   TEHLİKELİ BÖLGE'de · TextInput/Button/Card primitive'leri.
// ============================================================
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import Text from '../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Icon from '../components/ui/icons';
import Pill from '../components/ui/Pill';
import SectionHeader from '../components/ui/SectionHeader';
import SegmentedTabs from '../components/ui/SegmentedTabs';
import TextInput from '../components/ui/TextInput';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { FRAMES, SHOP_ITEMS } from '../data/shop';
import { adminAction } from '../services/adminService';
import { RADIUS, THEMES, useTheme } from '../theme';

// Hediye kategorileri (SegmentedTabs).
const GRANT_TABS = [
  { key: 'theme', label: 'Tema', items: () => THEMES.map((t) => ({ id: t.id, name: t.name, emoji: t.emoji })) },
  { key: 'avatar', label: 'Avatar', items: () => SHOP_ITEMS.map((i) => ({ id: i.id, name: i.name, emoji: i.emoji })) },
  { key: 'frame', label: 'Çerçeve', items: () => FRAMES.map((f) => ({ id: f.id, name: f.name, emoji: f.emoji })) },
];

export default function AdminScreen() {
  const { user: authUser } = useAuth();
  const { colors: C, type } = useTheme();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const insets = useSafeAreaInsets();
  const { server, refreshServer } = useData();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null); // { ok, text }
  const [xpInput, setXpInput] = useState('');
  const [goldInput, setGoldInput] = useState('');
  const [banReason, setBanReason] = useState('');
  const [grantTab, setGrantTab] = useState('theme');
  const [logs, setLogs] = useState([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  // Para transferi: kaynak → hedef XP/altın.
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferXp, setTransferXp] = useState('');
  const [transferGold, setTransferGold] = useState('');

  const adminName = authUser?.name || '';
  const notify = (ok, text) => setMessage({ ok, text });

  // ---------- İstatistikler (server verisinden derleme) ----------
  const board = server?.leaderboard || [];
  const stats = useMemo(
    () => ({
      players: board.length,
      totalXp: board.reduce((s, p) => s + (p.totalXp || 0), 0),
      weekXp: board.reduce((s, p) => s + (p.xp7d || 0), 0),
      duels: (server?.duels || []).length,
    }),
    [board, server]
  );
  const statsList = [
    { key: 'players', label: 'OYUNCU (CANLI)', value: stats.players },
    { key: 'xp', label: 'TOPLAM XP', value: stats.totalXp },
    { key: 'week', label: '7 GÜNLÜK XP', value: stats.weekXp },
    { key: 'duels', label: 'AÇIK DÜELLO', value: stats.duels },
  ];

  // ---------- Arama ----------
  const doSearch = async () => {
    const q = query.trim();
    if (!q) return notify(false, 'Arama için bir isim yaz');
    setSearching(true);
    setMessage(null);
    setSearched(true);
    const r = await adminAction('search_users', { q });
    setSearching(false);
    if (!r.ok) return notify(false, r.error);
    setResults(r.data.users || []);
    if ((r.data.users || []).length === 0) notify(false, 'Sonuç bulunamadı');
  };

  const selectUser = async (username) => {
    setBusy('loading');
    setMessage(null);
    setSelected(null);
    const r = await adminAction('get_user', { target: username });
    setBusy('');
    if (!r.ok) return notify(false, r.error);
    setSelected(r.data.user);
    setTransferFrom(adminName);
    setTransferTo(username);
  };

  const refreshSelected = async () => {
    if (!selected) return;
    const r = await adminAction('get_user', { target: selected.username });
    if (r.ok) setSelected(r.data.user);
  };

  // ---------- Yasaklama ----------
  const doBan = async () => {
    if (!selected) return;
    setBusy('ban');
    const r = await adminAction('ban', { target: selected.username, reason: banReason.trim() });
    setBusy('');
    if (!r.ok) return notify(false, r.error);
    setBanReason('');
    notify(true, `${selected.username} yasaklandı`);
    await refreshSelected();
  };

  const doUnban = async () => {
    if (!selected) return;
    setBusy('unban');
    const r = await adminAction('unban', { target: selected.username });
    setBusy('');
    if (!r.ok) return notify(false, r.error);
    notify(true, `${selected.username} yasağı kaldırıldı`);
    await refreshSelected();
  };

  // ---------- Ödül(+) / Ceza(-) ----------
  const doAdjust = async (sign) => {
    if (!selected) return;
    const xp = Number(xpInput);
    const gold = Number(goldInput);
    if (!Number.isFinite(xp) || !Number.isFinite(gold) || (xp === 0 && gold === 0)) {
      return notify(false, 'Geçerli XP/altın değeri gir');
    }
    setBusy('adjust');
    const r = await adminAction('adjust', {
      target: selected.username,
      xp: sign * xp,
      coins: sign * gold,
    });
    setBusy('');
    if (!r.ok) return notify(false, r.error);
    setXpInput('');
    setGoldInput('');
    notify(true, sign > 0 ? 'Ödül verildi' : 'Ceza kesildi');
    await refreshSelected();
  };

  // ---------- Para transferi ----------
  const doTransfer = async () => {
    const from = transferFrom.trim();
    const to = transferTo.trim();
    const xp = Number(transferXp);
    const gold = Number(transferGold);
    if (!from || !to) return notify(false, 'Kaynak ve hedef kullanıcı adını gir');
    if (from === to) return notify(false, 'Kaynak ve hedef aynı olamaz');
    if (!Number.isFinite(xp) || !Number.isFinite(gold) || (xp <= 0 && gold <= 0)) {
      return notify(false, 'Geçerli XP/altın miktarı gir');
    }
    setBusy('transfer');
    const r = await adminAction('transfer', { source: from, target: to, xp, coins: gold });
    setBusy('');
    if (!r.ok) {
      if (r.code === 'insufficient_balance') {
        return notify(false, `${from} hesabında yeterli bakiye yok`);
      }
      return notify(false, r.error);
    }
    setTransferXp('');
    setTransferGold('');
    notify(true, `${from} → ${to}: ${xp} XP + ${gold} altın aktarıldı`);
    if (selected && (selected.username === from || selected.username === to)) {
      await refreshSelected();
    }
  };

  // ---------- Hediye ----------
  const doGrant = async (itemType, itemId) => {
    if (!selected) return;
    setBusy('grant');
    const r = await adminAction('grant', { target: selected.username, itemType, itemId });
    setBusy('');
    if (!r.ok) return notify(false, r.error);
    notify(true, 'Hediye gönderildi (kullanıcı sync sonrası kullanabilir)');
    await refreshSelected();
  };

  const doRevoke = async (itemType, itemId) => {
    if (!selected) return;
    setBusy('revoke');
    const r = await adminAction('revoke', { target: selected.username, itemType, itemId });
    setBusy('');
    if (!r.ok) return notify(false, r.error);
    notify(true, 'Hediye geri alındı');
    await refreshSelected();
  };

  const doUnflag = async () => {
    if (!selected) return;
    setBusy('unflag');
    const r = await adminAction('unflag', { target: selected.username });
    setBusy('');
    if (!r.ok) return notify(false, r.error);
    notify(true, 'Şüpheli bayrağı kaldırıldı');
    await refreshSelected();
  };

  // ---------- Günlük ----------
  const loadLogs = async () => {
    setBusy('logs');
    const r = await adminAction('logs');
    setBusy('');
    if (!r.ok) return notify(false, r.error);
    setLogs(r.data.logs || []);
    setLogsLoaded(true);
  };

  const grantedSet = useMemo(() => {
    const set = new Set();
    (selected?.granted_items || []).forEach((g) => {
      if (g?.type && g?.id) set.add(`${g.type}:${g.id}`);
    });
    return set;
  }, [selected]);

  const tabDef = GRANT_TABS.find((t) => t.key === grantTab) || GRANT_TABS[0];
  const tabItems = tabDef.items();
  const contentStyle = [styles.content, { paddingBottom: Math.max(24, insets.bottom + 24) }];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---------- 1) İSTATİSTİKLER ---------- */}
        <SectionHeader title="İstatistikler" />
        <View style={styles.statGrid}>
          {statsList.map((s) => (
            <Card key={s.key} padding="sm" style={styles.statCard}>
              <Text variant="stat" style={styles.statValue}>{s.value}</Text>
              <Text variant="micro" style={styles.statLabel}>{s.label}</Text>
            </Card>
          ))}
        </View>
        <Card padding="sm" style={styles.systemCard}>
          <View
            style={[
              styles.dot,
              { backgroundColor: server?.connected ? C.success : C.danger },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" style={styles.systemTitle}>
              {server?.connected ? 'Sistem çevrimiçi' : 'Sistem çevrimdışı'}
            </Text>
            <Text variant="micro" style={styles.systemSub}>
              {server?.lastSync
                ? `Son senkron: ${new Date(server.lastSync).toLocaleString('tr-TR')}`
                : 'Henüz senkron yapılmadı'}
            </Text>
          </View>
          <Button label="Yenile" size="sm" variant="secondary" onPress={() => refreshServer()} />
        </Card>

        {/* ---------- 2) KULLANICI ARAMA ---------- */}
        <SectionHeader title="Kullanıcı Ara" />
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <TextInput
              label="KULLANICI ADI"
              value={query}
              onChangeText={setQuery}
              placeholder="kullanici_adi…"
              autoCapitalize="none"
              onSubmitEditing={doSearch}
            />
          </View>
          <Button
            label="Ara"
            loading={searching}
            onPress={doSearch}
            style={styles.searchBtn}
          />
        </View>

        {results.length > 0 ? (
          <Card padding={0} style={styles.resultsCard}>
            {results.map((u, i) => (
              <Card
                key={u.username}
                padding="sm"
                onPress={() => selectUser(u.username)}
                style={[
                  styles.resultRow,
                  i > 0 && styles.resultRowBorder,
                  u.username === selected?.username && styles.resultRowActive,
                ]}
                accessibilityLabel={`${u.username} profilini aç`}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" style={styles.resultName}>{u.username}</Text>
                  <Text variant="micro" style={styles.resultMeta}>
                    {u.xp} XP · {u.coins} 🪙
                  </Text>
                </View>
                <View style={styles.resultBadges}>
                  {u.banned ? (
                    <Pill size="sm" bg={C.danger + '22'} color={C.danger}>
                      BANLI
                    </Pill>
                  ) : null}
                  {u.flagged ? (
                    <Pill size="sm" bg={C.xp + '22'} color={C.xp}>
                      ŞÜPHELİ
                    </Pill>
                  ) : null}
                </View>
              </Card>
            ))}
          </Card>
        ) : searched && !searching ? (
          <EmptyState
            compact
            name="search"
            title="Sonuç bulunamadı"
            subtitle="Yazdığın isimle eşleşen bir kullanıcı yok — yazımı kontrol edip tekrar dene."
          />
        ) : null}

        {/* ---------- 3) SEÇİLİ KULLANICI ---------- */}
        <SectionHeader title="Kullanıcı Yönetimi" />
        {!selected && busy !== 'loading' ? (
          <EmptyState
            compact
            name="person"
            title="Kullanıcı seçilmedi"
            subtitle="Yukarıdan bir kullanıcı ara ve satırına dokun — detay, hediye ve işlem araçları burada açılır."
          />
        ) : null}
        {busy === 'loading' ? (
          <ActivityIndicator color={C.primary} style={{ marginVertical: 16 }} />
        ) : null}

        {selected ? (
          <>
            <Card style={styles.userCard}>
              <View style={styles.userHead}>
                <View style={{ flex: 1 }}>
                  <Text variant="h3" style={styles.userName}>{selected.username}</Text>
                  <Text variant="micro" style={styles.userMeta}>
                    {selected.xp} XP · {selected.coins} 🪙
                    {selected.xp7d ? ` · 7g +${selected.xp7d}` : ''}
                  </Text>
                </View>
                <View style={styles.userPills}>
                  {selected.banned ? (
                    <Pill size="sm" bg={C.danger} color="#fff">
                      BANLI
                    </Pill>
                  ) : (
                    <Pill size="sm" bg={C.surfaceLight} color={C.textMuted}>
                      AKTİF
                    </Pill>
                  )}
                  {selected.flagged && !selected.banned ? (
                    <Pill size="sm" bg={C.xp} color="#fff">
                      ŞÜPHELİ
                    </Pill>
                  ) : null}
                </View>
              </View>
              {selected.ban_reason ? (
                <Text variant="small" style={styles.reasonText}>Gerekçe: {selected.ban_reason}</Text>
              ) : null}
              {selected.flagged_reason && !selected.banned ? (
                <Text variant="small" style={styles.reasonText}>Bayrak nedeni: {selected.flagged_reason}</Text>
              ) : null}
            </Card>

            {/* Hediye et */}
            <Card style={styles.blockCard}>
              <Text variant="bodyStrong" style={styles.blockTitle}>Hediye Et</Text>
              <SegmentedTabs
                options={GRANT_TABS.map((t) => ({ key: t.key, label: t.label }))}
                value={grantTab}
                onChange={setGrantTab}
              />
              <View style={styles.grantGrid}>
                {tabItems.map((item) => {
                  const granted = grantedSet.has(`${grantTab}:${item.id}`);
                  return (
                    <Card key={item.id} padding="sm" style={styles.grantCell}>
                      <Text style={styles.grantEmoji}>{item.emoji}</Text>
                      <Text variant="micro" style={styles.grantName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {granted ? (
                        <Button
                          label="Geri Al"
                          size="sm"
                          variant="ghost"
                          loading={busy === 'revoke'}
                          disabled={busy !== ''}
                          onPress={() => doRevoke(grantTab, item.id)}
                        />
                      ) : (
                        <Button
                          label="Ver"
                          size="sm"
                          loading={busy === 'grant'}
                          disabled={busy !== ''}
                          onPress={() => doGrant(grantTab, item.id)}
                        />
                      )}
                    </Card>
                  );
                })}
              </View>
            </Card>

            {/* Ödül (normal bölge) */}
            <Card style={styles.blockCard}>
              <Text variant="bodyStrong" style={styles.blockTitle}>Ödül Ver (XP / altın)</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputFlex}>
                  <TextInput
                    label="XP"
                    value={xpInput}
                    onChangeText={setXpInput}
                    placeholder="0"
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.inputFlex}>
                  <TextInput
                    label="ALTIN"
                    value={goldInput}
                    onChangeText={setGoldInput}
                    placeholder="0"
                    keyboardType="number-pad"
                  />
                </View>
              </View>
              <Button
                label="Ödül Ver"
                fullWidth
                icon={<Icon emoji="🎁" size={13} color={C.onPrimary} />}
                loading={busy === 'adjust'}
                disabled={busy !== ''}
                onPress={() => doAdjust(1)}
              />
              {selected.flagged ? (
                <Button
                  label="Şüpheli Bayrağını Kaldır"
                  variant="secondary"
                  fullWidth
                  loading={busy === 'unflag'}
                  disabled={busy !== ''}
                  onPress={doUnflag}
                />
              ) : null}
            </Card>

            {/* ---------- 4) TEHLİKELİ BÖLGE ---------- */}
            <SectionHeader title="Tehlikeli Bölge" />
            <Card style={styles.dangerCard}>
              <View style={styles.dangerHead}>
                <Icon emoji="⚠️" size={14} color={C.danger} />
                <Text variant="bodyStrong" style={styles.dangerTitle}>Bu işlemler geri alınamayabilir</Text>
              </View>

              {/* Yasaklama */}
              {!selected.banned ? (
                <>
                  <TextInput
                    label="YASAK GEREKÇESİ"
                    value={banReason}
                    onChangeText={setBanReason}
                    placeholder="Opsiyonel"
                    hint="Kullanıcı senkron alamaz ve liderlikten düşer."
                  />
                  <Button
                    label="Kullanıcıyı Yasakla"
                    variant="danger"
                    fullWidth
                    loading={busy === 'ban'}
                    disabled={busy !== ''}
                    onPress={doBan}
                  />
                </>
              ) : (
                <>
                  <Text variant="small" style={styles.dangerNote}>
                    Bu kullanıcı yasaklı — senkronu ve liderliği kapalı.
                  </Text>
                  <Button
                    label="Yasağı Kaldır"
                    fullWidth
                    loading={busy === 'unban'}
                    disabled={busy !== ''}
                    onPress={doUnban}
                  />
                </>
              )}

              {/* Ceza */}
              <View style={styles.dangerDivider} />
              <Text variant="small" style={styles.dangerSubTitle}>Ceza Kes (−XP / −altın)</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputFlex}>
                  <TextInput
                    label="XP"
                    value={xpInput}
                    onChangeText={setXpInput}
                    placeholder="0"
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.inputFlex}>
                  <TextInput
                    label="ALTIN"
                    value={goldInput}
                    onChangeText={setGoldInput}
                    placeholder="0"
                    keyboardType="number-pad"
                  />
                </View>
              </View>
              <Button
                label="Ceza Kes"
                variant="danger"
                fullWidth
                loading={busy === 'adjust'}
                disabled={busy !== ''}
                onPress={() => doAdjust(-1)}
              />

              {/* Para transferi */}
              <View style={styles.dangerDivider} />
              <Text variant="small" style={styles.dangerSubTitle}>Para Transferi</Text>
              <Text variant="small" style={styles.dangerNote}>
                Kaynak hesaptan hedefe XP/altın aktarılır (kaynak bakiyesi düşer).
              </Text>
              <TextInput
                label="GÖNDEREN"
                value={transferFrom}
                onChangeText={setTransferFrom}
                placeholder="kullanici_adi"
                autoCapitalize="none"
              />
              <TextInput
                label="ALAN"
                value={transferTo}
                onChangeText={setTransferTo}
                placeholder="kullanici_adi"
                autoCapitalize="none"
              />
              <View style={styles.inputRow}>
                <View style={styles.inputFlex}>
                  <TextInput
                    label="XP"
                    value={transferXp}
                    onChangeText={setTransferXp}
                    placeholder="0"
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.inputFlex}>
                  <TextInput
                    label="ALTIN"
                    value={transferGold}
                    onChangeText={setTransferGold}
                    placeholder="0"
                    keyboardType="number-pad"
                  />
                </View>
              </View>
              <Button
                label="Aktar"
                variant="danger"
                fullWidth
                loading={busy === 'transfer'}
                disabled={busy !== ''}
                onPress={doTransfer}
              />
            </Card>
          </>
        ) : null}

        {/* ---------- 5) DENETİM GÜNLÜĞÜ ---------- */}
        <SectionHeader
          title="Denetim Günlüğü"
          actionLabel={logsLoaded ? 'Yenile' : 'Getir'}
          onAction={loadLogs}
        />
        {busy === 'logs' ? (
          <ActivityIndicator color={C.primary} style={{ marginVertical: 12 }} />
        ) : logsLoaded ? (
          logs.length === 0 ? (
            <EmptyState compact name="list" title="Henüz işlem yok" subtitle="İlk yönetici işlemi burada listelenecek." />
          ) : (
            <Card style={styles.logsCard}>
              {logs.map((l) => (
                <View key={l.id} style={styles.logRow}>
                  <Text variant="micro" style={styles.logText}>
                    {l.created_at?.slice(0, 16).replace('T', ' ')} ·{' '}
                    <Text style={styles.logAction}>{l.action}</Text>
                    {l.target ? ` → ${l.target}` : ''}
                  </Text>
                  {l.detail ? <Text variant="micro" style={styles.logDetail}>{l.detail}</Text> : null}
                </View>
              ))}
            </Card>
          )
        ) : null}

        {/* ---------- durum mesajı ---------- */}
        {message ? (
          <Pill
            size="sm"
            bg={(message.ok ? C.success : C.danger) + '22'}
            color={message.ok ? C.success : C.danger}
          >
            {message.text}
          </Pill>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
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
      padding: 24,
      gap: 24,
    },

    // ---- istatistik ----
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    statCard: {
      width: '48%',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 14,
    },
    statValue: {
      ...type.stat,
      color: C.primary,
      lineHeight: 32,
    },
    statLabel: {
      ...type.micro,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 16,
    },
    systemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: RADIUS.full,
    },
    systemTitle: {
      ...type.bodyStrong,
      color: C.text,
      fontSize: 15,
      lineHeight: 22,
    },
    systemSub: {
      ...type.micro,
      color: C.textMuted,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
      lineHeight: 16,
    },

    // ---- arama ----
    searchRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
    },
    searchBtn: {
      marginBottom: 2,
    },
    resultsCard: {
      paddingVertical: 4,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    resultRowBorder: {
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    resultRowActive: {
      backgroundColor: C.primary + '0F',
      borderRadius: 12,
    },
    resultName: {
      ...type.bodyStrong,
      color: C.text,
      lineHeight: 22,
    },
    resultMeta: {
      ...type.micro,
      color: C.textMuted,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
      lineHeight: 16,
    },
    resultBadges: {
      flexDirection: 'row',
      gap: 6,
    },

    // ---- seçili kullanıcı ----
    userCard: {
      gap: 8,
    },
    userHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    userName: {
      ...type.h3,
      color: C.text,
      lineHeight: 26,
    },
    userMeta: {
      ...type.micro,
      color: C.textMuted,
      marginTop: 3,
      fontVariant: ['tabular-nums'],
      lineHeight: 16,
    },
    userPills: {
      flexDirection: 'row',
      gap: 6,
    },
    reasonText: {
      ...type.small,
      color: C.xp,
      lineHeight: 20,
    },
    blockCard: {
      gap: 12,
    },
    blockTitle: {
      ...type.bodyStrong,
      color: C.text,
      fontSize: 15,
      lineHeight: 22,
    },

    // ---- hediye ----
    grantGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    grantCell: {
      width: '31%',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
    },
    grantEmoji: {
      fontSize: 22,
      lineHeight: 32,
    },
    grantName: {
      ...type.micro,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 16,
    },

    // ---- form ----
    inputRow: {
      flexDirection: 'row',
      gap: 10,
    },
    inputFlex: {
      flex: 1,
      minWidth: 0,
    },

    // ---- tehlikeli bölge ----
    dangerCard: {
      gap: 12,
      borderColor: C.danger + '66',
      borderWidth: 1,
      backgroundColor: C.surface,
    },
    dangerHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dangerTitle: {
      ...type.bodyStrong,
      color: C.danger,
      fontSize: 15,
      lineHeight: 22,
    },
    dangerSubTitle: {
      ...type.small,
      color: C.danger,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      lineHeight: 20,
    },
    dangerNote: {
      ...type.small,
      color: C.textMuted,
      lineHeight: 20,
    },
    dangerDivider: {
      height: 1,
      backgroundColor: C.border,
      marginVertical: 2,
    },

    // ---- günlük ----
    logsCard: {
      gap: 0,
      paddingVertical: 6,
    },
    logRow: {
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    logText: {
      ...type.micro,
      color: C.textMuted,
      lineHeight: 16,
    },
    logAction: {
      color: C.text,
      fontWeight: '700',
    },
    logDetail: {
      ...type.micro,
      color: C.textMuted,
      marginTop: 2,
      lineHeight: 16,
    },
  });
}
