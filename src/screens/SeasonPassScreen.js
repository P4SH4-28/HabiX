// ============================================================
// SeasonPassScreen — Battle Pass (v3 design system, sıfırdan)
//
// YAPI:
//   1) Sezon başlığı    → PASS_NAME + "süresiz" + bitirmeye kalan XP
//   2) Büyük tier barı  → seviye / PASS_MAX_LEVEL (tier ilerlemesi)
//   3) VIP kartı        → aktifse durum kartı, değilse 5.000 🪙 satın alma
//   4) Sütun başlıkları → FREE · VIP
//   5) Tier listesi     → her seviyede 2 kutu (Free/VIP):
//                          kilitli (seviye/VIP) · alınabilir (Al) · alındı
//
// DataContext API (değişmedi): claimPassReward(level, track) → {ok, error}
//   (başarı toast'ı DataContext verir) · buyVip() async → {ok, error}
//   (başarı toast'ı DataContext verir) · vipActive · pushToast
//
// DÜZELTME: eski ekran passLevelFromXp().curXp alanı yokken onu kullanıyordu
//   (undefined → NaN ilerleme). Doğrusu: curXp = totalXp - cumXp.
//
// KURALLAR: glow/gradient/blur/loop YOK → LottieView KULLANILMAZ
//   (animasyonlu çerçeve ödülleri statik ✨ gösterilir) · animasyon ≤300ms ·
//   4 vurgu rengi (primary/altın/success/danger) · 5 tipografi ölçeği.
// SAFE AREA: üst başlık Stack header, alt inset burada.
// ============================================================
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../context/DataContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Icon from '../components/ui/icons';
import Pill from '../components/ui/Pill';
import Progress from '../components/ui/Progress';
import SectionHeader from '../components/ui/SectionHeader';
import {
  BADGES,
  PASS_LEVELS,
  PASS_MAX_LEVEL,
  PASS_NAME,
  passLevelFromXp,
  passRewardClaimed,
  rewardLabel,
} from '../data/seasonPass';
import { VIP_PRICE_GOLD } from '../data/quests';
import { getFrame } from '../data/shop';
import { serverNow } from '../services/serverClock';
import { useTheme } from '../theme';

// seasonPass.js: 1-10. seviyeler 100, ... 41-50 → 500 XP (toplam 14.500).
const SEASON_TOTAL_XP = 14500;

// buyVip hata kodları → Türkçe mesaj (sunucu cümlesi ise olduğu gibi göster).
const VIP_ERR = {
  banned: 'Hesabın kısıtlı — VIP satın alınamadı',
  insufficient_balance: 'Yetersiz altın',
  not_enough_gold: 'Yetersiz altın',
};

// Ödül tipinin önizleme ikonu (lottieFrame dahil — statik, loop YOK).
function rewardEmoji(reward) {
  if (!reward) return '?';
  switch (reward.type) {
    case 'gold':
      return '🪙';
    case 'badge':
      return BADGES[reward.badgeId]?.emoji || '🎖';
    case 'theme':
      return '🎨';
    case 'avatar':
      return '🖼';
    case 'frame':
    case 'lottieFrame':
      return (reward.type === 'frame' && getFrame(reward.frameId)?.emoji) || '✨';
    default:
      return '🎁';
  }
}

// Ödül kutusunun kısa metni (altında tekrarlanan ikonu temizlemek için).
function rewardText(reward) {
  if (!reward) return '—';
  if (reward.type === 'gold') return String(reward.amount);
  return rewardLabel(reward);
}

