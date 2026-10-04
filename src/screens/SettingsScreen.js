// ============================================================
// SettingsScreen — "Ayarlar" ekranı (v3 design system, sıfırdan)
//
// BÖLÜMLER: PROFİL · BİLDİRİMLER · GÖRÜNÜM · SUNUCU · VERİ · YÖNETİCİ
// Her satır: icon (IconTile) + label/desc + chevron/değer/aktion.
// - Bildirimler: 24'lük yatay saat şeridi (null = Kapalı) + 2 Switch
// - Sunucu: bağlantı durumu (nokta) + Senkronla butonu
// - Veri: Yedekle / Geri Yükle / Sıfırla (danger)
// - Çıkış (danger) ve yöneticiyse Admin linki + hesabı sil
//
// DataContext API (değişmedi): data, today, setReminderHour(null=kapalı),
//   setOsNotify, setHourlyNotify, backupData, restoreData, backupTs,
//   resetAll, server, refreshServer · AuthContext: user, logout,
//   changeName, changePassword, deleteAccount.
//
// NOT: Eski Sheet bileşeni BlurView içerir (blur yasağı) → isim/şifre
//   düzenleme için kendi fade-modal'ı kullanılır.
//
// SAFE AREA: STACK ekranı — AppHeader 'Ayarlar', alt inset content'te.
// KURALLAR: glow/gradient/blur/loop YOK · animasyon ≤300ms (Modal fade) ·
//   h1 yok (AppHeader) · danger yalnız çıkış/sil/sıfırla.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  I18nManager,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View
} from 'react-native';
import Text from '../components/ui/Text';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AvatarCircle from '../components/AvatarCircle';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Icon from '../components/ui/icons';
import IconTile from '../components/ui/IconTile';
import SectionHeader from '../components/ui/SectionHeader';
import TextInput from '../components/ui/TextInput';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import useDismissOnEscape from '../hooks/useDismissOnEscape';
import { getShopItem } from '../data/shop';
import {
  cancelDailyReminder,
  cancelHourlyMotivation,
  ensureNotificationPermission,
  scheduleDailyReminder,
} from '../services/notifications';
import { checkServerConnection } from '../services/connectionService';
import {
  LANG_LABELS,
  LOCALES,
  deviceLocale,
  needsRTLRestart,
  setLocale,
  useT,
  useLocale,
} from '../i18n';
import { RADIUS, getTheme, useTheme } from '../theme';

// Saat çipleri 36px görsel yükseklikte; dokunma hedefini 44'e tamamla
// (görsel ölçü değişmez).
const HOUR_CHIP_HIT_SLOP = { top: 4, bottom: 4, left: 4, right: 4 };

// Onay kutusu: mobilde Alert (özel buton etiketi), web'de confirm.
function confirmDialog(title, message, okLabel, onOk) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onOk();
  } else {
    Alert.alert(title, message, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: okLabel, style: 'destructive', onPress: onOk },
    ]);
  }
}

