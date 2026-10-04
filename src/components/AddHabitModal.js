// ============================================================
// AddHabitModal — "Yeni Alışkanlık" alt sheet'i (minimal düzen).
//
// SIRA: isim input → Sembol (tek satır + açılır grid) →
//       Renk (tek satır + açılır grid) → limit uyarısı →
//       canlı önizleme kartı → ekle butonu.
//
// SIKIŞIKLIK: 30+ sembol ve 10 renk artık TEK SATIRDA yatay scroll
//   olarak durur; başlığın yanındaki ve satır sonundaki ok'a basınca
//   tam grid 260ms'de açılır (tekrar basınca kapanır). Böylece sheet
//   baştan sona ~2 ekran yüksekliğinde kalır, özellik kaybı YOK.
//
// ANİMASYON: Reanimated height (measure → withTiming, ease-out 260ms);
//   unmount'ta cancelAnimation. LOOP YOK · GLOW YOK · GRADIENT YOK.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Text from './ui/Text';
import { EMOJIS, HABIT_COLORS, EASE, useTheme } from '../theme';
import Button from './ui/Button';
import Icon from './ui/icons';
import AppTextField from './ui/AppTextField';
import Sheet from './Sheet';

const NAME_MAX = 30;
// Kural: animasyon ≤300ms.
const EXPAND_MS = 260;

// ------------------------------------------------------------
// Collapsible — "başlık + tek satır önizleme + açılır panel".
// `strip`: yatay scroll'da görünen hızlı seçim satırı.
// `children`: expand edilen tam grid (her iki pickarda da wrap grid).
// ------------------------------------------------------------
function Collapsible({ title, open, onToggle, strip, children }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  // Grid yüksekliği ölçülür; animasyon 0 ↔ ölçüm değeri arasında oynar.
  const [contentH, setContentH] = useState(0);
  const h = useSharedValue(0);

  useEffect(() => {
    h.value = withTiming(open ? contentH : 0, {
      duration: EXPAND_MS,
      easing: Easing.bezier(...EASE.out),
    });
    // Prensip: animasyon başlatan bileşen unmount olurken iptal etmeli.
    return () => cancelAnimation(h);
  }, [open, contentH, h]);

  const panelStyle = useAnimatedStyle(() => ({ height: h.value }));

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="label" style={styles.headLabel}>{title}</Text>
        <Pressable
          onPress={onToggle}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${title} seçeneklerini ${open ? 'gizle' : 'aç'}`}
          accessibilityState={{ expanded: open }}
          style={({ pressed }) => [styles.headToggle, pressed && styles.pressed]}
        >
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.textMuted} />
        </Pressable>
      </View>

      {/* Tek satır önizleme: tüm öğeler yatay scroll ile, sonda aç/kapa oku */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.strip}
      >
        {strip}
        <Pressable
          onPress={onToggle}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${title} seçeneklerini ${open ? 'gizle' : 'aç'}`}
          accessibilityState={{ expanded: open }}
          style={({ pressed }) => [styles.stripToggle, open && styles.stripToggleOpen, pressed && styles.pressed]}
        >
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={open ? C.primary : C.textMuted} />
        </Pressable>
      </ScrollView>

      {/* Açılır grid: ölçüm View'ı her zaman mount (height:0 iken clip'lenir). */}
      <Animated.View style={[styles.panel, panelStyle]} pointerEvents={open ? 'auto' : 'none'}>
        <View
          collapsable={false}
          onLayout={(e) => setContentH(e.nativeEvent.layout.height)}
          style={styles.grid}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

