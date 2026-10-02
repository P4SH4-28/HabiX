// ============================================================
// InventoryScreen — "Envanter" ekranı (v3 design system, sıfırdan)
//
// YAPI:
//   1) Üst     → altın bakiyesi
//   2) Aktif   → şu an çalışan eşya etkileri (streak_freeze /
//      penalty_shield / xp_boost) — yoksa bilgi satırı
//   3) Eşyalar → icon + isim + adet + "Kullan" butonu;
//      adedi olmayan / etkisi aktif olanlar gri (disabled)
//   4) Empty   → hiç eşyan yoksa "Henüz eşyan yok" + Dükkan aksiyonu
//
// DataContext API (değişmedi): data, useItem, today, pushToast.
// Veri: ITEMS, XP_BOOST_USES (data/items).
//
// SAFE AREA: STACK ekranı — AppHeader 'Envanter', alt inset content'te.
// KURALLAR: glow/gradient/blur/loop YOK · h1 yok · danger yalnız
//   onay kutuları (eşya kullanımı geri alınamaz → onaylı).
// ============================================================
import { useMemo } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useData } from '../context/DataContext';
import { ITEMS, XP_BOOST_USES } from '../data/items';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Icon from '../components/ui/icons';
import IconTile from '../components/ui/IconTile';
import SectionHeader from '../components/ui/SectionHeader';
import { RADIUS, useTheme } from '../theme';

// Onay kutusu: mobilde Alert, web'de confirm.
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

