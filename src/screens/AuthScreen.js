// ============================================================
// AuthScreen — Kilit / giriş ekranı (ilk kurulum + geri dönüş)
//
// Akışlar:
// - status "signup" → İLK KURULUM: "Hoş geldin", şifre + onay şifre.
// - status "login"  → GERİ DÖNÜŞ : "Tekrar hoş geldin", yalnız şifre.
// - "Şifremi unuttum" → kurtarma anahtarıyla şifre yenileme.
// - Kayıt sonrası kurtarma anahtarı tek sefer gösterilir (kaydedilmeli).
//
// ANDROID KLAVYE (kök neden düzeltmesi):
//   Kök neden KAVYE DEĞİL, LAYOUT'TI: form dikeyde ortalanmış ve
//   KAYDIRILAMAYAN sabit bir yığındı. Klavye açıldığında görünür alan
//   daralır (adjustResize) — ya da edge-to-edge
//   (android/gradle.properties → edgeToEdgeEnabled=true) nedeniyle
//   daralmayabilir, klavye doğrudan ekranın altına düşer. Her iki
//   durumda da ilk kurulum kartı (ONAY ŞİFRESİ alanı + CTA yüzünden
//   geri dönüş formundan ~66dp daha uzun) görünür alandan taşar;
//   ortalamalı yığın taşan bölümü yukarı ve aşağı eşit iter → onay
//   şifresi alanı ve buton klavyenin ALTINDA kalır. Dokunuşlar
//   klavyeye/ölü alana düşer, akış "donmuş" görünür. Geri dönüş formu
//   bir alan kısa olduğu için genelde sığar — bu yüzden hata yalnızca
//   ilk kurulumda tekrarlanır.
//
//   Ayrıca KeyboardAvoidingView'ın `behavior`'i Android'de bilinçli
//   olarak `undefined` idi (yalnızca iOS'a 'padding' verilmişti), yani
//   telafi eden tek bileşen zaten devre dışıydı.
//
//   Üç katmanlı, KENDİ KENDİNİ DÜZELTEN çözüm (pencere kırpsın da
//   kırpmasın da çalışır):
//     1) KeyboardAvoidingView behavior="padding" — pencere zaten
//        küçüldüyse hesaplanan ofset ~0 olur, küçülmediyse klavye
//        yüksekliği kadar padding uygular (çift telafi OLMAZ).
//     2) ScrollView — içerik her koşulda kaydırılabilir; alanlar ve
//        CTA hiçbir koşulda ulaşılamaz kalmaz.
//     3) Klavye açıkken odaklanan alan otomatik görünür alana kayar —
//        odak kaymaz, karakter kaybı olmaz, alan asla klavye altında
//        kalmaz.
//
// Kimlik doğrulama/depolama DEĞİŞMEDİ (AuthContext + hashPassword).
// Şifreler hiçbir yerde loglanmaz.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import BackgroundPattern from '../components/BackgroundPattern';
import { useTheme } from '../theme';
import BrandMark from '../components/ui/BrandMark';
import Enter from '../components/ui/Enter';
import GradientButton from '../components/GradientButton';
import SoftButton from '../components/ui/SoftButton';
import AppTextField from '../components/ui/AppTextField';
import { Icon, IconTile } from '../components/ui';

// Odaklanan alan klavye açıldığında içerik tepesinden kaç dp aşağıda
// dursun? Küçük değer → alan tepede kalır, altındaki alanlar + CTA
// görünür kalır.
const FOCUS_SCROLL_TARGET = 8;
const FOCUS_SCROLL_EPS = 12;

// Her görünümün KENDİ kutu anahtarları vardır: görünümler arasında
// geçişte eski (unmount) bir ölçü referansı kalmaz.
const BOX_KEYS = {
  auth: ['authName', 'authPw', 'authPw2'],
  recover: ['recName', 'recKey', 'recPw2', 'recPw3'],
};

// Kayıt sonrası gösterilen kurtarma anahtarı ekranı (tek sefer, glass).
function RecoveryKeyModal({ recoveryKey, onDone }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => recoveryStyles(C), [C]);
  return (
    <View style={styles.overlay}>
      <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[styles.card, styles.recoveryCard]}>
        <IconTile name="key" variant="violet" size={54} />
        <Text style={styles.recoveryTitle}>Kurtarma anahtarın!</Text>
        <View style={styles.keyPill}>
          <Text style={styles.recoveryKeyText}>{recoveryKey}</Text>
        </View>
        <Text style={styles.recoveryWarn}>
          Bu anahtarı BİR YERE YAZ. Şifreni unutursan veya cihazını kaybedersen hesabına ancak
          bu anahtarla yeniden girersin. Anahtar kaybolursa hesap kurtarılamaz.
        </Text>
        <GradientButton label="Anladım, kaydettim" onPress={onDone} style={styles.recoveryCta} />
      </View>
    </View>
  );
}

