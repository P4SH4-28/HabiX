// ============================================================
// ErrorState.js — Ortak hata + "Tekrar dene" durumu.
// Teknik hata kodlarını kullanıcıya göstermez; ne olduğu + kurtarma
// yolu anlatılır. EmptyState ile aynı görsel dile sahiptir.
//   <ErrorState title="..." message="..." onRetry={fn} />
// ============================================================
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './Text';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import IconTile from './IconTile';
import SoftButton from './SoftButton';

export default function ErrorState({
  title,
  message,
  retryLabel,
  onRetry,
  compact = false,
  style,
}) {
  const { colors: C } = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(C), [C]);
  const ringSize = compact ? 76 : 96;
  // Varsayılanlar bileşen içinde çözülür: dışarıdan undefined gelirse çevrilir.
  const shownTitle = title ?? t('error.defaultTitle');
  const shownMessage = message ?? t('error.defaultMessage');
  const shownRetry = retryLabel ?? t('common.retry');

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
      <Text style={[styles.title, compact && styles.titleCompact]}>{shownTitle}</Text>
      <Text style={[styles.message, compact && styles.messageCompact]}>{shownMessage}</Text>
      {onRetry ? (
        <SoftButton
          label={shownRetry}
          icon="🔄"
          variant="ghost"
          onPress={onRetry}
          style={styles.action}
          accessibilityLabel={shownRetry}
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
      lineHeight: 22,
    },
    titleCompact: {
      fontSize: 15,
      lineHeight: 22,
    },
    message: {
      color: C.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 20,
    },
    messageCompact: {
      fontSize: 13,
      lineHeight: 20,
    },
    action: {
      marginTop: 4,
    },
  });
}
