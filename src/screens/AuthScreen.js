// ============================================================
// AuthScreen — Kilit / giriş ekranı (ilk kurulum + geri dönüş)
//   status "signup" → "Hoş geldin" + şifre/onya · status "login" → "Tekrar hoş geldin"
//   "Şifremi unuttum" → kurtarma anahtarıyla şifre yenileme
//   Kayıt sonrası kurtarma anahtarı tek sefer gösterilir (Modal)
// KLAVYE: KeyboardAvoidingView behavior="padding" + ScrollView
// keyboardShouldPersistTaps="handled". Odak state'ten bağımsızdır; handler'lar
// useCallback ile sabittir (render'da yenisi üretilmez).
// HINT: touched'a basılmadan hint satırı render edilmez.
// Doğrulama/depolama AuthContext'tedir; şifreler loglanmaz.
// ============================================================
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import Text from '../components/ui/Text';
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
function hintTone(text) {
  if (!text) return null;
  return text.startsWith('✓') ? 'accent' : 'xp';
}
// "x7k3 q9mf" / "X7K3Q9MF" → "X7K3-Q9MF" (makeRecoveryKey biçimi).
function normalizeRecoveryKey(value) {
  const body = String(value || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return body.length === 8 ? `${body.slice(0, 4)}-${body.slice(4)}` : body;
}

// Basit input: etiket + TextInput + koşullu ipucu satırı.
// Stiller parent'tan gelir; handler'lar burada sabitlenir, böylece
// her render'da yeni fonksiyon oluşmaz ve odak düşmez.
function SimpleInput({ s, inputRef, nextRef, fieldKey, label, value, onChangeText, onTouch, onFocus, secure, hint, hintColor, ...rest }) {
  const handleChange = useCallback((v) => { onChangeText(v); onTouch(fieldKey); }, [onChangeText, onTouch, fieldKey]);
  const handleBlur = useCallback(() => onTouch(fieldKey), [onTouch, fieldKey]);
  const handleSubmit = useCallback(() => {
    if (nextRef && nextRef.current) nextRef.current.focus();
    else Keyboard.dismiss();
  }, [nextRef]);
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput ref={inputRef} value={value} onChangeText={handleChange} onBlur={handleBlur}
        onFocus={onFocus} onSubmitEditing={handleSubmit} secureTextEntry={secure}
        style={s.input} {...rest} />
      {hint ? <Text style={hintColor ? [s.hint, { color: hintColor }] : s.hint}>{hint}</Text> : null}
    </View>
  );
}

// GradientButton yerine sade, dolu buton (loading + disabled korunur).
function PrimaryButton({ s, label, onPress, loading, disabled }) {
  const { colors: C } = useTheme();
  const busy = loading && !disabled;
  return (
    <Pressable onPress={busy ? undefined : onPress} disabled={disabled || busy}
      accessibilityRole="button" accessibilityState={{ disabled: !!disabled || busy, busy }}
      style={({ pressed }) => [s.btn, pressed && s.btnPressed, (disabled || busy) && s.btnOff]}>
      {busy ? <ActivityIndicator size="small" color={C.onPrimary} /> : null}
      <Text style={s.btnLabel}>{label}</Text>
    </Pressable>
  );
}

