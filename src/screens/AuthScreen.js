// ============================================================
// AuthScreen — Kilit / giriş ekranı (tasarım sistemi v3)
//   status "signup" → "Hoş geldin" + şifre/onya · status "login" → "Tekrar hoş geldin"
//   "Şifremi unuttum" → kurtarma anahtarıyla şifre yenileme
//   Kayıt sonrası kurtarma anahtarı tek sefer gösterilir (Modal)
//
// YENİ SİSTEM: Card (form yüzeyi) · TextInput (label/hint/error)
//              Button (loading/disabled) · Text variant'ları
//              spacing/typography token'ları (hardcoded font YOK)
//   GLOW YOK · GRADIENT YOK · LOOP YOK.
//
// KLAVYE: KeyboardAvoidingView (iOS padding) + ScrollView
// keyboardShouldPersistTaps="handled". Handler'lar useCallback ile sabit.
// MODAL: karartmaya bas / Escape / Android back → kapanır; kart basılınca
//        kapanmaz (kritik kurtarma anahtarı yanlışlıkla kaybolmasın).
// Doğrulama/depolama AuthContext'tedir; şifreler loglanmaz.
// ============================================================
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Text from '../components/ui/Text';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import TextInput from '../components/ui/TextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme';
import useDismissOnEscape from '../hooks/useDismissOnEscape';