export default function InventoryScreen() {
  const { colors: C, type } = useTheme();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { data, useItem, today, pushToast } = useData();

  const gold = data.stats.gold || 0;
  const inv = data.inventory || {};
  const fx = data.activeEffects || { streakFreeze: null, penaltyShield: null, xpBoost: { usesLeft: 0 } };

  // Aktif etki durum metni (kartlarda gösterilir).
  const effectText = (id) => {
    if (id === 'streak_freeze') {
      return fx.streakFreeze === today ? 'Aktif — bugün serilerin korunuyor' : null;
    }
    if (id === 'penalty_shield') {
      return fx.penaltyShield === today ? 'Aktif — bu gece ceza kesilmeyecek' : null;
    }
    if (id === 'xp_boost') {
      const left = fx.xpBoost?.usesLeft || 0;
      return left > 0 ? `Aktif — ${left} tamamlamada 2x XP` : null;
    }
    return null;
  };

  const activeList = ITEMS.map((i) => ({ item: i, text: effectText(i.id) })).filter((e) => e.text);
  const totalOwned = ITEMS.reduce((s, i) => s + (inv[i.id] || 0), 0);

  const handleUse = (item) => {
    if (effectText(item.id)) return; // etki zaten aktif
    confirmDialog(item.name, `${item.desc}\n\nKullanmak istediğine emin misin?`, 'Kullan', () => {
      const r = useItem(item.id);
      if (r && r.ok === false) {
        pushToast({ icon: '⚠️', title: r.error || 'Bu eşya şu an kullanılamıyor', color: C.danger });
      }
    });
  };

  const contentStyle = [
    styles.content,
    { paddingBottom: Math.max(24, insets.bottom + 24) },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
    >
      {/* ---------- ÜST: bakiye ---------- */}
      <View style={styles.topRow}>
        <Text style={styles.topLabel}>ALTIN BAKİYESİ</Text>
        <View style={styles.balanceChip}>
          <Icon emoji="🪙" size={16} color={C.gold} />
          <Text style={styles.balanceText}>{gold}</Text>
        </View>
      </View>

      {/* ---------- AKTİF ETKİLER ---------- */}
      <SectionHeader title="Aktif Etkiler" />
      <Card style={styles.activeCard}>
        {activeList.length > 0 ? (
          activeList.map(({ item, text }) => (
            <View key={item.id} style={styles.activeRow}>
              <IconTile emoji={item.emoji} size={30} iconSize={15} variant="glass" />
              <View style={{ flex: 1 }}>
                <Text style={styles.activeName}>{item.name}</Text>
                <Text style={styles.activeText}>{text}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.activeEmpty}>
            Aktif eşya etkisi yok — bir eşyayı kullanarak başla.
          </Text>
        )}
      </Card>

      {/* ---------- EŞYALAR ---------- */}
      <SectionHeader title="Eşyalar" />
      {totalOwned > 0 ? (
        <View style={styles.list}>
          {ITEMS.map((item) => {
            const count = inv[item.id] || 0;
            const active = effectText(item.id);
            const canUse = count > 0 && !active;
            return (
              <Card key={item.id} padding="sm" style={[styles.itemRow, !canUse && styles.itemRowOff]}>
                <IconTile emoji={item.emoji} size={40} iconSize={18} variant="glass" />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemCount}>
                    {count} adet
                    {item.id === 'xp_boost' ? ` · her kullanım ${XP_BOOST_USES} hak` : ''}
                  </Text>
                  <Text style={styles.itemDesc} numberOfLines={2}>
                    {item.desc}
                  </Text>
                </View>
                {active ? (
                  <View style={styles.activeChip}>
                    <Text style={styles.activeChipText}>Aktif</Text>
                  </View>
                ) : (
                  <Button
                    label={count > 0 ? 'Kullan' : 'Yok'}
                    size="sm"
                    variant={count > 0 ? 'primary' : 'secondary'}
                    disabled={!canUse}
                    onPress={() => handleUse(item)}
                  />
                )}
              </Card>
            );
          })}
        </View>
      ) : (
        <EmptyState
          name="cube"
          emoji="🎒"
          title="Henüz eşyan yok"
          subtitle="Dükkan'dan altınla eşya alabilirsin: Seri Dondurucu, Ceza Kalkanı ve XP Enerjisi seni bekliyor."
          actionLabel="Dükkan'dan Al"
          onAction={() => navigation.navigate('Main', { screen: 'Shop' })}
        />
      )}

      <View style={styles.noteBox}>
        <Icon emoji="💡" size={13} color={C.primary} style={{ marginTop: 2 }} />
        <Text style={styles.noteText}>
          Eşyalar Dükkan'dan altınla satın alınır. Etkiler sunucu gününe
          bağlıdır ve gün değişince yenilenir; XP Enerjisi hakkı bitene kadar
          bekler. Cezadan korunmak için Kalkan'ı gün içinde kullanmayı unutma!
        </Text>
      </View>
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
      gap: 10,
    },

    // ---- üst ----
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    topLabel: {
      ...type.micro,
      color: C.textMuted,
    },
    balanceChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    balanceText: {
      color: C.gold,
      fontSize: 22,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },

    // ---- aktif ----
    activeCard: {
      gap: 10,
      marginBottom: 8,
    },
    activeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    activeName: {
      ...type.small,
      color: C.text,
      fontWeight: '700',
    },
    activeText: {
      ...type.micro,
      color: C.success,
      marginTop: 2,
    },
    activeEmpty: {
      ...type.small,
      color: C.textMuted,
      lineHeight: 18,
    },

    // ---- liste ----
    list: {
      gap: 8,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    itemRowOff: {
      opacity: 0.55,
    },
    itemInfo: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    itemName: {
      ...type.bodyStrong,
      color: C.text,
      fontSize: 14,
    },
    itemCount: {
      ...type.micro,
      color: C.gold,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    itemDesc: {
      ...type.micro,
      color: C.textMuted,
      lineHeight: 15,
    },
    activeChip: {
      backgroundColor: C.primary + '22',
      borderRadius: RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    activeChipText: {
      ...type.small,
      color: C.primary,
      fontWeight: '700',
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
      marginTop: 8,
      alignItems: 'flex-start',
    },
    noteText: {
      ...type.small,
      color: C.textMuted,
      flex: 1,
      lineHeight: 18,
    },
  });
}