function recoveryStyles(C) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      zIndex: 10,
    },
    card: {
      backgroundColor: C.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.border,
      padding: 20,
    },
    recoveryCard: {
      width: '100%',
      maxWidth: 380,
      alignItems: 'center',
      gap: 14,
      padding: 24,
    },
    recoveryTitle: {
      color: C.text,
      fontSize: 20,
      fontWeight: '800',
    },
    keyPill: {
      backgroundColor: C.surfaceLight,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 14,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    recoveryKeyText: {
      color: C.primary,
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: 3,
    },
    recoveryWarn: {
      color: C.textMuted,
      fontSize: 12,
      lineHeight: 19,
      textAlign: 'center',
    },
    recoveryCta: {
      marginTop: 4,
      alignSelf: 'stretch',
    },
  });
}

// Kurtarma anahtarı girdisini canonical forma getirir:
// "x7k3 q9mf" / "X7K3Q9MF" → "X7K3-Q9MF" (makeRecoveryKey biçimi).
// Hash AuthContext'te bu canonical değer üzerinden hesaplanır.
function normalizeRecoveryKey(value) {
  const body = String(value || '')
    .replace(/[^0-9A-Za-z]/g, '')
    .toUpperCase();
  return body.length === 8 ? `${body.slice(0, 4)}-${body.slice(4)}` : body;
}

// İpucu satırları ASLA null dönmez: alan yüksekliği yazarken sabit kalır,
// içerik boyutu değişmez → odaklanan alan ve altındaki öğeler zıplamaz.
// Uzunluk ipucu: kullanıcı henüz yazarken kırmızı değil, yumuşak ve tek satır.
function lengthHint(value) {
  return value.length < 4 ? 'En az 4 karakter' : '✓ Yeterince uzun';
}

// Eşleşme ipucu: yazarken yumuşak geri bildirim (tek satır, sabit yükseklik).
function matchHint(a, b) {
  if (b.length === 0) return 'Şifrelerini eşleştir';
  return a === b ? '✓ Şifreler eşleşiyor' : 'Şifreler eşleşmiyor';
}

function xpHintTone(text) {
  if (!text) return null;
  return text.startsWith('✓') ? 'accent' : 'xp';
}