export default function SeasonPassScreen() {
  const { colors: C, type } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C, type), [C, type]);
  const { data, claimPassReward, buyVip, vipActive, pushToast } = useData();

  const [buying, setBuying] = useState(false);

  const totalXp = data.stats.totalXp || 0;
  const pass = passLevelFromXp(totalXp);
  const curXp = totalXp - pass.cumXp;
  const claims = data.passClaims || {};
  const gold = data.stats.gold || 0;
  const vipDaysLeft = Math.max(
    0,
    Math.ceil(((data.settings.vipUntil || 0) - serverNow()) / 86400000)
  );
  const seasonXpLeft = Math.max(0, SEASON_TOTAL_XP - totalXp);

  // ---------- eylemler ----------
  const handleBuyVip = async () => {
    if (buying) return;
    setBuying(true);
    try {
      const r = await buyVip();
      if (r && r.ok === false) {
        const raw = r.error;
        const title =
          VIP_ERR[raw] || (typeof raw === 'string' && raw.includes(' ') ? raw : 'Satın alınamadı');
        pushToast({ icon: '⚠️', title, color: C.danger });
      }
    } finally {
      setBuying(false);
    }
  };

  const handleClaim = (level, track) => {
    const r = claimPassReward(level, track);
    if (r && r.ok === false) {
      pushToast({ icon: '⚠️', title: r.error || 'Ödül alınamadı', color: C.danger });
    }
  };

  // ---------- ödül kutusu (Free/VIP ortak) ----------
  const renderBox = (level, track) => {
    const lvl = PASS_LEVELS.find((l) => l.level === level);
    const reward = lvl ? (track === 'vip' ? lvl.vip : lvl.free) : null;
    if (!reward) return <View key={`${level}_${track}`} style={[styles.box, styles.boxEmpty]} />;
    const isVip = track === 'vip';
    const claimed = passRewardClaimed(claims, level, track);
    const reachable = pass.level >= level;
    const vipLocked = isVip && !vipActive;
    const accent = isVip ? C.gold : C.primary;
    return (
      <View
        key={`${level}_${track}`}
        style={[
          styles.box,
          isVip ? styles.boxVip : styles.boxFree,
          claimed && styles.boxClaimed,
        ]}
      >
        <Icon emoji={rewardEmoji(reward)} size={22} color={claimed ? C.textMuted : accent} />
        <Text style={styles.boxReward} numberOfLines={2}>
          {rewardText(reward)}
        </Text>
        {claimed ? (
          <Pill size="sm" icon="✓" bg={C.success + '1A'} color={C.success}>
            Alındı
          </Pill>
        ) : !reachable ? (
          <Pill size="sm" icon="🔒">
            Seviye {level}
          </Pill>
        ) : vipLocked ? (
          <Pill size="sm" icon="👑" bg={C.gold + '1A'} color={C.gold}>
            VIP gerekli
          </Pill>
        ) : (
          <Button
            label="Al"
            size="sm"
            variant={isVip ? 'primary' : 'secondary'}
            fullWidth
            onPress={() => handleClaim(level, track)}
            accessibilityLabel={`${level}. seviye ${isVip ? 'VIP' : 'Free'} ödülünü al`}
          />
        )}
      </View>
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
    >
      {/* ---------- 1) SEZON BAŞLIĞI + 2) TIER BARI ---------- */}
      <Card style={styles.seasonCard}>
        <View style={styles.seasonHead}>
          <View style={styles.seasonTitleWrap}>
            <Text style={styles.seasonName}>{PASS_NAME}</Text>
            <Text style={styles.seasonSub}>
              Sezonu bitirmeye kalan: {seasonXpLeft} XP
            </Text>
          </View>
          <Pill size="sm" icon="⏳">
            Süresiz
          </Pill>
        </View>

        <View style={styles.tierRow}>
          <View style={styles.levelCircle}>
            <Text style={styles.levelText}>{pass.level}</Text>
          </View>
          <View style={styles.tierInfo}>
            <Progress
              value={pass.level >= PASS_MAX_LEVEL ? 1 : pass.level / PASS_MAX_LEVEL}
              height={14}
              colors={[C.primary]}
              accessibilityLabel={`Tier ilerlemesi seviye ${pass.level} / ${PASS_MAX_LEVEL}`}
            />
            <View style={styles.tierLabels}>
              <Text style={styles.tierLabelStrong}>
                TIER {pass.level}/{PASS_MAX_LEVEL}
              </Text>
              <Text style={styles.tierLabel}>
                {pass.level >= PASS_MAX_LEVEL
                  ? 'Sezon tamamlandı!'
                  : `Sonraki seviye: ${pass.nextThreshold - curXp} XP`}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* ---------- 3) VIP DURUM / SATIN ALMA ---------- */}
      {vipActive ? (
        <Card style={styles.vipActiveCard}>
          <Icon emoji="👑" size={26} color={C.gold} />
          <View style={styles.vipInfo}>
            <Text style={styles.vipActiveTitle}>VIP aktif</Text>
            <Text style={styles.vipText}>
              {vipDaysLeft} gün kaldı — VIP ödül kutuları, +4 görev ve ×1.5 çarpan açık.
            </Text>
          </View>
        </Card>
      ) : (
        <Card style={styles.vipBuyCard}>
          <View style={styles.vipHead}>
            <Icon emoji="👑" size={26} color={C.gold} />
            <View style={styles.vipInfo}>
              <Text style={styles.vipBuyTitle}>VIP üyeliği al</Text>
              <Text style={styles.vipText}>
                30 gün: +4 ekstra günlük görev, ×1.5 ödül çarpanı, Season Pass VIP
                kutuları.
              </Text>
            </View>
          </View>
          <View style={styles.vipBuyFoot}>
            <View style={styles.priceRow}>
              <Icon emoji="🪙" size={15} color={C.gold} />
              <Text style={styles.priceText}>{VIP_PRICE_GOLD}</Text>
            </View>
            <Button
              label="Satın Al"
              size="md"
              variant="primary"
              loading={buying}
              onPress={handleBuyVip}
            />
          </View>
          {gold < VIP_PRICE_GOLD ? (
            <View style={styles.warnRow}>
              <Icon emoji="⚠" size={12} color={C.danger} />
              <Text style={styles.warnText}>
                {VIP_PRICE_GOLD - gold} altın daha lazım (bakiyen: {gold})
              </Text>
            </View>
          ) : null}
        </Card>
      )}

      {/* ---------- 4) SÜTUN BAŞLIKLARI + 5) TIER LİSTESİ ---------- */}
      <SectionHeader title="Sezon Ödülleri" />
      <View style={styles.colHead}>
        <View style={styles.colNumSpacer} />
        <Text style={[styles.colLabel, { color: C.primary }]}>FREE</Text>
        <Text style={[styles.colLabel, styles.colLabelVip]}>VIP</Text>
      </View>

      <View style={styles.tierList}>
        {PASS_LEVELS.map((lvl) => {
          const isCurrent = pass.level === lvl.level;
          const reached = pass.level >= lvl.level;
          return (
            <View key={lvl.level} style={styles.tierItem}>
              <View style={styles.tierNumCol}>
                <Text
                  style={[
                    styles.tierNum,
                    { color: reached ? C.text : C.textMuted },
                    isCurrent && styles.tierNumCurrent,
                  ]}
                >
                  {lvl.level}
                </Text>
                {isCurrent ? <View style={styles.currentDot} /> : null}
              </View>
              <View style={styles.boxes}>
                {renderBox(lvl.level, 'free')}
                {renderBox(lvl.level, 'vip')}
              </View>
            </View>
          );
        })}
      </View>

      <Text style={styles.note}>
        Pass seviyen toplam XP'nle otomatik yükselir. Kutular seviyeye ulaşınca
        açılır; VIP kutuları yalnızca aktif VIP üyelere verilir.
      </Text>
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

    // ---- sezon başlığı + tier ----
    seasonCard: {
      gap: 16,
    },
    seasonHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    seasonTitleWrap: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    seasonName: {
      ...type.h3,
      color: C.text,
    },
    seasonSub: {
      ...type.small,
      color: C.textMuted,
      fontVariant: ['tabular-nums'],
    },
    tierRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    levelCircle: {
      width: 56,
      height: 56,
      borderRadius: 999,
      backgroundColor: C.primary + '1A',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.primary,
    },
    levelText: {
      ...type.stat,
      color: C.primary,
    },
    tierInfo: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    tierLabels: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    tierLabelStrong: {
      ...type.micro,
      color: C.text,
    },
    tierLabel: {
      ...type.micro,
      color: C.textMuted,
      fontVariant: ['tabular-nums'],
    },

    // ---- VIP ----
    vipActiveCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.gold + '0D',
      borderColor: C.gold + '33',
      borderWidth: 1,
    },
    vipBuyCard: {
      gap: 12,
      backgroundColor: C.gold + '0D',
      borderColor: C.gold + '33',
      borderWidth: 1,
    },
    vipHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    vipInfo: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    vipActiveTitle: {
      ...type.h3,
      color: C.gold,
    },
    vipBuyTitle: {
      ...type.h3,
      color: C.text,
    },
    vipText: {
      ...type.small,
      color: C.textMuted,
    },
    vipBuyFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    priceText: {
      ...type.h3,
      color: C.gold,
      fontVariant: ['tabular-nums'],
    },
    warnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    warnText: {
      ...type.micro,
      color: C.danger,
    },

    // ---- sütun başlıkları ----
    colHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    colNumSpacer: {
      width: 34,
    },
    colLabel: {
      ...type.micro,
      flex: 1,
      textAlign: 'center',
    },
    colLabelVip: {
      color: C.gold,
    },

    // ---- tier listesi ----
    tierList: {
      gap: 8,
    },
    tierItem: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10,
    },
    tierNumCol: {
      width: 34,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    tierNum: {
      ...type.bodyStrong,
      fontVariant: ['tabular-nums'],
    },
    tierNumCurrent: {
      color: C.primary,
    },
    currentDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: C.primary,
    },
    boxes: {
      flex: 1,
      flexDirection: 'row',
      gap: 8,
    },
    box: {
      flex: 1,
      minHeight: 104,
      borderRadius: 16,
      borderWidth: 1,
      padding: 10,
      gap: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boxFree: {
      backgroundColor: C.surface,
      borderColor: C.border,
    },
    boxVip: {
      backgroundColor: C.gold + '0D',
      borderColor: C.gold + '33',
    },
    boxEmpty: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
    },
    boxClaimed: {
      opacity: 0.6,
    },
    boxReward: {
      ...type.micro,
      color: C.text,
      textAlign: 'center',
      textTransform: 'none',
      letterSpacing: 0,
      fontWeight: '600',
    },

    note: {
      ...type.small,
      color: C.textMuted,
    },
  });
}
