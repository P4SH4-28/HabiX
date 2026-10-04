import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import Text from './ui/Text';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { searchProfiles, sendFriendRequest } from '../services/friendService';
import { useT } from '../i18n';
import { useTheme } from '../theme';
import AvatarCircle from './AvatarCircle';
import Icon from './ui/icons';
import IconTile from './ui/IconTile';
import Sheet from './Sheet';

// Arkadaş ekleme akışı: Supabase'de kullanıcı adı arar, bulunan
// profillere arkadaşlık isteği gönderir (onay → karşılıklı arkadaşlık).
export default function AddFriendModal({ visible, onClose }) {
  const { colors: C } = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { data, refreshServer } = useData();
  const { user: authUser } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const timerRef = useRef(null);
  const meName = authUser?.name || '';

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setSearched(false);
      setFeedback(null);
      setBusy(null);
      return;
    }
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const r = await searchProfiles(q, meName);
      setSearching(false);
      setSearched(true);
      setResults(r.ok ? r.results || [] : []);
      if (!r.ok) setFeedback({ name: null, text: r.error || t('friend.searchFailed'), ok: false });
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query, visible]);

  const send = async (username) => {
    setBusy(username);
    setFeedback(null);
    const res = await sendFriendRequest(meName, username);
    setBusy(null);
    if (!res.ok) {
      setFeedback({ name: username, text: res.error || t('friend.sendFailed'), ok: false });
      return;
    }
    if (res.state === 'already_friends') {
      setFeedback({ name: username, icon: '✅', ok: true, text: t('friend.alreadyFriends') });
      await refreshServer();
    } else if (res.state === 'already_pending') {
      setFeedback({ name: username, icon: '⏳', ok: true, text: t('friend.alreadyPending') });
    } else {
      setFeedback({ name: username, icon: '✅', ok: true, text: t('friend.sent') });
    }
  };

  const isFriend = (name) => data.friends.some((f) => f.name === name);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('friend.title')}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TextInput
          style={styles.input}
          placeholder={t('friend.searchPlaceholder')}
          placeholderTextColor={C.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCapitalize="none"
        />
        <Text style={styles.hint}>{t('friend.hint')}</Text>

        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {searching && (
            <View style={styles.centerBox}>
              <ActivityIndicator color={C.primary} />
              <Text style={styles.centerText}>{t('friend.searching')}</Text>
            </View>
          )}
          {!searching &&
            results
              .filter((r) => r.username !== meName)
              .map((r) => {
                const friend = isFriend(r.username);
                return (
                  <View key={r.id} style={styles.row}>
                    <AvatarCircle size={40} />
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {r.username}
                      </Text>
                      <Text style={styles.rowMeta}>
                        <Icon emoji="⚡" size={11} color={C.primary} /> {r.xp} XP
                      </Text>
                    </View>
                    {friend ? (
                      <View style={[styles.tag, styles.tagDone]}>
                        <Text style={styles.tagDoneText}>{t('friend.isFriend')}</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={[
                          styles.sendButton,
                          busy === r.username && styles.sendButtonDisabled,
                        ]}
                        onPress={() => send(r.username)}
                        disabled={busy === r.username}
                      >
                        {busy === r.username ? (
                          <ActivityIndicator size="small" color={C.onPrimary} />
                        ) : (
                          <Text style={styles.sendButtonText}>{t('friend.send')}</Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                );
              })}
          {!searching && searched && results.length === 0 && (
            <View style={styles.centerBox}>
              <IconTile icon="search" emoji="🔍" variant="primary" size={52} iconSize={22} />
              <Text style={styles.centerText}>{t('friend.noResults')}</Text>
              <Text style={styles.centerSub}>{t('friend.noResultsHint')}</Text>
            </View>
          )}
        </ScrollView>

        {feedback && (
          <View style={[styles.feedbackBox, !feedback.ok && { borderWidth: 1, borderColor: C.danger }]}>
            {feedback.icon ? (
              <Icon
                emoji={feedback.icon}
                size={13}
                color={feedback.ok ? C.accent : C.danger}
              />
            ) : null}
            <Text
              style={[
                styles.feedbackText,
                !feedback.ok && { color: C.danger },
              ]}
            >
              {feedback.text}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Sheet>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    input: {
      height: 50,
      borderRadius: 16,
      backgroundColor: C.surfaceLight,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 16,
      color: C.text,
      fontSize: 15,
      lineHeight: 22,
    },
    hint: {
      color: C.textMuted,
      fontSize: 13,
      marginTop: 8,
      marginBottom: 4,
      lineHeight: 20,
    },
    list: {
      maxHeight: 320,
      marginTop: 6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    rowInfo: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    rowName: {
      color: C.text,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 22,
    },
    rowMeta: {
      color: C.textMuted,
      fontSize: 13,
      lineHeight: 20,
    },
    sendButton: {
      backgroundColor: C.primary,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minWidth: 104,
      alignItems: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    sendButtonText: {
      color: C.onPrimary,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 20,
    },
    tag: {
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    tagDone: {
      backgroundColor: C.surfaceLight,
    },
    tagDoneText: {
      color: C.accent,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 20,
    },
    centerBox: {
      alignItems: 'center',
      paddingVertical: 24,
      gap: 8,
    },
    centerText: {
      color: C.textMuted,
      fontSize: 13,
      lineHeight: 20,
    },
    centerSub: {
      color: C.textMuted,
      fontSize: 13,
      textAlign: 'center',
      paddingHorizontal: 16,
      lineHeight: 20,
    },
    feedbackBox: {
      marginTop: 10,
      borderRadius: 12,
      backgroundColor: C.surfaceLight,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    feedbackText: {
      color: C.accent,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
      flex: 1,
      minWidth: 0,
      lineHeight: 20,
    },
  });
}