export default function AuthScreen() {
  const { colors: C, radius } = useTheme();
  const styles = useMemo(() => makeStyles(C, radius), [C, radius]);
  const insets = useSafeAreaInsets();
  const { status, register, confirmRegister, login, resetPassword } = useAuth();

  const [mode, setMode] = useState(null);
  const [view, setView] = useState('auth');
  const signup = mode === 'login' ? false : status === 'signup';

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [password3, setPassword3] = useState('');
  const [focus, setFocus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState(null);

  // ---------- Klavye / kaydırma yaşam döngüsü ----------
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const boxesRef = useRef({});
  const focusKeyRef = useRef(null);
  const scrollYRef = useRef(0);
  const keyboardOpenRef = useRef(false);

  // Sabit kimlikli ref-callback'ler → her render'da ref detach/attach olmaz.
  const boxRefs = useMemo(() => {
    const make = (keys) => {
      const out = {};
      keys.forEach((k) => {
        out[k] = (el) => {
          boxesRef.current[k] = el;
        };
      });
      return out;
    };
    return {
      auth: make(BOX_KEYS.auth),
      recover: make(BOX_KEYS.recover),
    };
  }, []);

  // Odaklanan alanı klavyenin üstünde, görünür alana alır.
  // Ölçümler (alan kutusu + içerik) kaydırmayla birlikte hareket ettiği
  // için hesaplanan hedef konum kaydırma konumundan BAĞIMSIZDIR.
  const bringIntoView = useCallback((key) => {
    requestAnimationFrame(() => {
      const box = boxesRef.current[key];
      const content = contentRef.current;
      const scroller = scrollRef.current;
      if (!box || !content || !scroller || typeof box.measureInWindow !== 'function') return;
      box.measureInWindow((_bx, boxY) => {
        content.measureInWindow((_cx, contentY) => {
          const y = Math.max(0, boxY - contentY - FOCUS_SCROLL_TARGET);
          if (Math.abs(y - scrollYRef.current) > FOCUS_SCROLL_EPS) {
            scroller.scrollTo({ y, animated: true });
          }
        });
      });
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      keyboardOpenRef.current = true;
      const key = focusKeyRef.current;
      if (key) bringIntoView(key);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardOpenRef.current = false;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [bringIntoView]);

  // Odak yönetimi: klavye AÇIKKEN odaklanan alan hemen görünür alana alınır.
  // Odakta ayrıca submit hatası temizlenir (kullanıcı düzeltmeye başlıyor).
  const focusProps = (key) => ({
    focused: focus === key,
    onFocus: () => {
      focusKeyRef.current = key;
      setFocus(key);
      setError('');
      if (keyboardOpenRef.current) bringIntoView(key);
    },
    onBlur: () => {
      if (focusKeyRef.current === key) focusKeyRef.current = null;
      setFocus((f) => (f === key ? null : f));
    },
  });

  const submit = async () => {
    setError('');
    if (!name.trim()) return setError('İsim girmelisin');
    if (!password) return setError('Şifre girmelisin');
    if (password.length < 4) return setError('Şifre en az 4 karakter olmalı');
    if (signup && password !== password2) return setError('Şifreler eşleşmiyor');
    setBusy(true);
    // finally: beklenmedik bir reddedilme olsa bile CTA loading'de KİLİTLENMEZ.
    let result;
    try {
      result = signup ? await register(name, password) : await login(name, password);
    } catch (e) {
      result = {
        ok: false,
        error: signup ? 'Kayıt sırasında hata oluştu' : 'Giriş sırasında hata oluştu',
      };
    } finally {
      setBusy(false);
    }
    // Başarıda klavye kapatılır; BAŞARISIZLIKTA açık kalır → kullanıcı
    // hatayı görür ve doğrudan düzeltmeye devam edebilir.
    if (result.ok) Keyboard.dismiss();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (signup && result.recoveryKey) setRecoveryKey(result.recoveryKey);
  };

  const submitRecover = async () => {
    setError('');
    if (!name.trim()) return setError('İsim girmelisin');
    const rk = normalizeRecoveryKey(password);
    const rkBody = rk.replace(/-/g, '');
    if (!rkBody) return setError('Kurtarma anahtarı girmelisin');
    if (rkBody.length < 8) return setError('Kurtarma anahtarı geçersiz');
    if (!password2) return setError('Yeni şifre girmelisin');
    if (password2.length < 4) return setError('Yeni şifre en az 4 karakter olmalı');
    if (password2 !== password3) return setError('Yeni şifreler eşleşmiyor');
    setBusy(true);
    // Kullanıcı tireyi atlayabilir ("X7K3Q9MF") veya küçük yazabilir;
    // canonical forma (XXXXXXXX → XXXX-XXXX) getirilir, hash AuthContext'te
    // hesaplanmaya devam eder — hash/güvenlik modeli değişmez.
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
  };

  const isRecover = view === 'recover';
  const boxes = isRecover ? boxRefs.recover : boxRefs.auth;
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

  const goRecover = () => {
    Keyboard.dismiss();
    setView('recover');
    setError('');
    setPassword('');
    setPassword2('');
    setPassword3('');
  };
  const goAuth = () => {
    Keyboard.dismiss();
    setView('auth');
    setError('');
  };
  const toggleMode = () => {
    Keyboard.dismiss();
    setMode(signup ? 'login' : 'signup');
    setError('');
  };

  // İpucu satırları her zaman dolu → içerik yüksekliği hiç değişmez
  // (yazarken layout zıplaması yok). Hata yalnızca ayrı alert satırında.
  const pwHint = lengthHint(password);
  const newPwHint = lengthHint(password2);
  const confirmHint = matchHint(password, password2);
  const recoverConfirmHint = matchHint(password2, password3);

  return (
    <View style={styles.container}>
      <BackgroundPattern />
      <KeyboardAvoidingView style={styles.kav} behavior="padding">
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          scrollEventThrottle={16}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
        >
          <View ref={contentRef} collapsable={false} style={styles.stack}>
            {/* 1) Marka alanı — sade, abartısız, yumuşak giriş */}
            <Enter delay={0} y={10} scale={0.05} duration={420} style={styles.brand}>
              <BrandMark size={72} />
            </Enter>

            {/* 2) Kilit kartı — güvenlik görseli + başlık + alanlar + CTA */}
            <Enter delay={90} y={16} duration={380}>
              <View style={styles.card}>
                <View style={styles.hero}>
                  <Enter delay={40} y={0} scale={0.12} duration={420}>
                    <IconTile name="lock-closed" variant="violet" size={52} />
                  </Enter>
                  <Text style={styles.title} accessibilityRole="header">
                    {title}
                  </Text>
                  <Text style={styles.desc}>{desc}</Text>
                </View>

                <View style={styles.fields}>
                  <AppTextField
                    icon="person"
                    label="İsim"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                    containerRef={isRecover ? boxes.recName : boxes.authName}
                    {...focusProps(isRecover ? 'recName' : 'authName')}
                  />

                  {isRecover ? (
                    <>
                      <AppTextField
                        icon="key"
                        label="Kurtarma anahtarı"
                        placeholder="X7K3-Q9MF"
                        value={password}
                        onChangeText={setPassword}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        containerRef={boxes.recKey}
                        {...focusProps('recKey')}
                      />
                      <AppTextField
                        icon="lock-closed"
                        label="Yeni şifre"
                        secure
                        value={password2}
                        onChangeText={setPassword2}
                        hint={newPwHint}
                        hintColor={C[xpHintTone(newPwHint)]}
                        containerRef={boxes.recPw2}
                        {...focusProps('recPw2')}
                      />
                      <AppTextField
                        icon="lock-closed"
                        label="Yeni şifre (tekrar)"
                        secure
                        value={password3}
                        onChangeText={setPassword3}
                        hint={recoverConfirmHint}
                        hintColor={C[xpHintTone(recoverConfirmHint)]}
                        containerRef={boxes.recPw3}
                        {...focusProps('recPw3')}
                      />
                    </>
                  ) : (
                    <>
                      <AppTextField
                        icon="lock-closed"
                        label="Şifre"
                        secure
                        value={password}
                        onChangeText={setPassword}
                        hint={pwHint}
                        hintColor={C[xpHintTone(pwHint)]}
                        containerRef={boxes.authPw}
                        {...focusProps('authPw')}
                      />
                      {signup ? (
                        <AppTextField
                          icon="lock-closed"
                          label="Şifre (tekrar)"
                          secure
                          value={password2}
                          onChangeText={setPassword2}
                          hint={confirmHint}
                          hintColor={C[xpHintTone(confirmHint)]}
                          containerRef={boxes.authPw2}
                          {...focusProps('authPw2')}
                        />
                      ) : null}
                    </>
                  )}
                </View>

                {error ? (
                  <View style={styles.errorRow} accessibilityRole="alert">
                    <Icon name="alert-circle" size={14} color={C.danger} />
                    <Text style={styles.error}>{error}</Text>
                  </View>
                ) : null}

                <GradientButton
                  label={primaryLabel}
                  loading={busy}
                  disabled={busy}
                  onPress={isRecover ? submitRecover : submit}
                  style={styles.cta}
                  glowColor={C.primary}
                />

                {isRecover ? (
                  <View style={styles.linksBox}>
                    <SoftButton
                      label="← Giriş ekranına dön"
                      variant="subtle"
                      size="sm"
                      onPress={goAuth}
                    />
                  </View>
                ) : (
                  <>
                    {!signup ? (
                      <View style={styles.linksBox}>
                        <SoftButton
                          label="Şifremi unuttum"
                          variant="subtle"
                          size="sm"
                          onPress={goRecover}
                        />
                      </View>
                    ) : null}
                    <Text style={styles.hint}>
                      {signup
                        ? 'Bu cihazda yalnızca bir hesap olabilir.'
                        : 'Şifreni unuttuysan kurtarma anahtarınla sıfırlayabilirsin.'}
                    </Text>
                    <View style={styles.linksBox}>
                      <SoftButton
                        label={signup ? 'Hesabın var mı? Giriş yap' : 'Hesabın yok mu? Kayıt ol'}
                        variant="subtle"
                        size="sm"
                        onPress={toggleMode}
                      />
                    </View>
                  </>
                )}
              </View>
            </Enter>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {recoveryKey ? (
        <RecoveryKeyModal
          recoveryKey={recoveryKey}
          onDone={() => {
            setRecoveryKey(null);
            confirmRegister();
          }}
        />
      ) : null}
    </View>
  );
}

function makeStyles(C, radius) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    // behavior="padding": pencere zaten küçüldüyse hesaplanan ofset ~0
    // olur, küçülmediyse (edge-to-edge) klavye kadar telafi edilir.
    kav: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    stack: {
      gap: 28,
    },
    brand: {
      alignItems: 'center',
    },
    card: {
      backgroundColor: C.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: C.border,
      padding: 20,
      gap: 14,
    },
    hero: {
      alignItems: 'center',
      gap: 8,
      marginBottom: 2,
    },
    title: {
      color: C.text,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '800',
      letterSpacing: -0.4,
      textAlign: 'center',
      marginTop: 4,
    },
    desc: {
      color: C.textMuted,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
    },
    fields: {
      gap: 12,
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    error: {
      color: C.danger,
      fontSize: 13,
      fontWeight: '600',
      flexShrink: 1,
    },
    cta: {
      marginTop: 2,
      alignSelf: 'stretch',
    },
    hint: {
      color: C.textMuted,
      fontSize: 11,
      lineHeight: 16,
      textAlign: 'center',
    },
    linksBox: {
      alignItems: 'center',
      paddingTop: 2,
    },
  });
}