// Bilgilendirme: mobilde Alert, web'de tarayıcı kutusu.
function notify(title, message) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// Ayar satırı: icon + label/desc + sağ aksiyon (chevron/değer/switch/buton).
function Row({ name, label, desc, right, onPress, danger }) {
  const { colors: C, type } = useTheme();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const body = (
    <>
      <IconTile name={name} size={36} iconSize={17} variant={danger ? 'danger' : 'glass'} />
      <View style={styles.rowText}>
        <Text variant="bodyStrong" style={[styles.rowLabel, danger && { color: C.danger }]}>{label}</Text>
        {desc ? <Text variant="micro" style={styles.rowDesc}>{desc}</Text> : null}
      </View>
      {right !== undefined ? (
        right
      ) : onPress ? (
        <Icon name="chevron-forward" size={16} color={C.textMuted} />
      ) : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={styles.row}>{body}</View>;
}

// İsim/şifre değiştirme modalı (blur YOK — düz fade + Card).
function EditModal({ visible, title, fields, buttonLabel, onSubmit, onClose }) {
  const { colors: C, type } = useTheme();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const [values, setValues] = useState(() => fields.map(() => ''));
  const [error, setError] = useState('');

  const reset = () => {
    setValues(fields.map(() => ''));
    setError('');
  };
  // Escape (web): backdrop ile aynı kapanma yolu (back zaten onRequestClose).
  useDismissOnEscape(visible, () => {
    reset();
    onClose();
  });

  const submit = async () => {
    const result = await onSubmit(values);
    if (result && !result.ok) {
      setError(result.error || 'İşlem başarısız');
      return;
    }
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { reset(); onClose(); }}>
      <Pressable style={styles.backdrop} onPress={() => { reset(); onClose(); }}>
        <Pressable style={styles.sheet}>
          <Card style={styles.sheetCard}>
            <Text variant="h3" style={styles.sheetTitle}>{title}</Text>
            {fields.map((f, i) => (
              <TextInput
                key={f}
                label={f.toUpperCase()}
                value={values[i]}
                onChangeText={(t) => setValues((prev) => prev.map((v, j) => (j === i ? t : v)))}
                placeholder={f}
                secureTextEntry={f.toLowerCase().includes('şifre')}
                autoCapitalize="none"
              />
            ))}
            {error ? <Text variant="small" style={styles.error}>{error}</Text> : null}
            <Button label={buttonLabel} fullWidth onPress={submit} />
            <Button
              label="Vazgeç"
              variant="ghost"
              fullWidth
              onPress={() => {
                reset();
                onClose();
              }}
            />
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function SettingsScreen() {
  const {
    data,
    today,
    setReminderHour,
    setOsNotify,
    setHourlyNotify,
    backupData,
    restoreData,
    backupTs,
    resetAll,
    server,
    refreshServer,
    setLanguage,
  } = useData();
  const { user: authUser, logout, changeName, changePassword, deleteAccount } = useAuth();
  const { colors: C, type } = useTheme();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const t = useT();
  const locale = useLocale();

  const reminderHour = data.settings.reminderHour;
  const osNotify = !!data.settings.osNotify;
  const hourlyNotify = !!data.settings.hourlyNotify;
  // Bugün tamamlanmamış alışkanlık sayısı → hatırlatma metni güncel kalsın.
  const pendingToday =
    data.habits.length - data.habits.filter((h) => h.completedDates.includes(today)).length;

  const [editSheet, setEditSheet] = useState(null); // 'name' | 'password'
  const [busy, setBusy] = useState('');
  // Son senkron sonucu: 'online' | 'offline' | null.
  const [syncStatus, setSyncStatus] = useState(null);
  // Dil listesi açık mı (ayarlar > dil satırı).
  const [langOpen, setLangOpen] = useState(false);

  // OS bildirimi açıkken saat değişirse plan tazelenir; saat kapanırsa iptal.
  useEffect(() => {
    if (osNotify && reminderHour != null) {
      scheduleDailyReminder(reminderHour, pendingToday);
    } else if (osNotify && reminderHour == null) {
      cancelDailyReminder();
    }
  }, [reminderHour, osNotify, pendingToday]);

  // "Kapalıyken de hatırlatsın": izin iste + planla / iptal et.
  const toggleOsNotify = async (value) => {
    if (value) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        notify('Bildirim izni gerekli', 'Kapalıyken hatırlatma için bildirim iznini vermelisin.');
        return;
      }
      if (reminderHour == null) setReminderHour(20);
      const r = await scheduleDailyReminder(reminderHour ?? 20, pendingToday);
      if (!r.ok) {
        notify('Hata', r.error || 'Hatırlatma planlanamadı.');
        return;
      }
      setOsNotify(true);
    } else {
      await cancelDailyReminder();
      setOsNotify(false);
    }
  };

  // Saatlik motivasyon: izin iste + aç/kapat (planlama DataContext'te).
  const toggleHourlyNotify = async (value) => {
    if (value) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        notify('Bildirim izni gerekli', 'Saatlik motivasyon için bildirim iznini vermelisin.');
        return;
      }
      setHourlyNotify(true);
    } else {
      await cancelHourlyMotivation();
      setHourlyNotify(false);
    }
  };

  const currentTheme = getTheme(data.settings.themeId || 'dark');
  const currentAvatar = getShopItem(data.settings.avatarId || 'av_fox');

  // ---------- Dil ----------
  // null = cihaz dili (Otomatik). Seçim anında uygulanır; AR <-> diğer yön
  // değişiminde I18nManager.forceRTL yeniden başlatma ister → kullanıcıya
  // kapatıp açma uyarısı gösterilir.
  const effectiveLang = data.settings.language || locale;
  const languageLabel = data.settings.language
    ? `${LANG_LABELS[data.settings.language]?.flag || ''} ${
        LANG_LABELS[data.settings.language]?.name || data.settings.language
      }`.trim()
    : `${LANG_LABELS[effectiveLang]?.flag || ''} ${t('settings.language.auto')}`.trim();

  const languageOptions = [
    { code: null, label: t('settings.language.auto'), flag: '🌐', active: !data.settings.language },
    ...LOCALES.map((code) => ({
      code,
      label: LANG_LABELS[code]?.name || code,
      flag: LANG_LABELS[code]?.flag || '',
      active: data.settings.language === code,
    })),
  ];

  const chooseLanguage = (lang) => {
    setLanguage(lang);
    setLangOpen(false);
    const effective = lang || deviceLocale();
    setLocale(effective);
    if (needsRTLRestart()) {
      Alert.alert(t('settings.language.restartTitle'), t('settings.language.restartMsg'), [
        { text: t('common.ok') },
      ]);
    }
  };

  const handleSync = async () => {
    setBusy('server');
    let ok = false;
    try {
      ok = await checkServerConnection();
      if (ok && refreshServer) await refreshServer();
    } catch (e) {
      ok = false;
    } finally {
      setBusy('');
    }
    setSyncStatus(ok ? 'online' : 'offline');
    notify(
      ok ? 'Bağlantı Başarılı' : 'Bağlantı Hatası',
      ok
        ? 'Supabase bulut veritabanına erişildi. Uygulama artık çevrimiçi.'
        : 'İnternet bağlantını veya bulut veritabanı erişimini kontrol et.'
    );
  };

  const handleBackup = async () => {
    setBusy('backup');
    await backupData();
    setBusy('');
  };

  const handleRestore = () => {
    confirmDialog(
      'Yedeği geri yükle',
      'Mevcut verinin yerine yedekteki veri gelecek. Emin misin?',
      'Geri Yükle',
      async () => {
        setBusy('restore');
        const result = await restoreData();
        setBusy('');
        if (!result.ok) notify('Hata', result.error || 'Geri yüklenemedi');
      }
    );
  };

  const serverDesc =
    syncStatus === 'online'
      ? 'Çevrimiçi — Supabase bulut veritabanına bağlı'
      : syncStatus === 'offline'
        ? 'Çevrimdışı — internet veya bulut erişim sorunu'
        : server.connected
          ? server.lastSync
            ? `Bağlı — son senkron: ${new Date(server.lastSync).toLocaleString('tr-TR')}`
            : 'Bağlı'
          : 'Çevrimdışı — arkadaşlık ve liderlik özellikleri önbellekten çalışır';
  const serverDot =
    syncStatus === 'offline' || (syncStatus === null && !server.connected) ? C.danger : C.success;

  const contentStyle = [
    styles.content,
    { paddingBottom: Math.max(24, insets.bottom + 24) },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ---------- PROFİL ---------- */}
      <SectionHeader title="Profil" />
      <Card style={styles.profileCard}>
        <AvatarCircle
          avatarId={data.settings.avatarId}
          frameId={data.settings.frameId}
          photo={data.settings.photoUrl}
          size={64}
          ringColor={C.gold}
        />
        <View style={styles.profileInfo}>
          <Text variant="h3" style={styles.profileName}>{authUser?.name || 'Kullanıcı'}</Text>
          <Text variant="small" style={styles.profileSub}>
            {currentAvatar?.name || 'Avatar'} · hesap adın liderlikte görünür
          </Text>
        </View>
      </Card>
      <View style={styles.group}>
        <Row
          name="person"
          label="İsim değiştir"
          desc="Liderlik tablosunda görünen adın"
          onPress={() => setEditSheet('name')}
        />
        <Row
          name="key"
          label="Şifre değiştir"
          desc="Eski şifreni doğrulayarak yenisini belirle"
          onPress={() => setEditSheet('password')}
        />
        <Row
          name="log-out"
          label="Çıkış yap"
          desc="Bir dahaki açılışta isim ve şifre istenir"
          danger
          right={
            <Button
              label="Çıkış"
              variant="danger"
              size="sm"
              onPress={() =>
                confirmDialog('Çıkış yap', 'Hesabından çıkış yapılsın mı?', 'Çıkış', () => logout())
              }
            />
          }
        />
      </View>

      {/* ---------- BİLDİRİMLER ---------- */}
      <SectionHeader title="Bildirimler" />
      <Card style={styles.hourCard}>
        <View style={styles.hourHead}>
          <IconTile name="alarm" size={36} iconSize={17} variant="glass" />
          <View style={styles.rowText}>
            <Text variant="bodyStrong" style={styles.rowLabel}>Günlük hatırlatma</Text>
            <Text variant="micro" style={styles.rowDesc}>
              {reminderHour == null
                ? 'Kapalı — bir saat seçerek aç'
                : `Her gün ${String(reminderHour).padStart(2, '0')}:00'de hatırlatır`}
            </Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourStrip}>
          <Pressable
            onPress={() => setReminderHour(null)}
            accessibilityRole="button"
            accessibilityLabel="Hatırlatmayı kapat"
            hitSlop={HOUR_CHIP_HIT_SLOP}
            style={[styles.hourChip, styles.hourChipOff, reminderHour == null && styles.hourChipOffActive]}
          >
            <Text variant="micro" style={[styles.hourChipOffText, reminderHour == null && styles.hourChipTextActive]}>
              Kapalı
            </Text>
          </Pressable>
          {Array.from({ length: 24 }, (_, h) => {
            const active = reminderHour === h;
            return (
              <Pressable
                key={h}
                onPress={() => setReminderHour(h)}
                accessibilityRole="button"
                accessibilityLabel={`Hatırlatma saati ${h}.00`}
                accessibilityState={{ selected: active }}
                hitSlop={HOUR_CHIP_HIT_SLOP}
                style={[styles.hourChip, active && styles.hourChipActive]}
              >
                <Text variant="micro" style={[styles.hourChipText, active && styles.hourChipTextActive]}>
                  {String(h).padStart(2, '0')}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Card>
      <View style={styles.group}>
        <Row
          name="notifications"
          label="Kapalıyken de hatırlatsın"
          desc={
            osNotify
              ? `Uygulama kapalıyken ${String(reminderHour ?? 20).padStart(2, '0')}:00'de OS bildirimi gelir`
              : 'Açınca uygulama kapalıyken bile bildirim gelir'
          }
          right={
            <Switch
              value={osNotify}
              onValueChange={toggleOsNotify}
              trackColor={{ true: C.primary, false: C.surfaceLight }}
              thumbColor={osNotify ? C.onPrimary : C.textMuted}
            />
          }
        />
        <Row
          name="time"
          label="Saatlik motivasyon"
          desc={
            hourlyNotify
              ? 'Her saat başı görev durumuna göre bildirim gönderilir'
              : 'Açınca her saat başı bildirim gelir'
          }
          right={
            <Switch
              value={hourlyNotify}
              onValueChange={toggleHourlyNotify}
              trackColor={{ true: C.primary, false: C.surfaceLight }}
              thumbColor={hourlyNotify ? C.onPrimary : C.textMuted}
            />
          }
        />
      </View>

      {/* ---------- DİL ---------- */}
      <SectionHeader title={t('settings.section.language')} />
      <View style={styles.group}>
        <Row
          name="language"
          label={t('settings.language.label')}
          desc={t('settings.language.desc')}
          onPress={() => setLangOpen((v) => !v)}
          right={
            <View style={styles.valueRow}>
              <Text style={styles.valueText}>{languageLabel}</Text>
              <Icon name={langOpen ? 'chevron-up' : 'chevron-forward'} size={16} color={C.textMuted} />
            </View>
          }
        />
        {langOpen ? (
          <View style={styles.langGroup}>
            {languageOptions.map((opt) => (
              <Pressable
                key={opt.code || 'auto'}
                onPress={() => chooseLanguage(opt.code)}
                style={({ pressed }) => [styles.langRow, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityState={{ selected: opt.active }}
                accessibilityLabel={opt.label}
              >
                <Text style={styles.langFlag}>{opt.flag}</Text>
                <Text style={[styles.langName, opt.active && styles.langNameActive]}>
                  {opt.label}
                </Text>
                {opt.active ? <Icon name="checkmark" size={16} color={C.primary} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* ---------- GÖRÜNÜM ---------- */}
      <SectionHeader title="Görünüm" />
      <View style={styles.group}>
        <Row
          name="color-palette"
          label="Aktif tema"
          desc={`${currentTheme.name} — yeni temalar Dükkan'da satılır`}
          onPress={() => navigation.navigate('Main', { screen: 'Shop' })}
          right={
            <View style={styles.valueRow}>
              <Text style={styles.valueEmoji}>{currentTheme.emoji}</Text>
              <Icon name="chevron-forward" size={16} color={C.textMuted} />
            </View>
          }
        />
      </View>

      {/* ---------- SUNUCU ---------- */}
      <SectionHeader title="Sunucu" />
      <View style={styles.group}>
        <Row
          name="cloud"
          label="Bağlantı durumu"
          desc={serverDesc}
          right={
            <View style={styles.valueRow}>
              <View style={[styles.dot, { backgroundColor: serverDot }]} />
              <Button
                label={busy === 'server' ? '…' : 'Senkronla'}
                size="sm"
                variant="secondary"
                loading={busy === 'server'}
                disabled={busy !== ''}
                onPress={handleSync}
              />
            </View>
          }
        />
        <Row
          name="information-circle"
          label="Nasıl çalışır?"
          desc="Profilin, XP'n ve arkadaşlıkların bulut sunucusunda saklanır; cihaz değiştirsen bile aynı isimle devam edebilirsin."
        />
      </View>

      {/* ---------- VERİ ---------- */}
      <SectionHeader title="Veri" />
      <View style={styles.group}>
        <Row
          name="cloud-download"
          label="Yedekle"
          desc={
            backupTs
              ? `Son yedek: ${new Date(backupTs).toLocaleString('tr-TR')}`
              : 'Verinin anlık kopyasını cihazına kaydet'
          }
          right={
            <Button
              label="Yedekle"
              size="sm"
              variant="secondary"
              loading={busy === 'backup'}
              disabled={busy !== ''}
              onPress={handleBackup}
            />
          }
        />
        <Row
          name="cloud-upload"
          label="Yedeği geri yükle"
          desc="Kaydedilen son yedeği getirir (mevcut veri değişir)"
          right={
            <Button
              label="Geri Yükle"
              size="sm"
              variant="secondary"
              loading={busy === 'restore'}
              disabled={busy !== '' || !backupTs}
              onPress={handleRestore}
            />
          }
        />
        <Row
          name="trash"
          label="Tüm verileri sıfırla"
          desc="Alışkanlıklar, XP, seviye ve arkadaşlar kalıcı olarak silinir"
          danger
          right={
            <Button
              label="Sıfırla"
              variant="danger"
              size="sm"
              onPress={() =>
                confirmDialog('Verileri sıfırla', 'Tüm verilerin silinecek. Emin misin?', 'Sıfırla', () =>
                  resetAll()
                )
              }
            />
          }
        />
      </View>

      {/* ---------- YÖNETİCİ (yalnız admin) ---------- */}
      {authUser?.isAdmin ? (
        <>
          <SectionHeader title="Yönetici" />
          <View style={styles.group}>
            <Row
              name="shield"
              label="Yönetici Paneli"
              desc="Kullanıcı ara, yasakla, ceza/ödül ver, hediye gönder"
              onPress={() => navigation.navigate('Admin')}
            />
            <Row
              name="person-remove"
              label="Kayıtlı kullanıcı hesabını sil"
              desc="Silinirse cihazda yeni bir hesap açılabilir (admin oturumu sürer)"
              danger
              right={
                <Button
                  label="Sil"
                  variant="danger"
                  size="sm"
                  onPress={() =>
                    confirmDialog(
                      'Kullanıcı hesabını sil',
                      'Kayıtlı kullanıcı hesabı silinsin mi?',
                      'Sil',
                      () => deleteAccount()
                    )
                  }
                />
              }
            />
          </View>
        </>
      ) : null}

      {/* ---------- Hakkında ---------- */}
      <View style={styles.aboutBox}>
        <Text variant="bodyStrong" style={styles.aboutTitle}>HabiX</Text>
        <Text variant="micro" style={styles.aboutText}>
          Oyunlaştırılmış Alışkanlık Takibi · Sürüm 1.1.0{'\n'}
          React Native + Expo SDK 57
        </Text>
      </View>

      {/* İsim / şifre değiştirme modalları */}
      <EditModal
        visible={editSheet === 'name'}
        title="İsim Değiştir"
        fields={['Yeni isim']}
        buttonLabel="Kaydet"
        onClose={() => setEditSheet(null)}
        onSubmit={([name]) => changeName(name)}
      />
      <EditModal
        visible={editSheet === 'password'}
        title="Şifre Değiştir"
        fields={['Eski şifre', 'Yeni şifre']}
        buttonLabel="Şifreyi Güncelle"
        onClose={() => setEditSheet(null)}
        onSubmit={([oldPass, newPass]) => changePassword(oldPass, newPass)}
      />
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
      padding: 24,
      gap: 24,
    },
    group: {
      gap: 8,
      marginBottom: 8,
    },

    // ---- satır ----
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      padding: 12,
    },
    rowPressed: {
      opacity: 0.7,
    },
    rowText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    rowLabel: {
      ...type.bodyStrong,
      color: C.text,
      fontSize: 15,
      lineHeight: 22,
    },
    rowDesc: {
      ...type.micro,
      color: C.textMuted,
      lineHeight: 16,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    valueEmoji: {
      fontSize: 22,
      lineHeight: 32,
    },
    valueText: {
      ...type.small,
      color: C.textMuted,
      lineHeight: 20,
      textAlign: 'right',
    },
    // ---- dil listesi ----
    langGroup: {
      gap: 2,
      paddingVertical: 4,
    },
    langRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: RADIUS.md,
    },
    langFlag: {
      fontSize: 20,
      lineHeight: 28,
      width: 28,
      textAlign: 'center',
    },
    langName: {
      ...type.body,
      color: C.textMuted,
      flex: 1,
      minWidth: 0,
      lineHeight: 22,
    },
    langNameActive: {
      color: C.primary,
      fontWeight: '700',
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: RADIUS.full,
    },

    // ---- profil ----
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 2,
    },
    profileInfo: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    profileName: {
      ...type.h3,
      color: C.text,
      lineHeight: 26,
    },
    profileSub: {
      ...type.small,
      color: C.textMuted,
      lineHeight: 20,
    },

    // ---- saat şeridi ----
    hourCard: {
      gap: 12,
    },
    hourHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    hourStrip: {
      gap: 6,
      paddingVertical: 2,
    },
    hourChip: {
      minWidth: 40,
      height: 36,
      borderRadius: RADIUS.md,
      backgroundColor: C.surfaceLight,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    hourChipActive: {
      backgroundColor: C.primary,
      borderColor: C.primary,
    },
    hourChipOff: {
      paddingHorizontal: 12,
    },
    hourChipOffActive: {
      backgroundColor: C.danger + '22',
      borderColor: C.danger,
    },
    hourChipText: {
      ...type.micro,
      color: C.textMuted,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      lineHeight: 16,
    },
    hourChipOffText: {
      ...type.micro,
      color: C.textMuted,
      fontWeight: '700',
      lineHeight: 16,
    },
    hourChipTextActive: {
      color: C.onPrimary,
    },

    // ---- modal ----
    backdrop: {
      flex: 1,
      minWidth: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      padding: 24,
    },
    sheet: {
      width: '100%',
    },
    sheetCard: {
      gap: 12,
      paddingVertical: 20,
    },
    sheetTitle: {
      ...type.h3,
      color: C.text,
      textAlign: 'center',
      marginBottom: 4,
      lineHeight: 26,
    },
    error: {
      ...type.small,
      color: C.danger,
      fontWeight: '600',
      lineHeight: 20,
    },

    // ---- hakkında ----
    aboutBox: {
      alignItems: 'center',
      gap: 4,
      paddingVertical: 16,
      marginTop: 6,
    },
    aboutTitle: {
      ...type.bodyStrong,
      color: C.textMuted,
      lineHeight: 22,
    },
    aboutText: {
      ...type.micro,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 16,
    },
  });
}
