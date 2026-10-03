// ============================================================
// ProfileScreen — "Profilim" alt ekranı (v3 design system ile sıfırdan)
//
// YAPI:
//   1) Üst satır     → sağ üstte Ayarlar dişli butonu
//   2) Kimlik        → avatar/foto (dokun yükle) · isim (h1) · seviye + VIP · @kullanıcı
//   3) Bio           → Card + ui/TextInput (düzenle) + ui/Button (Kaydet/Vazgeç)
//   4) 4 mini stat   → Seri / Tamamlama / XP / Altın
//   5) Envanter      → satır kartı → Inventory
//   6) Seviye özeti  → Progress + 4 hücre + Başarımlar butonu
//   7) Son 3 aktivite→ tamamlama geçmişi (bugün/dün/tarih)
//   8) Aksiyonlar    → fotoğraf yükle/değiştir · Çerçeve→Shop · fotoğrafı kaldır
//
// DataContext/Auth hook'ları DEĞİŞMEDİ:
//   useData  → data, today, updateBio, setProfilePhoto, pushToast, vipActive
//   useAuth  → user
//   servis   → pickProfilePhoto / uploadProfilePhoto / removeProfilePhoto
//
// SAFE AREA: üst başlık Stack header'ı (AppHeader/TopBar) karşılar;
//   alt inset bu ekran uygular (stack'te PillTabBar yok).
//
// KURALLAR: glow/gradient/blur/loop YOK · animasyon ≤300ms (Card/Button
//   100ms press) · 3 vurgu rengi (primary/success/gold) + danger yalnız
//   fotoğraf kaldırma · statik emoji yok (hepsi Icon → Ionicons).
// ============================================================
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedCounter from '../components/AnimatedCounter';
import AvatarCircle from '../components/AvatarCircle';
import PressableFX from '../components/PressableFX';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Icon from '../components/ui/icons';
import IconTile from '../components/ui/IconTile';
import Pill from '../components/ui/Pill';
import Progress from '../components/ui/Progress';
import SectionHeader from '../components/ui/SectionHeader';
import TextInput from '../components/ui/TextInput';
import { ACHIEVEMENTS } from '../data/achievements';
import { bestStreak, levelFromTotalXp, totalCompletions } from '../logic';
import {
  pickProfilePhoto,
  removeProfilePhoto,
  uploadProfilePhoto,
} from '../services/avatarService';
import { RADIUS, useTheme } from '../theme';

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

// 'YYYY-MM-DD' → [yıl, ay, gün] (yerel saat sapması olmadan)
function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
}

function dayLabel(key, today, yesterdayKey) {
  if (key === today) return 'Bugün';
  if (key === yesterdayKey) return 'Dün';
  const [, m, d] = parseKey(key);
  return `${d} ${MONTHS[m - 1]}`;
}