export default function AddHabitModal({ visible, onClose, onAdd, habitsCount = 0, maxHabits = 10 }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💧');
  const [color, setColor] = useState(C.primary);
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  // Anti-farm (Katman 1): sınırsız alışkanlık farm'ına karşı limit.
  const limitReached = habitsCount >= maxHabits;
  const trimmed = name.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 2;

  const submit = () => {
    if (limitReached || tooShort || !trimmed) return;
    onAdd(trimmed, emoji, color);
    setName('');
    setEmoji('💧');
    setColor(C.primary);
    setSymbolsOpen(false);
    setColorsOpen(false);
    onClose();
  };

  const symbolStrip = EMOJIS.map((e) => (
    <Pressable
      key={e}
      style={[styles.chip, emoji === e && styles.chipSelected]}
      onPress={() => setEmoji(e)}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={`Sembol ${e}`}
      accessibilityState={{ selected: emoji === e }}
    >
      <Text style={styles.emoji}>{e}</Text>
    </Pressable>
  ));

  const colorStrip = HABIT_COLORS.map((c) => (
    <Pressable
      key={c}
      style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
      onPress={() => setColor(c)}
      hitSlop={5}
      accessibilityRole="button"
      accessibilityLabel={`Renk ${c}`}
      accessibilityState={{ selected: color === c }}
    >
      {color === c && <Text style={styles.check}>✓</Text>}
    </Pressable>
  ));

  return (
    <Sheet visible={visible} onClose={onClose} title="Yeni Alışkanlık">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.form}
      >
        {/* 1) ÜST: isim */}
        <AppTextField
          icon="create-outline"
          placeholder="Alışkanlık adı..."
          value={name}
          onChangeText={(t) => setName(t.slice(0, NAME_MAX))}
          onSubmitEditing={submit}
          returnKeyType="done"
          autoFocus
          maxLength={NAME_MAX}
          error={tooShort ? 'En az 2 karakter olmalı.' : undefined}
          hint={`${trimmed.length}/${NAME_MAX} karakter · En az 2 karakter olmalı`}
          accessibilityLabel="Alışkanlık adı"
        />

        {/* 2) SEMBOL: tek satır + ok → tam grid */}
        <Collapsible
          title="Sembol"
          open={symbolsOpen}
          onToggle={() => setSymbolsOpen((v) => !v)}
          strip={symbolStrip}
        >
          {EMOJIS.map((e) => (
            <Pressable
              key={e}
              style={[styles.chip, emoji === e && styles.chipSelected]}
              onPress={() => setEmoji(e)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Sembol ${e}`}
              accessibilityState={{ selected: emoji === e }}
            >
              <Text style={styles.emoji}>{e}</Text>
            </Pressable>
          ))}
        </Collapsible>

        {/* 3) RENK: tek satır + ok → tam grid */}
        <Collapsible
          title="Renk"
          open={colorsOpen}
          onToggle={() => setColorsOpen((v) => !v)}
          strip={colorStrip}
        >
          {HABIT_COLORS.map((c) => (
            <Pressable
              key={c}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
              onPress={() => setColor(c)}
              hitSlop={5}
              accessibilityRole="button"
              accessibilityLabel={`Renk ${c}`}
              accessibilityState={{ selected: color === c }}
            >
              {color === c && <Text style={styles.check}>✓</Text>}
            </Pressable>
          ))}
        </Collapsible>

        {limitReached && (
          <View style={styles.limitBox} accessibilityRole="alert">
            <View style={styles.limitRow}>
              <Icon emoji="⛔" size={15} color={C.danger} />
              <Text variant="small" style={styles.limitText}>
                En fazla {maxHabits} alışkanlık oluşturabilirsin. Yeni eklemek için mevcut
                birini sil.
              </Text>
            </View>
          </View>
        )}

        {/* 4) ALT: canlı önizleme */}
        <View style={[styles.preview, { backgroundColor: color + '22', borderWidth: 1, borderColor: color + '66' }]}>
          <View style={[styles.previewCircle, { backgroundColor: color, shadowColor: color }]}>
            <Text style={styles.previewEmoji}>{emoji}</Text>
          </View>
          <View style={styles.previewTexts}>
            <Text variant="h3" style={[styles.previewName, !trimmed && styles.previewNameEmpty]} numberOfLines={1}>
              {trimmed || 'Alışkanlık adı'}
            </Text>
            <Text variant="small" style={styles.previewHint}>
              {trimmed ? 'Harika görünüyor!' : 'Yukarıdan bir ad yaz'}
            </Text>
          </View>
        </View>

        {/* 5) EN ALT: ekle */}
        <Button
          icon="✨"
          label={
            limitReached
              ? `Limit doldu (${habitsCount}/${maxHabits})`
              : 'Alışkanlığı Ekle'
          }
          colors={[color, color]}
          fullWidth
          onPress={submit}
          disabled={!trimmed || tooShort || limitReached}
          style={styles.button}
        />
      </KeyboardAvoidingView>
    </Sheet>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    form: {
      gap: 16,
    },
    wrap: {
      gap: 8,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headLabel: {
      color: C.textMuted,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      lineHeight: 16,
    },
    headToggle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.surfaceLight,
    },
    // Tek satır önizleme: yatay scroll.
    strip: {
      gap: 8,
      paddingRight: 8,
      alignItems: 'center',
    },
    stripToggle: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.surfaceLight,
      borderWidth: 1,
      borderColor: C.border,
    },
    stripToggleOpen: {
      borderColor: C.primary,
      backgroundColor: C.primary + '1A',
    },
    pressed: {
      opacity: 0.7,
    },
    // Açılır panel: clip (height animasyonu) + meetrik.
    panel: {
      overflow: 'hidden',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingTop: 4,
    },
    chip: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: C.surfaceLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: {
      borderWidth: 1,
      borderColor: C.primary,
      backgroundColor: C.primary + '26',
      transform: [{ scale: 1.08 }],
    },
    emoji: {
      fontSize: 22,
      lineHeight: 30,
    },
    swatch: {
      width: 38,
      height: 38,
      borderRadius: 20,
      borderWidth: 3,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchSelected: {
      borderColor: '#FFFFFF',
      transform: [{ scale: 1.12 }],
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    check: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowRadius: 2,
      lineHeight: 22,
    },
    preview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      borderStyle: 'dashed',
      padding: 16,
    },
    previewCircle: {
      width: 56,
      height: 56,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      shadowOpacity: 0.4,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    previewEmoji: {
      fontSize: 22,
      lineHeight: 30,
    },
    previewTexts: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    previewName: {
      color: C.text,
    },
    previewNameEmpty: {
      color: C.textMuted,
    },
    previewHint: {
      color: C.textMuted,
    },
    button: {
      marginTop: 4,
    },
    limitBox: {
      backgroundColor: C.danger + '1A',
      borderRadius: 12,
      padding: 12,
    },
    limitRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    limitText: {
      flex: 1,
      minWidth: 0,
      color: C.danger,
      fontWeight: '600',
    },
  });
}
