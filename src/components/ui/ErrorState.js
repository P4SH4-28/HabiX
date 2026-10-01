// ============================================================
// ErrorState.js — Ortak hata + "Tekrar dene" durumu.
// Teknik hata kodlarını kullanıcıya göstermez; ne olduğu + kurtarma
// yolu anlatılır. EmptyState ile aynı görsel dile sahiptir.
//   <ErrorState title="..." message="..." onRetry={fn} />
// ============================================================
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import IconTile from './IconTile';
import SoftButton from './SoftButton';

export default function ErrorState({
  title = 'Bağlantı sorunu',
  message = 'Bir şeyler ters gitti. Tekrar deneyebilirsin.',
  retryLabel = 'Tekrar dene',
  onRetry,
  compact = false,
  style,
}) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const ringSize = compact ? 76 : 96;

  return (
    <View
      accessibilityRole="alert"
      style={[styles.wrap, compact && styles.wrapCompact, style]}
    >
      <View
        style={[
          styles.ring,
          { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
        ]}
      >
        <IconTile name="cloud-offline-outline" variant="danger" size={compact ? 38 : 46} />
      </View>
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      <Text style={[styles.message, compact && styles.messageCompact]}>{message}</Text>
      {onRetry ? (
        <SoftButton
          label={retryLabel}
          icon="🔄"
          variant="ghost"
          onPress={onRetry}
          style={styles.action}
          accessibilityLabel={retryLabel}
        />
      ) : null}
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    wrap: {
      alignItems: 'center',
      paddingVertical: 30,
      paddingHorizontal: 24,
      gap: 12,
    },
    wrapCompact: {
      paddingVertical: 18,
      gap: 9,
    },
    ring: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    title: {
      color: C.text,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
    },
    titleCompact: {
      fontSize: 15,
    },
    message: {
      color: C.textMuted,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
    },
    messageCompact: {
      fontSize: 13,
    },
    action: {
      marginTop: 4,
    },
  });
}