export default function ProfileScreen() {
  const { colors: C, type } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const { data, today, updateBio, setProfilePhoto, pushToast, vipActive } = useData();
  const { user: authUser } = useAuth();
  const navigation = useNavigation();
  const { stats, habits, settings } = data;

  // ---------- türetilmiş veriler ----------
  const username = settings.username || authUser?.name || 'kullanici';
  const photoUrl = settings.photoUrl || null;
  const levelInfo = levelFromTotalXp(stats.totalXp);
  const streak = bestStreak(habits, today);
  const xpPct = Math.min(100, Math.round((levelInfo.curXp / levelInfo.nextThreshold) * 100));
  const doneToday = habits.filter((h) => h.completedDates.includes(today)).length;
  const unlockedCount = (data.achievements || []).length;

  // Son 3 aktivite: tüm tamamlamaların gün anahtarından en yeniler.
  const recent3 = useMemo(() => {
    const rows = [];
    habits.forEach((h) =>
      (h.completedDates || []).forEach((d) =>
        rows.push({ key: `${h.id}_${d}`, name: h.name, emoji: h.emoji, date: d })
      )
    );
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return rows.slice(0, 3);
  }, [habits]);

  const yesterdayKey = useMemo(() => {
    const [y, m, d] = parseKey(today);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
      dt.getDate()
    ).padStart(2, '0')}`;
  }, [today]);

  // ---------- Bio ----------
  const [bioDraft, setBioDraft] = useState(settings.bio || '');
  const [editingBio, setEditingBio] = useState(false);

  const onSaveBio = () => {
    updateBio(bioDraft.trim());
    setEditingBio(false);
  };
  const onCancelBio = () => {
    setBioDraft(settings.bio || '');
    setEditingBio(false);
  };

  // ---------- Fotoğraf ----------
  const [photoBusy, setPhotoBusy] = useState(false);

  const pickAndUpload = async () => {
    if (photoBusy) return;
    setPhotoBusy(true);
    const picked = await pickProfilePhoto();
    if (!picked.ok) {
      if (!picked.canceled) {
        pushToast({ icon: '⚠️', title: picked.error || 'Fotoğraf seçilemedi', color: C.danger });
      }
      setPhotoBusy(false);
      return;
    }
    const uploaded = await uploadProfilePhoto(username, picked.uri);
    if (!uploaded.ok) {
      pushToast({ icon: '⚠️', title: uploaded.error || 'Yükleme başarısız', color: C.danger });
      setPhotoBusy(false);
      return;
    }
    setProfilePhoto(uploaded.photoUrl);
    setPhotoBusy(false);
  };

  const removePhoto = async () => {
    await removeProfilePhoto(username);
    setProfilePhoto(null);
  };

  const stats4 = [
    { value: streak, icon: '🔥', label: 'Seri', color: C.success },
    // NOT: eski ekranda `stats.totalCompletions` kullanılıyordu; o alan
    // DataContext'te yok (her zaman 0 görünüyordu) → logic'teki sayaç.
    { value: totalCompletions(habits), icon: '✅', label: 'Tamamlama', color: C.primary },
    { value: stats.totalXp, icon: '⚡', label: 'XP', color: C.gold },
    { value: stats.gold || 0, icon: '🪙', label: 'Altın', color: C.gold },
  ];

  const summaryCells = [
    { icon: '📅', value: habits.length, label: 'Aktif alışkanlık' },
    { icon: '🎯', value: `${doneToday}/${habits.length || 0}`, label: 'Bugün tamamlanan' },
    { icon: '🍅', value: stats.pomodoroCount || 0, label: 'Odak seansı' },
    { icon: '🏆', value: `${unlockedCount}/${ACHIEVEMENTS.length}`, label: 'Başarım' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(24, insets.bottom + 24) },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ---------- 1) ÜST SATIR: Ayarlar ---------- */}
      <View style={styles.topRow}>
        <PressableFX
          onPress={() => navigation.navigate('Settings')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Ayarlar"
          style={styles.gearBtn}
        >
          <Ionicons name="settings-outline" size={20} color={C.text} />
        </PressableFX>
      </View>

      {/* ---------- 2) KİMLİK ---------- */}
      <View style={styles.identity}>
        <PressableFX
          onPress={pickAndUpload}
          disabled={photoBusy}
          accessibilityRole="button"
          accessibilityLabel={photoUrl ? 'Profil fotoğrafını değiştir' : 'Profil fotoğrafı yükle'}
        >
          <AvatarCircle
            avatarId={settings.avatarId}
            frameId={settings.frameId}
            photo={photoUrl}
            size={112}
            ringColor={C.primary}
          />
          <View style={styles.photoBadge}>
            <Icon emoji={photoBusy ? '⏳' : '📷'} size={13} color={C.onPrimary} />
          </View>
        </PressableFX>

        <Text variant="h1" style={styles.name} numberOfLines={1}>
          {authUser?.name || 'Misafir'}
        </Text>

        <View style={styles.levelRow}>
          <Text variant="small" style={styles.levelText}>
            Seviye {levelInfo.level} · <AnimatedCounter value={stats.totalXp} /> XP
          </Text>
          {vipActive ? (
            <Pill size="sm" icon="👑" bg={C.gold + '1A'} color={C.gold}>
              VIP
            </Pill>
          ) : null}
        </View>

        <Text variant="small" style={styles.username}>@{username}</Text>
      </View>

      {/* ---------- 3) BIO ---------- */}
      <Card>
        {editingBio ? (
          <View style={styles.bioEdit}>
            <TextInput
              label="BİO"
              value={bioDraft}
              onChangeText={setBioDraft}
              placeholder="Kendinden bahset…"
              maxLength={200}
              multiline
              numberOfLines={3}
              hint={`${bioDraft.length}/200 karakter`}
            />
            <View style={styles.bioBtnRow}>
              <Button label="Vazgeç" variant="ghost" size="sm" style={styles.bioBtn} onPress={onCancelBio} />
              <Button label="Kaydet" variant="primary" size="sm" style={styles.bioBtn} onPress={onSaveBio} />
            </View>
          </View>
        ) : (
          <PressableFX
            onPress={() => setEditingBio(true)}
            accessibilityRole="button"
            accessibilityLabel="Bio düzenle"
          >
            <View>
              <Text variant="body" style={styles.bioText} numberOfLines={4}>
                {settings.bio || 'Bio ekle'}
              </Text>
              {!settings.bio ? (
                <View style={styles.bioHintRow}>
                  <Icon emoji="✏️" size={12} color={C.textMuted} />
                  <Text variant="micro" style={styles.bioHintText}>dokun ve yaz</Text>
                </View>
              ) : null}
            </View>
          </PressableFX>
        )}
      </Card>

      {/* ---------- 4) 4 MİNİ STAT ---------- */}
      <View style={styles.statsRow}>
        {stats4.map((s) => (
          <Card key={s.label} padding="sm" style={styles.statCard}>
            <Icon emoji={s.icon} size={16} color={s.color} />
            <AnimatedCounter value={s.value} style={styles.statValue} />
            <Text variant="micro" style={styles.statLabel} numberOfLines={1}>
              {s.label}
            </Text>
          </Card>
        ))}
      </View>

      {/* ---------- 5) ENVANTER LİNKİ ---------- */}
      <Card onPress={() => navigation.navigate('Inventory')} accessibilityLabel="Envanter">
        <View style={styles.linkRow}>
          <IconTile name="cube" tint={C.primary} size={40} />
          <View style={styles.linkInfo}>
            <Text variant="h3" style={styles.h3} numberOfLines={1}>
              Envanter
            </Text>
            <Text variant="small" style={styles.hint} numberOfLines={2}>
              Eşyalarını kullan ve etkinleştir
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
        </View>
      </Card>

      {/* ---------- 6) SEVİYE ÖZETİ ---------- */}
      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.xpTexts}>
            <Text variant="h3" style={styles.h3} numberOfLines={1}>
              Seviye {levelInfo.level} → {levelInfo.level + 1}
            </Text>
            <Text variant="small" style={styles.hint} numberOfLines={1}>
              {levelInfo.curXp}/{levelInfo.nextThreshold} XP
            </Text>
          </View>
          <Text variant="h3" style={styles.xpValue}>%{xpPct}</Text>
        </View>
        <Progress
          value={xpPct / 100}
          height={8}
          colors={[C.primary, C.primary]}
          style={styles.xpProgress}
          accessibilityLabel={`Seviye ilerlemesi yüzde ${xpPct}`}
        />

        <View style={styles.summaryGrid}>
          {summaryCells.map((cell) => (
            <View key={cell.label} style={styles.summaryCell}>
              <Icon emoji={cell.icon} size={15} color={C.primary} />
              <Text variant="h3" style={styles.summaryCellValue} numberOfLines={1}>
                {cell.value}
              </Text>
              <Text variant="micro" style={styles.summaryCellLabel} numberOfLines={1}>
                {cell.label}
              </Text>
            </View>
          ))}
        </View>

        <Button
          label="Tüm başarımları gör"
          variant="secondary"
          size="sm"
          fullWidth
          style={styles.achBtn}
          icon={<Ionicons name="trophy" size={16} color={C.gold} />}
          onPress={() => navigation.navigate('Achievements')}
        />
      </Card>

      {/* ---------- 7) SON 3 AKTİVİTE ---------- */}
      <View>
        <SectionHeader title="Son Aktiviteler" />
        <Card>
          {recent3.length === 0 ? (
            <EmptyState
              compact
              name="time"
              title="Henüz aktivite yok"
              subtitle="Bir alışkanlığı tamamladığında burada görünür."
            />
          ) : (
            recent3.map((a) => (
              <View key={a.key} style={styles.activityRow}>
                <Icon emoji={a.emoji} size={16} color={C.textMuted} />
                <Text variant="body" style={styles.activityName} numberOfLines={1}>
                  {a.name}
                </Text>
                <Text variant="micro" style={styles.activityDate} numberOfLines={1}>
                  {dayLabel(a.date, today, yesterdayKey)}
                </Text>
              </View>
            ))
          )}
        </Card>
      </View>

      {/* ---------- 8) AKSİYONLAR ---------- */}
      <View style={styles.actionsCol}>
        <Button
          label={
            photoBusy ? 'Yükleniyor…' : photoUrl ? 'Fotoğrafı Değiştir' : 'Fotoğraf Yükle'
          }
          variant="primary"
          size="sm"
          fullWidth
          icon={<Icon emoji={photoBusy ? '⏳' : '📷'} size={15} color={C.onPrimary} />}
          loading={photoBusy}
          onPress={pickAndUpload}
        />
        <Button
          label="Çerçeve (Dükkan)"
          variant="secondary"
          size="sm"
          fullWidth
          icon={<Ionicons name="diamond-outline" size={15} color={C.primary} />}
          onPress={() => navigation.navigate('Shop')}
        />
      </View>

      {photoUrl ? (
        <Button
          label="Fotoğrafı Kaldır"
          variant="danger"
          size="sm"
          fullWidth
          onPress={removePhoto}
        />
      ) : null}
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
      justifyContent: 'flex-end',
      marginTop: -4,
    },
    gearBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },

    // ---- kimlik ----
    identity: {
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    photoBadge: {
      position: 'absolute',
      right: -2,
      bottom: 0,
      backgroundColor: C.primary,
      borderRadius: RADIUS.full,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.background,
    },
    name: {
      ...type.h1,
      color: C.text,
      marginTop: 10,
      textAlign: 'center',
      lineHeight: 30,
    },
    levelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },
    levelText: {
      ...type.small,
      color: C.textMuted,
      lineHeight: 18,
    },
    username: {
      ...type.small,
      color: C.textMuted,
      opacity: 0.8,
      lineHeight: 18,
    },

    // ---- bio ----
    bioEdit: {
      gap: 12,
    },
    bioBtnRow: {
      flexDirection: 'row',
      gap: 10,
    },
    bioBtn: {
      flex: 1,
      minWidth: 0,
    },
    bioText: {
      ...type.body,
      color: C.text,
      lineHeight: 21,
    },
    bioHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
    },
    bioHintText: {
      ...type.micro,
      color: C.textMuted,
      lineHeight: 14,
    },

    // ---- statlar ----
    statsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    statCard: {
      flex: 1,
      // 4 kart yan yana → "TAMAMLAMA" gibi 9 harfli üstün başlık ikiye
      // bölünüyordu. minWidth:0 + tek satır + dar harf aralığı ile
      // kesilmeden sığdırılır.
      minWidth: 0,
      alignItems: 'center',
      gap: 4,
    },
    statValue: {
      // Dar sütun: h3 ölçeği (17) + tabular — 5 boyut dışına ÇIKMAZ.
      ...type.h3,
      color: C.text,
      fontVariant: ['tabular-nums'],
      lineHeight: 24,
    },
    statLabel: {
      ...type.micro,
      color: C.textMuted,
      textAlign: 'center',
      letterSpacing: 0,
      flexShrink: 1,
      lineHeight: 14,
    },

    // ---- link satırı ----
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    linkInfo: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    h3: {
      ...type.h3,
      color: C.text,
      lineHeight: 24,
    },
    hint: {
      ...type.small,
      color: C.textMuted,
      lineHeight: 18,
    },

    // ---- seviye özeti ----
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    xpTexts: {
      gap: 2,
      flexShrink: 1,
    },
    xpValue: {
      ...type.h3,
      color: C.primary,
      fontVariant: ['tabular-nums'],
      lineHeight: 24,
    },
    xpProgress: {
      marginTop: 12,
    },
    summaryGrid: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
    summaryCell: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      backgroundColor: C.surfaceLight,
      borderRadius: 12,
      paddingVertical: 12,
      gap: 4,
    },
    summaryCellValue: {
      ...type.h3,
      color: C.text,
      fontVariant: ['tabular-nums'],
      lineHeight: 24,
    },
    summaryCellLabel: {
      ...type.micro,
      color: C.textMuted,
      textAlign: 'center',
      letterSpacing: 0,
      flexShrink: 1,
      lineHeight: 14,
    },
    achBtn: {
      marginTop: 14,
    },

    // ---- aktivite ----
    activityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    activityName: {
      ...type.body,
      color: C.text,
      flex: 1,
      minWidth: 0,
      lineHeight: 21,
    },
    activityDate: {
      ...type.micro,
      color: C.textMuted,
      lineHeight: 14,
    },

    // ---- aksiyonlar ----
    actionsCol: {
      gap: 10,
    },
  });
}
