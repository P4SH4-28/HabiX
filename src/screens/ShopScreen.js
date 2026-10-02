// ============================================================
// ShopScreen — "Dükkan" sekmesi (v3 design system, sıfırdan)
//
// YAPI:
//   1) Üst     → altın bakiyesi (AnimatedCounter) + aktif avatar kartı
//      (profil fotoğrafı yükle/kaldır işlemleri korunur)
//   2) Tabs    → Temalar / Avatarlar / Çerçeveler / Eşyalar (SegmentedTabs)
//   3) Filtre  → Tümü / Uygun fiyatlı / Sahip olduklarım (kategori filtresi)
//   4) Grid    → her ürün: preview + isim + fiyat + Satın Al;
//      sahip: "Seç/Uygula", seçili: "Seçili" + ✓ rozet
//   5) EmptyState → filtre sonuç yoksa
//
// DataContext API (değişmedi): data, buyAvatar, selectAvatar, buyTheme,
//   selectTheme, buyFrame, selectFrame, buyItem, vipActive,
//   setProfilePhoto, pushToast · avatarService: pickProfilePhoto,
//   uploadProfilePhoto, removeProfilePhoto · sfx.success.
//
// SAFE AREA: TAB ekranı — AppHeader 'Dükkan', alt PillTabBar'da.
// KURALLAR: glow/gradient/blur/loop YOK · animasyon ≤300ms (primitive) ·
//   h1 yok · Lottie çerçeveler statik gösterilir (loop YOK).
// ============================================================
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AnimatedCounter from '../components/AnimatedCounter';
import AvatarCircle, { FrameDecor } from '../components/AvatarCircle';
import MemoizedAvatarCircle from '../components/memoizedAvatarCircle';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Icon from '../components/ui/icons';
import PressableFX from '../components/PressableFX';
import SegmentedTabs from '../components/ui/SegmentedTabs';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { FRAMES, getShopItem, SHOP_ITEMS } from '../data/shop';
import { ITEMS } from '../data/items';
import { pickProfilePhoto, removeProfilePhoto, uploadProfilePhoto } from '../services/avatarService';
import { success } from '../services/sfx';
import { THEMES, useTheme } from '../theme';

const TABS = [
  { key: 'themes', label: 'Temalar' },
  { key: 'avatars', label: 'Avatarlar' },
  { key: 'frames', label: 'Çerçeveler' },
  { key: 'items', label: 'Eşyalar' },
];

const FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'affordable', label: 'Uygun fiyatlı' },
  { key: 'owned', label: 'Sahip olduklarım' },
];

