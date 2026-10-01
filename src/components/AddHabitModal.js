import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import ColorPicker from './ColorPicker';
import EmojiPicker from './EmojiPicker';
import GradientButton from './GradientButton';
import Icon from './ui/icons';
import AppTextField from './ui/AppTextField';
import Sheet from './Sheet';

const NAME_MAX = 30;

export default function AddHabitModal({ visible, onClose, onAdd, habitsCount = 0, maxHabits = 10 }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💧');
  const [color, setColor] = useState(C.primary);
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
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Yeni Alışkanlık">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: 14 }}>
        {/* Canlı önizleme: isim + sembol + renk anında burada görünür */}
        <View style={[styles.preview, { backgroundColor: color + '22', borderWidth: 1, borderColor: color + '66' }]}>
          <View style={[styles.previewCircle, { backgroundColor: color, shadowColor: color }]}>
            <Text style={styles.previewEmoji}>{emoji}</Text>
          </View>
          <Text style={[styles.previewName, !trimmed && styles.previewNameEmpty]} numberOfLines={1}>
            {trimmed || 'Alışkanlık adı'}
          </Text>
          <Text style={styles.previewHint}>
            {trimmed ? 'Harika görünüyor!' : 'Yukarıdan bir ad yaz'}
          </Text>
        </View>

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
          hint={`${trimmed.length}/${NAME_MAX} karakter · Uzun basınca düzenleme/­silme`}
          accessibilityLabel="Alışkanlık adı"
        />
        <EmojiPicker value={emoji} onChange={setEmoji} />
        <ColorPicker value={color} onChange={setColor} />
        {limitReached && (
          <View style={styles.limitBox} accessibilityRole="alert">
            <View style={styles.limitRow}>
              <Icon emoji="⛔" size={15} color={C.danger} />
              <Text style={styles.limitText}>
                En fazla {maxHabits} alışkanlık oluşturabilirsin. Yeni eklemek için mevcut
                birini sil.
              </Text>
            </View>
          </View>
        )}
        <GradientButton
          icon="✨"
          label={
            limitReached
              ? `Limit doldu (${habitsCount}/${maxHabits})`
              : 'Alışkanlığı Ekle'
          }
          colors={[color, color]}
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
    preview: {
      alignItems: 'center',
      gap: 6,
      borderRadius: 16,
      borderStyle: 'dashed',
      padding: 16,
    },
    previewCircle: {
      width: 64,
      height: 64,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      shadowOpacity: 0.4,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    previewEmoji: {
      fontSize: 30,
    },
    previewName: {
      color: C.text,
      fontSize: 17,
      fontWeight: '700',
    },
    previewNameEmpty: {
      color: C.textMuted,
    },
    previewHint: {
      color: C.textMuted,
      fontSize: 13,
    },
    button: {
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
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
      color: C.danger,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '600',
    },
  });
}
