// ============================================================
// ErrorBoundary.js — Render hatalarını yakalayan hata sınırı
// Yakalanmayan bir JS hatası (ör. bir ekranın render'ı sırasında)
// uygulamayı sessizce kapatır. Bu bileşen Root ağacını sarar ve
// böyle bir hata oluşursa çökmek yerine hatayı TAM METİNLE ekranda
// gösterir ("Yeniden Dene" ile uygulama sıfırlanır).
// FatalErrorView: hem ErrorBoundary hem de errorReporter'ın global
// handler'ı tarafından kullanılan ortak hata ekranıdır.
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Component } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Text from './ui/Text';
import { useT } from '../i18n';
import { useTheme } from '../theme';

const LAST_ERROR_KEY = '@habit_tracker_last_error';

// Hata nesnesini (Error veya errorReporter kaydı) görüntülenebilir forma çevirir.
// unknownLabel: yalnızca görüntüleme sırasında çevrilir (kayıtta tr saklanır).
function toViewError(error, unknownLabel = 'Bilinmeyen hata') {
  if (error && typeof error === 'object') {
    return {
      message:
        typeof error.message === 'string' && error.message ? error.message : unknownLabel,
      stack: typeof error.stack === 'string' ? error.stack : '',
      source: typeof error.source === 'string' ? error.source : 'render',
    };
  }
  return { message: String(error || unknownLabel), stack: '', source: 'render' };
}

// Tam ekran hata görünümü: hata mesajı + stack + yeniden dene.
export function FatalErrorView({ error, onRetry }) {
  const { colors: C } = useTheme();
  const t = useT();
  const info = toViewError(error, t('error.unknown'));
  return (
    <View style={[styles.overlay, { backgroundColor: C.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.emoji}>⚠️</Text>
        <Text style={[styles.title, { color: C.text }]}>{t('error.fatalTitle')}</Text>
        <Text style={[styles.subtitle, { color: C.textMuted }]}>{t('error.fatalSubtitle')}</Text>
        <View style={[styles.msgBox, { backgroundColor: C.surface, borderWidth: 1, borderColor: C.danger }]}>
          <Text style={[styles.source, { color: C.danger }]}>
            {t('error.source', { source: info.source || t('error.unknownSource') })}
          </Text>
          <Text selectable style={[styles.message, { color: C.text }]}>
            {info.message}
          </Text>
        </View>
        {info.stack ? (
          <View style={[styles.stackBox, { backgroundColor: C.surfaceLight}]}>
            <Text selectable style={[styles.stack, { color: C.textMuted }]}>
              {info.stack}
            </Text>
          </View>
        ) : null}
        <Text selectable style={[styles.copyHint, { color: C.textMuted }]}>
          {`📋 ${t('error.copyHint', { message: info.message })}`}
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        <Text
          style={[styles.retryBtn, { backgroundColor: C.primary, color: C.onPrimary }]}
          onPress={onRetry}
        >
          {t('error.retry')}
        </Text>
      </View>
    </View>
  );
}

class ErrorBoundaryClass extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Render hataları global ErrorUtils'e ulaşmaz; kaydı buraya yazarız.
    const record = {
      ...toViewError(error),
      componentStack: info && info.componentStack ? String(info.componentStack) : '',
      ts: Date.now(),
    };
    AsyncStorage.setItem(LAST_ERROR_KEY, JSON.stringify(record)).catch(() => {});
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <FatalErrorView error={this.state.error} onRetry={this.retry} />;
    }
    return this.props.children;
  }
}

export default function ErrorBoundary({ children }) {
  return <ErrorBoundaryClass>{children}</ErrorBoundaryClass>;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 24,
  },
  scroll: {
    flex: 1,
    minWidth: 0,
  },
  content: {
    padding: 24,
    paddingTop: 64,
    paddingBottom: 24,
  },
  emoji: {
    fontSize: 48,
    textAlign: 'center',
    lineHeight: 56,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  msgBox: {
    borderRadius: 16,
    padding: 14,
    marginTop: 20,
  },
  source: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 16,
  },
  message: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  stackBox: {
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  stack: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  copyHint: {
    fontSize: 13,
    marginTop: 14,
    lineHeight: 20,
  },
  footer: {
    padding: 24,
    paddingTop: 12,
  },
  retryBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    overflow: 'hidden',
    lineHeight: 22,
  },
});