export default function ShopScreen() {
  const { colors: C, type } = useTheme();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const navigation = useNavigation();
  const { user: authUser } = useAuth();
  const {
    data,
    buyAvatar,
    selectAvatar,
    buyTheme,
    selectTheme,
    buyFrame,
    selectFrame,
    buyItem,
    vipActive,
    setProfilePhoto,
    pushToast,
  } = useData();

  const [tab, setTab] = useState('themes');
  const [filter, setFilter] = useState('all');
  const [photoBusy, setPhotoBusy] = useState(false);

  const gold = data.stats.gold || 0;
  const ownedAvatars = data.ownedAvatars || [];
  const ownedThemes = data.ownedThemes || [];
  const ownedFrames = data.ownedFrames || [];
  const inventory = data.inventory || {};
  const currentAvatar = data.settings.avatarId || 'av_fox';
  const currentItem = getShopItem(currentAvatar);
  const currentThemeId = data.settings.themeId || 'dark';
  const currentFrameId = data.settings.frameId || null;
  const photoUrl = data.settings.photoUrl || null;
  const username = data.settings.username || authUser?.name || 'kullanici';
  // VIP çerçeveler yalnız aktif VIP kullanıcılara görünür.
  const shopFrames = FRAMES.filter((f) => !f.vip || vipActive);

  // Satın alma bildirimi: sfx + toast.
  const notifyBuy = useCallback(
    (name) => {
      success();
      pushToast({ icon: '🛍️', title: `${name} satın alındı!`, color: C.gold });
    },
    [C.gold, pushToast]
  );

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

  // ---------- kategori + filtre ----------
  const list = useMemo(() => {
    if (tab === 'themes') {
      return THEMES.map((t) => ({
        id: t.id,
        name: t.name,
        price: t.price,
        owned: ownedThemes.includes(t.id),
        selected: currentThemeId === t.id,
        theme: t,
      }));
    }
    if (tab === 'avatars') {
      return SHOP_ITEMS.map((a) => ({
        id: a.id,
        name: a.name,
        price: a.price,
        owned: ownedAvatars.includes(a.id),
        selected: currentAvatar === a.id,
        avatar: a,
      }));
    }
    if (tab === 'frames') {
      return shopFrames.map((f) => ({
        id: f.id,
        name: f.name,
        price: f.price,
        owned: ownedFrames.includes(f.id),
        selected: currentFrameId === f.id,
        frame: f,
        vip: !!f.vip,
      }));
    }
    return ITEMS.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      desc: i.desc,
      count: inventory[i.id] || 0,
      item: i,
    }));
  }, [tab, ownedThemes, ownedAvatars, shopFrames, inventory, currentThemeId, currentAvatar, currentFrameId]);

  const visible = useMemo(() => {
    if (filter === 'all') return list;
    if (tab === 'items') {
      return filter === 'owned' ? list.filter((e) => e.count > 0) : list.filter((e) => gold >= e.price);
    }
    return filter === 'owned'
      ? list.filter((e) => e.owned)
      : list.filter((e) => !e.owned && gold >= e.price);
  }, [list, filter, tab, gold]);

  const buyDisabled = (price) => gold < price;

  // ---------- ürün kartı (ortak) ----------
  const renderProduct = (entry) => {
    if (tab === 'items') {
      const afford = !buyDisabled(entry.price);
      return (
        <Card key={entry.id} style={styles.card}>
          <Icon emoji={entry.item.emoji} size={30} color={C.text} />
          <Text style={styles.cardName} numberOfLines={1}>
            {entry.name}
          </Text>
          <Text style={styles.cardDesc} numberOfLines={3}>
            {entry.desc}
          </Text>
          <Button
            label={`Satın Al · ${entry.price}`}
            size="sm"
            variant="secondary"
            fullWidth
            disabled={!afford}
            icon={<Icon emoji="🪙" size={12} color={C.gold} />}
            onPress={() => {
              buyItem(entry.id);
              notifyBuy(entry.name);
            }}
          />
          <Text style={styles.cardSub}>{entry.count} adetin var</Text>
        </Card>
      );
    }

    const isItemsTheme = tab === 'themes';
    const afford = !buyDisabled(entry.price);
    return (
      <Card key={entry.id} style={[styles.card, entry.selected && styles.cardSelected]}>
        {entry.selected ? (
          <View style={styles.ownedBadge}>
            <Icon name="checkmark" size={12} color={C.onPrimary} />
          </View>
        ) : null}

        {isItemsTheme ? (
          <View style={[styles.themeSwatch, { backgroundColor: entry.theme.colors.background }]}>
            <View style={[styles.swatchBand, { backgroundColor: entry.theme.colors.surface }]}>
              <View style={[styles.swatchDot, { backgroundColor: entry.theme.colors.primary }]} />
              <View style={[styles.swatchDot, { backgroundColor: entry.theme.colors.accent }]} />
            </View>
            <Text style={styles.swatchEmoji}>{entry.theme.emoji}</Text>
          </View>
        ) : tab === 'avatars' ? (
          <MemoizedAvatarCircle
            avatarId={entry.id}
            size={60}
            ringColor={entry.selected ? C.gold : C.border}
          />
        ) : entry.frame.lottie ? (
          <MemoizedAvatarCircle
            avatarId={currentAvatar}
            frameId={entry.id}
            size={60}
            ringColor={entry.selected ? C.gold : C.border}
          />
        ) : (
          <FrameDecor ring={entry.frame.emoji} size={60}>
            <View style={styles.frameAvatar}>
              <Text style={styles.frameAvatarEmoji}>{currentItem?.emoji || '😀'}</Text>
            </View>
          </FrameDecor>
        )}

        <View style={styles.cardNameRow}>
          {entry.vip ? <Icon emoji="👑" size={11} color={C.gold} /> : null}
          <Text style={styles.cardName} numberOfLines={1}>
            {isItemsTheme ? entry.theme.emoji : ''}
            {isItemsTheme ? ' ' : ''}
            {entry.name}
          </Text>
        </View>

        {entry.selected ? (
          <View style={styles.stateChip}>
            <Icon name="checkmark-circle" size={13} color={C.gold} />
            <Text style={styles.stateChipText}>Seçili</Text>
          </View>
        ) : entry.owned ? (
          <Button
            label={isItemsTheme ? 'Uygula' : 'Seç'}
            size="sm"
            variant="secondary"
            fullWidth
            onPress={() => (isItemsTheme ? selectTheme(entry.id) : tab === 'avatars' ? selectAvatar(entry.id) : selectFrame(entry.id))}
          />
        ) : (
          <Button
            label={entry.vip && entry.price === 0 ? 'VIP Hediye' : `Satın Al · ${entry.price}`}
            size="sm"
            fullWidth
            disabled={!afford}
            icon={
              entry.vip && entry.price === 0 ? (
                <Icon emoji="👑" size={12} color={C.gold} />
              ) : (
                <Icon emoji="🪙" size={12} color={C.gold} />
              )
            }
            onPress={() => {
              if (isItemsTheme) {
                buyTheme(entry.id);
                notifyBuy(entry.name);
              } else if (tab === 'avatars') {
                buyAvatar(entry.id);
                notifyBuy(entry.name);
              } else {
                buyFrame(entry.id);
                notifyBuy(entry.name);
              }
            }}
          />
        )}
        {entry.owned && !entry.selected ? <Text style={styles.cardSub}>Sahip Olunan</Text> : null}
      </Card>
    );
  };

  const emptyTitle =
    filter === 'owned' ? 'Sahip olduğun ürün yok' : 'Uygun fiyatlı ürün yok';
  const emptySub =
    filter === 'owned'
      ? 'Bu kategoriden henüz satın alma yapmadın — altın kazanıp ilk ürünü alabilirsin.'
      : `Bakiyen ${gold} 🪙 — alışkanlık tamamlayıp görevleri bitirerek altın kazanabilirsin.`;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ---------- ÜST: bakiye + aktif avatar ---------- */}
      <View style={styles.topRow}>
        <View>
          <Text style={styles.topLabel}>ALTIN BAKİYESİ</Text>
          <View style={styles.balanceChip}>
            <Icon emoji="🪙" size={16} color={C.gold} />
            <AnimatedCounter value={gold} style={styles.balanceText} />
          </View>
        </View>
        <AvatarCircle
          avatarId={currentAvatar}
          frameId={currentFrameId}
          photo={photoUrl}
          size={56}
          ringColor={C.gold}
        />
      </View>

      <Card style={styles.profileCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{currentItem?.name || 'Avatar'}</Text>
          <Text style={styles.profileHint}>
            Bugün ekranında ve liderlikte bu avatar görünür.
          </Text>
        </View>
        <View style={styles.photoActions}>
          <Button
            label={photoBusy ? 'Yükleniyor…' : photoUrl ? 'Değiştir' : 'Fotoğraf Yükle'}
            size="sm"
            loading={photoBusy}
            onPress={pickAndUpload}
          />
          {photoUrl ? (
            <Button label="Kaldır" size="sm" variant="ghost" onPress={removePhoto} />
          ) : (
            <Button
              label="Profili Aç"
              size="sm"
              variant="ghost"
              onPress={() => navigation.navigate('Profile')}
            />
          )}
        </View>
      </Card>

      {/* ---------- TABS ---------- */}
      <SegmentedTabs options={TABS} value={tab} onChange={(k) => { setTab(k); setFilter('all'); }} />

      {/* ---------- kategori filtreleri ---------- */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <PressableFX
              key={f.key}
              haptic
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </PressableFX>
          );
        })}
      </View>

      {/* ---------- altın nasıl kazanılır (eşyalar) ---------- */}
      {tab === 'items' ? (
        <Card style={styles.howCard}>
          <View style={styles.howHead}>
            <Icon emoji="🪙" size={14} color={C.gold} />
            <Text style={styles.howTitle}>Altın nasıl kazanılır?</Text>
          </View>
          <View style={styles.howGrid}>
            <Text style={styles.howItem}>✅ Alışkanlık +5</Text>
            <Text style={styles.howItem}>🍅 Odak +15</Text>
            <Text style={styles.howItem}>🏆 Başarım +25..250</Text>
            <Text style={styles.howItem}>🎯 Görev +20..150</Text>
          </View>
        </Card>
      ) : null}

      {/* ---------- GRID / EMPTY ---------- */}
      {visible.length > 0 ? (
        <View style={styles.grid}>{visible.map(renderProduct)}</View>
      ) : (
        <EmptyState
          name="cart"
          emoji="🛒"
          title={emptyTitle}
          subtitle={emptySub}
          actionLabel={filter === 'all' ? undefined : 'Filtreyi Temizle'}
          onAction={filter === 'all' ? undefined : () => setFilter('all')}
        />
      )}

      {/* ---------- VIP ipucu (çerçeveler) ---------- */}
      {tab === 'frames' && !vipActive ? (
        <View style={styles.vipHint}>
          <Icon emoji="👑" size={13} color={C.gold} />
          <Text style={styles.vipHintText}>
            VIP çerçeveler Season Pass'te seni bekliyor — VIP olarak hepsini
            açabilirsin!
          </Text>
        </View>
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
      paddingBottom: 24,
    },

    // ---- üst ----
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    topLabel: {
      ...type.micro,
      color: C.textMuted,
      marginBottom: 4,
    },
    balanceChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    balanceText: {
      color: C.gold,
      fontSize: 26,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    profileName: {
      ...type.bodyStrong,
      color: C.text,
      fontSize: 16,
    },
    profileHint: {
      ...type.micro,
      color: C.textMuted,
      marginTop: 3,
      lineHeight: 15,
    },
    photoActions: {
      gap: 6,
      alignItems: 'stretch',
    },

    // ---- filtre ----
    filterRow: {
      flexDirection: 'row',
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    filterChipActive: {
      backgroundColor: C.primary + '22',
      borderColor: C.primary,
    },
    filterText: {
      ...type.micro,
      color: C.textMuted,
      fontWeight: '700',
    },
    filterTextActive: {
      color: C.primary,
    },

    // ---- nasıl ----
    howCard: {
      gap: 8,
    },
    howHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    howTitle: {
      ...type.small,
      color: C.text,
      fontWeight: '700',
    },
    howGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    howItem: {
      ...type.micro,
      color: C.textMuted,
      backgroundColor: C.surfaceLight,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },

    // ---- grid ----
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    card: {
      width: '48%',
      alignItems: 'center',
      gap: 8,
      position: 'relative',
    },
    cardSelected: {
      borderColor: C.gold,
    },
    ownedBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    cardNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    cardName: {
      ...type.small,
      color: C.text,
      fontWeight: '700',
      textAlign: 'center',
    },
    cardDesc: {
      ...type.micro,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 15,
      minHeight: 44,
    },
    cardSub: {
      ...type.micro,
      color: C.textMuted,
    },
    stateChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: C.gold + '22',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      width: '100%',
      justifyContent: 'center',
    },
    stateChipText: {
      ...type.small,
      color: C.gold,
      fontWeight: '700',
    },

    // ---- tema swatch ----
    themeSwatch: {
      width: 64,
      height: 64,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    swatchBand: {
      position: 'absolute',
      top: 6,
      left: 6,
      right: 6,
      height: 14,
      borderRadius: 7,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 5,
    },
    swatchDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    swatchEmoji: {
      fontSize: 22,
      marginTop: 8,
    },
    frameAvatar: {
      width: 60,
      height: 60,
      borderRadius: 999,
      backgroundColor: C.surfaceLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    frameAvatarEmoji: {
      fontSize: 28,
    },

    // ---- vip ----
    vipHint: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: C.gold + '1A',
      borderRadius: 16,
      padding: 14,
      alignItems: 'flex-start',
    },
    vipHintText: {
      ...type.small,
      color: C.text,
      flex: 1,
      lineHeight: 18,
    },
  });
}