// ---------- İpucu metinleri (touched yoksa boş döner → satır basılmaz) ----------
function lengthHint(value, touched) {
  if (!touched) return '';
  return value.length < 4 ? 'En az 4 karakter' : '✓ Yeterince uzun';
}
function matchHint(a, b, touched) {
  if (!touched) return '';
  if (!a || !b) return 'Şifrelerini eşleştir';
  return a === b ? '✓ Şifreler eşleşiyor' : 'Şifreler eşleşmiyor';
}
function nameHint(value, touched) {
  if (!touched) return '';
  return value.trim().length < 2 ? 'En az 2 karakter' : '✓ İsim hazır';
}
// "x7k3 q9mf" / "X7K3Q9MF" → "X7K3-Q9MF" (makeRecoveryKey biçimi).
function normalizeRecoveryKey(value) {
  const body = String(value || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return body.length === 8 ? `${body.slice(0, 4)}-${body.slice(4)}` : body;
}

export default function AuthScreen() {
  const { colors: C, radius, space, type } = useTheme();
  const styles = useMemo(() => makeStyles(C, radius, space, type), [C, radius, space, type]);
  const insets = useSafeAreaInsets();
  const { status, register, confirmRegister, login, resetPassword } = useAuth();

  const [mode, setMode] = useState(null); // null | 'login' | 'signup'
  const [view, setView] = useState('auth'); // 'auth' | 'recover'
  const signup = mode === 'signup' ? true : mode === 'login' ? false : status === 'signup';

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [password3, setPassword3] = useState('');
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState(null);

  // Yalnızca odak aktarımı için ref'ler.
  const nameRef = useRef(null);
  const pwRef = useRef(null);
  const pw2Ref = useRef(null);
  const pw3Ref = useRef(null);

  const markTouched = useCallback((key) => {
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  }, []);
  const clearError = useCallback(() => setError(''), []);

  const submit = useCallback(async () => {
    setError('');
    if (!name.trim()) return setError('İsim girmelisin');
    if (!password) return setError('Şifre girmelisin');
    if (password.length < 4) return setError('Şifre en az 4 karakter olmalı');
    if (signup && password !== password2) return setError('Şifreler eşleşmiyor');
    setBusy(true);
    // finally: beklenmedik bir reddedilme olsa bile buton kilitlenmez.
    let result;
    try {
      result = signup ? await register(name, password) : await login(name, password);
    } catch (e) {
      result = { ok: false, error: signup ? 'Kayıt sırasında hata oluştu' : 'Giriş sırasında hata oluştu' };
    } finally {
      setBusy(false);
    }
    if (result.ok) Keyboard.dismiss(); // başarıda klavye kapanır, hatada açık kalır
    if (!result.ok) return setError(result.error);
    if (signup && result.recoveryKey) setRecoveryKey(result.recoveryKey);
  }, [name, password, password2, signup, register, login]);

  const submitRecover = useCallback(async () => {
    setError('');
    if (!name.trim()) return setError('İsim girmelisin');
    const rk = normalizeRecoveryKey(password);
    if (!rk) return setError('Kurtarma anahtarı girmelisin');
    if (rk.replace(/-/g, '').length < 8) return setError('Kurtarma anahtarı geçersiz');
    if (!password2) return setError('Yeni şifre girmelisin');
    if (password2.length < 4) return setError('Yeni şifre en az 4 karakter olmalı');
    if (password2 !== password3) return setError('Yeni şifreler eşleşmiyor');
    setBusy(true);
    // Tire atlanabilir ("X7K3Q9MF") veya küçük yazılabilir; canonical forma
    // çevrilir, hash AuthContext'te hesaplanmaya devam eder (güvenlik değişmez).
    let result;
    try {
      result = await resetPassword(name, rk, password2);
    } catch (e) {
      result = { ok: false, error: 'Şifre sıfırlanamadı' };
    } finally {
      setBusy(false);
    }
    if (result.ok) Keyboard.dismiss();
    if (!result.ok) setError(result.error);
  }, [name, password, password2, password3, resetPassword]);

  const goRecover = useCallback(() => {
    Keyboard.dismiss();
    setView('recover');
    setError('');
    setPassword('');
    setPassword2('');
    setPassword3('');
  }, []);
  // Çıkışta kurtarma anahtarı "password" alanında kalıp şifre gibi
  // gönderilebilirdi → temizlenir (name korunur).
  const goAuth = useCallback(() => {
    Keyboard.dismiss();
    setView('auth');
    setError('');
    setPassword('');
  }, []);
  const toggleMode = useCallback(() => {
    Keyboard.dismiss();
    setMode(signup ? 'login' : 'signup');
    setError('');
  }, [signup]);
  const finishRegister = useCallback(() => {
    setRecoveryKey(null);
    confirmRegister();
  }, [confirmRegister]);
  // Kurtarma anahtarı: Escape (web) ile de kapansın; back zaten onRequestClose.
  useDismissOnEscape(!!recoveryKey, finishRegister);

  const isRecover = view === 'recover';

  const focusNext = useCallback((ref) => {
    if (ref && ref.current) ref.current.focus();
    else Keyboard.dismiss();
  }, []);

  const nameH = nameHint(name, touched.name);
  const pwH = isRecover ? '' : lengthHint(password, touched.password);
  const pw2H = isRecover
    ? lengthHint(password2, touched.password2)
    : signup
      ? matchHint(password, password2, touched.password2)
      : '';
  const pw3H = isRecover ? matchHint(password2, password3, touched.password3) : '';

  const title = isRecover
    ? 'Kurtarma anahtarınla yenile'
    : signup
      ? 'Hoş geldin'
      : 'Tekrar hoş geldin';
  const desc = isRecover
    ? 'Kurtarma anahtarını gir, yeni şifreni belirle.'
    : signup
      ? 'Alışkanlıklarını korumak için bir şifre oluştur.'
      : 'Devam etmek için şifreni gir.';
  const primaryLabel = isRecover ? 'Şifreyi Sıfırla' : signup ? 'Şifreyi Oluştur' : 'Giriş Yap';

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
          ]}
        >
          {/* Form yüzeyi: yeni Card primitive'i (padding lg). */}
          <Card padding="lg" style={styles.formCard}>
            {/* Card gap vermez → blok arası NEFES sarmalayıcıda (20). */}
            <View style={styles.form}>
            <View style={styles.headBlock}>
              <Text variant="h1" style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              <Text variant="small" style={styles.desc}>
                {desc}
              </Text>
            </View>

            <TextInput
                ref={nameRef}
                label="İsim"
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  markTouched('name');
                }}
                onBlur={() => markTouched('name')}
                onFocus={clearError}
                onSubmitEditing={() => focusNext(pwRef)}
                returnKeyType="next"
                autoCapitalize="words"
                autoCorrect={false}
                hint={nameH}
                error={touched.name && nameH && !nameH.startsWith('✓') ? nameH : undefined}
                accessibilityLabel="İsim"
              />

              <TextInput
                ref={pwRef}
                label={isRecover ? 'Kurtarma anahtarı' : 'Şifre'}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  markTouched('password');
                }}
                onBlur={() => markTouched('password')}
                onFocus={clearError}
                onSubmitEditing={() =>
                  focusNext(signup || isRecover ? pw2Ref : null)
                }
                returnKeyType={signup || isRecover ? 'next' : 'done'}
                secureTextEntry={!isRecover}
                autoCapitalize={isRecover ? 'characters' : 'none'}
                autoCorrect={false}
                placeholder={isRecover ? 'X7K3-Q9MF' : undefined}
                hint={pwH}
                error={touched.password && pwH && !pwH.startsWith('✓') ? pwH : undefined}
                accessibilityLabel={isRecover ? 'Kurtarma anahtarı' : 'Şifre'}
              />

              {signup || isRecover ? (
                <TextInput
                  ref={pw2Ref}
                  label={isRecover ? 'Yeni şifre' : 'Şifre (tekrar)'}
                  value={password2}
                  onChangeText={(v) => {
                    setPassword2(v);
                    markTouched('password2');
                  }}
                  onBlur={() => markTouched('password2')}
                  onFocus={clearError}
                  onSubmitEditing={() => focusNext(isRecover ? pw3Ref : null)}
                  returnKeyType={isRecover ? 'next' : 'done'}
                  secureTextEntry
                  hint={pw2H}
                  error={touched.password2 && pw2H && !pw2H.startsWith('✓') ? pw2H : undefined}
                  accessibilityLabel={isRecover ? 'Yeni şifre' : 'Şifre tekrar'}
                />
              ) : null}

              {isRecover ? (
                <TextInput
                  ref={pw3Ref}
                  label="Yeni şifre (tekrar)"
                  value={password3}
                  onChangeText={(v) => {
                    setPassword3(v);
                    markTouched('password3');
                  }}
                  onBlur={() => markTouched('password3')}
                  onFocus={clearError}
                  onSubmitEditing={submitRecover}
                  returnKeyType="done"
                  secureTextEntry
                  hint={pw3H}
                  error={touched.password3 && pw3H && !pw3H.startsWith('✓') ? pw3H : undefined}
                  accessibilityLabel="Yeni şifre tekrar"
                />
              ) : null}

              {error ? (
                <Text variant="small" style={styles.error} accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}

              <Button
                label={primaryLabel}
                size="lg"
                fullWidth
                loading={busy}
                disabled={busy}
                onPress={isRecover ? submitRecover : submit}
                accessibilityLabel={primaryLabel}
              />

            {isRecover ? (
              <Pressable onPress={goAuth} accessibilityRole="button" style={styles.linkBox}>
                <Text variant="small" style={styles.link}>
                  ← Giriş ekranına dön
                </Text>
              </Pressable>
            ) : (
              <View style={styles.footBlock}>
                {!signup ? (
                  <Pressable onPress={goRecover} accessibilityRole="button" style={styles.linkBox}>
                    <Text variant="small" style={styles.link}>
                      Şifremi unuttum
                    </Text>
                  </Pressable>
                ) : null}
                <Text variant="micro" style={styles.footHint}>
                  {signup
                    ? 'Bu cihazda yalnızca bir hesap olabilir.'
                    : 'Şifreni unuttuysan kurtarma anahtarınla sıfırlayabilirsin.'}
                </Text>
                <Pressable onPress={toggleMode} accessibilityRole="button" style={styles.linkBox}>
                  <Text variant="small" style={styles.link}>
                    {signup ? 'Hesabın var mı? Giriş yap' : 'Hesabın yok mu? Kayıt ol'}
                  </Text>
                </Pressable>
              </View>
            )}
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ---------- Kurtarma anahtarı (tek sefer) ---------- */}
      <Modal
        visible={!!recoveryKey}
        transparent
        animationType="fade"
        onRequestClose={finishRegister}
      >
        {/* Kullanıcı geri bildirimi: karartmadaki boşluğa basın da kapansın. */}
        <Pressable
          style={styles.overlay}
          onPress={finishRegister}
          accessibilityRole="button"
          accessibilityLabel="Kurtarma anahtarı ekranını kapat"
        >
          <View
            style={styles.modalBox}
            // Karta basmak kapatmaz (kritik kurtarma anahtarı yanlışlıkla kaybolmasın).
            onStartShouldSetResponder={() => true}
          >
            <Card padding="lg" style={styles.modalCard}>
              <Text variant="h3" style={styles.modalTitle} accessibilityRole="header">
                Kurtarma anahtarın!
              </Text>
              <View style={styles.keyPill}>
                <Text style={styles.keyText}>{recoveryKey}</Text>
              </View>
              <Text variant="small" style={styles.modalWarn}>
                Bu anahtarı BİR YERE YAZ. Şifreni unutursan hesabına ancak bu anahtarla yeniden
                girersin. Anahtar kaybolursa hesap kurtarılamaz.
              </Text>
              <Button
                label="Anladım, kaydettim"
                size="lg"
                fullWidth
                onPress={finishRegister}
                accessibilityLabel="Kurtarma anahtarını kaydettim"
              />
            </Card>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(C, radius, space, type) {
  return StyleSheet.create({
    container: { flex: 1, minWidth: 0, backgroundColor: C.background },
    flex: { flex: 1, minWidth: 0 },
    // Bol nefes: 24 yatay, 32 dikey (32 grid'de).
    content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
    formCard: { alignSelf: 'stretch' },
    headBlock: { gap: 12, alignItems: 'center' },
    title: { ...type.h1, color: C.text, textAlign: 'center' },
    desc: { ...type.small, color: C.textMuted, textAlign: 'center' },
    // Form blokları: 20 (grid) — input ↔ buton ↔ linkler yapışmasın.
    form: { gap: 20 },
    footBlock: { gap: 12, alignItems: 'center' },
    error: { color: C.danger, fontWeight: '600', textAlign: 'center' },
    linkBox: { alignItems: 'center', paddingVertical: 8 },
    link: { color: C.primary, fontWeight: '700' },
    footHint: { color: C.textMuted, textAlign: 'center' },
    overlay: {
      flex: 1,
      minWidth: 0,
      backgroundColor: 'rgba(0,0,0,0.65)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    modalBox: { width: '100%', maxWidth: 380 },
    modalCard: { gap: 16, alignItems: 'center' },
    modalTitle: { color: C.text, textAlign: 'center' },
    // Kurtarma anahtarı rozeti.
    keyPill: {
      backgroundColor: C.surfaceLight,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: radius.control,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      alignSelf: 'stretch',
      alignItems: 'center',
    },
    keyText: { color: C.primary, fontSize: 22, fontWeight: '700', letterSpacing: 3, lineHeight: 32 },
    modalWarn: { color: C.textMuted, textAlign: 'center' },
  });
}
