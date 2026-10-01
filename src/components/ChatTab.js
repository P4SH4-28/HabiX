// ============================================================
// ChatTab — Genel Sohbet (Sosyal sekme)
// Supabase Realtime ile canlı mesaj akışı. Geçmiş anon key ile
// okunur (RLS okumaya açık), gönderim 'chat-action' Edge
// Function'ından geçer (uzunluk + spam koruması sunucuda).
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import AvatarCircle from './AvatarCircle';
import { fetchChatHistory, sendChatMessage, subscribeChat } from '../services/socialService';
import { useTheme } from '../theme';
import EmptyState from './ui/EmptyState';
import ErrorState from './ui/ErrorState';
import Skeleton from './ui/Skeleton';

function timeLabel(iso) {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export default function ChatTab() {
  const { user: authUser } = useAuth();
  const { data } = useData();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const me = authUser?.name || 'Kullanıcı';
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);

  // Geçmişi çek + canlı akışa abone ol.
  // ÇEKİM HATASI → sahte "boş" durum gösterme; ErrorState + Tekrar Dene.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const r = await fetchChatHistory(60);
      if (!mounted) return;
      setMessages(r.ok ? r.messages : []);
      setFetchFailed(!r.ok);
      setLoading(false);
    })();
    const unsub = subscribeChat((msg) => {
      if (!mounted) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg].slice(-200);
      });
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [reloadKey]);

  const retryFetch = useCallback(() => {
    setFetchFailed(false);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  const handleSend = async () => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    const r = await sendChatMessage({
      username: me,
      name: me,
      avatarId: data.settings.avatarId || null,
      avatarPhoto: data.settings.photoUrl || null,
      message,
    });
    setSending(false);
    if (r.ok) {
      setText('');
    } else {
      setError(
        r.error === 'slow_down'
          ? 'Çok hızlı yazıyorsun — biraz bekle'
          : r.error === 'message_too_long'
            ? 'Mesaj 500 karakterden uzun olamaz'
            : 'Mesaj gönderilemedi (çevrimdışı mısın?)'
      );
    }
  };

  const renderMessage = ({ item }) => {
    const mine = item.username === me;
    return (
      <View style={[styles.msgRow, mine && styles.msgRowMine]}>
        {!mine && (
          <AvatarCircle
            avatarId={item.avatar_id || 'av_fox'}
            photo={item.avatar_photo || null}
            size={34}
          />
        )}
        <View style={[styles.bubble, mine ? { backgroundColor: C.primary + '33' } : { backgroundColor: C.surface }]}>
          {!mine && (
            <Text style={[styles.msgName, { color: C.accent }]} numberOfLines={1}>
              {item.name || item.username}
            </Text>
          )}
          <Text style={styles.msgText}>{item.message}</Text>
          <Text style={[styles.msgTime, { color: C.textMuted }]}>{timeLabel(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletonList}>
              {[72, 56, 64].map((w, i) => (
                <View key={i} style={styles.skeletonRow}>
                  <Skeleton.Circle s={34} />
                  <View style={{ gap: 6 }}>
                    <Skeleton w={w + 60} h={12} />
                    <Skeleton w={w} h={12} />
                  </View>
                </View>
              ))}
            </View>
          ) : fetchFailed ? (
            <ErrorState
              title="Sohbet yüklenemedi"
              message="Bağlantını kontrol edip tekrar deneyebilirsin."
              retryLabel="Tekrar Dene"
              onRetry={retryFetch}
            />
          ) : (
            <EmptyState
              emoji="💬"
              title="Henüz mesaj yok"
              subtitle="Genel sohbete ilk mesajı sen at — topluluğa merhaba de!"
              compact
            />
          )
        }
      />

      {error && (
        <Text style={[styles.error, { color: C.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      )}

      <View style={[styles.inputRow, { borderTopColor: C.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: C.surface, color: C.text }]}
          placeholder="Mesaj yaz…"
          placeholderTextColor={C.textMuted}
          value={text}
          onChangeText={setText}
          maxLength={500}
          multiline={false}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable
          style={[styles.sendBtn, { backgroundColor: C.primary }, (!text.trim() || sending) && styles.disabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel="Mesaj gönder"
          accessibilityState={{ disabled: !text.trim() || sending, busy: sending }}
        >
          {sending ? (
            <ActivityIndicator size="small" color={C.onPrimary} />
          ) : (
            <Ionicons name="send" size={18} color={C.onPrimary} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    listContent: {
      padding: 16,
      gap: 8,
      paddingBottom: 16,
    },
    msgRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    msgRowMine: {
      justifyContent: 'flex-end',
    },
    bubble: {
      maxWidth: '78%',
      borderRadius: 16,
      borderTopLeftRadius: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 2,
    },
    msgName: {
      fontSize: 11,
      fontWeight: '800',
    },
    msgText: {
      color: C.text,
      fontSize: 15,
      lineHeight: 20,
    },
    msgTime: {
      fontSize: 11,
      fontWeight: '600',
      alignSelf: 'flex-end',
      marginTop: 2,
    },
    skeletonList: {
      paddingTop: 16,
      paddingHorizontal: 4,
      gap: 18,
    },
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    error: {
      fontSize: 13,
      fontWeight: '700',
      paddingHorizontal: 16,
      paddingBottom: 6,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
    },
    input: {
      flex: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      fontWeight: '600',
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