export default function AuthScreen() {
  const { colors: C, radius, type } = useTheme();
  const styles = useMemo(() => makeStyles(C, radius, type), [C, radius, type]);
  const insets = useSafeAreaInsets();
  const { status, register, confirmRegister, login, resetPassword } = useAuth();

  const [mode, setMode] = useState(null);       // null | 'login' | 'signup'
  const [view, setView] = useState('auth');     // 'auth' | 'recover'
  const signup = mode === 'signup' ? true : mode === 'login' ? false : status === 'signup';

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [password3, setPassword3] = useState('');
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState(null);

  // Yalnızca odak aktarımı için ref'ler (boxRefs / measure / bringIntoView yok).
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
  // gönderilebilirdi → temizlenir (name korunur, kullanıcıyı rahatsız etmez).
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
  // Alanlara ortak, sabit referanslar (her render'da yeniden üretilmez).
  const common = useMemo(
    () => ({ s: styles, onTouch: markTouched, onFocus: clearError, placeholderTextColor: C.textMuted }),
    [styles, markTouched, clearError, C.textMuted]
  );

  const nameH = nameHint(name, touched.name);
  const pwH = isRecover ? '' : lengthHint(password, touched.password);
  const pw2H = isRecover ? lengthHint(password2, touched.password2)
    : signup ? matchHint(password, password2, touched.password2) : '';
  const pw3H = isRecover ? matchHint(password2, password3, touched.password3) : '';

  const title = isRecover ? 'Kurtarma anahtarınla yenile'
    : signup ? 'Hoş geldin' : 'Tekrar hoş geldin';
  const desc = isRecover ? 'Kurtarma anahtarını gir, yeni şifreni belirle.'
    : signup ? 'Alışkanlıklarını korumak için bir şifre oluştur.' : 'Devam etmek için şifreni gir.';
  const primaryLabel = isRecover ? 'Şifreyi Sıfırla' : signup ? 'Şifreyi Oluştur' : 'Giriş Yap';

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView style={styles.flex} keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.card}>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            <Text style={styles.desc}>{desc}</Text>

            <SimpleInput {...common} inputRef={nameRef} nextRef={pwRef} fieldKey="name"
              label="İsim" value={name} onChangeText={setName} returnKeyType="next"
              autoCapitalize="words" autoCorrect={false} hint={nameH} hintColor={C[hintTone(nameH)]} />

            <SimpleInput {...common} inputRef={pwRef} nextRef={signup || isRecover ? pw2Ref : null}
              fieldKey="password" label={isRecover ? 'Kurtarma anahtarı' : 'Şifre'} value={password}
              onChangeText={setPassword} secure={!isRecover}
              autoCapitalize={isRecover ? 'characters' : 'none'} autoCorrect={false}
              placeholder={isRecover ? 'X7K3-Q9MF' : undefined}
              returnKeyType={signup || isRecover ? 'next' : 'done'}
              hint={pwH} hintColor={C[hintTone(pwH)]} />

            {signup || isRecover ? (
              <SimpleInput {...common} inputRef={pw2Ref} nextRef={isRecover ? pw3Ref : null}
                fieldKey="password2" label={isRecover ? 'Yeni şifre' : 'Şifre (tekrar)'}
                value={password2} onChangeText={setPassword2} secure
                returnKeyType={isRecover ? 'next' : 'done'}
                hint={pw2H} hintColor={C[hintTone(pw2H)]} />
            ) : null}

            {isRecover ? (
              <SimpleInput {...common} inputRef={pw3Ref} nextRef={null} fieldKey="password3"
                label="Yeni şifre (tekrar)" value={password3} onChangeText={setPassword3} secure
                returnKeyType="done" hint={pw3H} hintColor={C[hintTone(pw3H)]} />
            ) : null}

            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

            <PrimaryButton s={styles} label={primaryLabel} loading={busy} disabled={busy}
              onPress={isRecover ? submitRecover : submit} />

            {isRecover ? (
              <Pressable onPress={goAuth} accessibilityRole="button" style={styles.linkBox}>
                <Text style={styles.link}>← Giriş ekranına dön</Text>
              </Pressable>
            ) : (
              <>
                {!signup ? (
                  <Pressable onPress={goRecover} accessibilityRole="button" style={styles.linkBox}>
                    <Text style={styles.link}>Şifremi unuttum</Text>
                  </Pressable>
                ) : null}
                <Text style={styles.footHint}>
                  {signup ? 'Bu cihazda yalnızca bir hesap olabilir.' : 'Şifreni unuttuysan kurtarma anahtarınla sıfırlayabilirsin.'}
                </Text>
                <Pressable onPress={toggleMode} accessibilityRole="button" style={styles.linkBox}>
                  <Text style={styles.link}>{signup ? 'Hesabın var mı? Giriş yap' : 'Hesabın yok mu? Kayıt ol'}</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!recoveryKey} transparent animationType="fade" onRequestClose={finishRegister}>
        {/* Kullanıcı geri bildirimi: karartmadaki boşluğa basın da kapansın. */}
        <Pressable
          style={styles.overlay}
          onPress={finishRegister}
          accessibilityRole="button"
          accessibilityLabel="Kurtarma anahtarı ekranını kapat"
        >
          <View
            style={styles.modal}
            // Karta basmak kapatmaz (kritik kurtarma anahtarı yanlışlıkla kaybolmasın).
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>Kurtarma anahtarın!</Text>
            <View style={styles.keyPill}><Text style={styles.keyText}>{recoveryKey}</Text></View>
            <Text style={styles.modalWarn}>
              Bu anahtarı BİR YERE YAZ. Şifreni unutursan hesabına ancak bu anahtarla yeniden
              girersin. Anahtar kaybolursa hesap kurtarılamaz.
            </Text>
            <PrimaryButton s={styles} label="Anladım, kaydettim" onPress={finishRegister} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(C, radius, type) {
  return StyleSheet.create({
    container: { flex: 1, minWidth: 0, backgroundColor: C.background },
    flex: { flex: 1, minWidth: 0 },
    content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
    // Form kartı: blok arası NEFES (input ↔ buton ↔ linkler yapışmasın).
    card: {
      backgroundColor: C.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: C.border,
      padding: 24,
      gap: 20,
    },
    title: { ...type.h1, color: C.text, textAlign: 'center' },
    desc: { ...type.small, color: C.textMuted, textAlign: 'center', marginBottom: 8 },
    field: { gap: 12 },
    label: { ...type.micro, color: C.textMuted },
    input: { backgroundColor: C.surfaceLight, borderWidth: 1, borderColor: C.border, borderRadius: radius.control, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: C.text, lineHeight: 22 },
    hint: { ...type.micro, color: C.xp },
    error: { ...type.small, color: C.danger, fontWeight: '600' },
    btn: { backgroundColor: C.primary, borderRadius: radius.control, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    btnPressed: { opacity: 0.85 },
    btnOff: { opacity: 0.5 },
    btnLabel: { color: C.onPrimary, fontSize: 15, fontWeight: '600', letterSpacing: 0.2, lineHeight: 22 },
    linkBox: { alignItems: 'center', paddingVertical: 8 },
    link: { color: C.primary, fontSize: 13, fontWeight: '700', lineHeight: 20 },
    footHint: { color: C.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16 },
    overlay: { flex: 1, minWidth: 0, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    modal: { width: '100%', maxWidth: 380, backgroundColor: C.surface, borderRadius: radius.card, borderWidth: 1, borderColor: C.border, padding: 24, gap: 16, alignItems: 'center' },
    modalTitle: { ...type.h1, textAlign: 'center' },
    // Kayıp stil geri yüklendi (kurtarma anahtarı rozeti).
    keyPill: {
      backgroundColor: C.surfaceLight,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: radius.control,
      paddingHorizontal: 20,
      paddingVertical: 12,
      alignSelf: 'stretch',
      alignItems: 'center',
    },
    keyText: { color: C.primary, fontSize: 22, fontWeight: '700', letterSpacing: 3, lineHeight: 32 },
    modalWarn: { ...type.small, color: C.textMuted, textAlign: 'center' },
  });
}
