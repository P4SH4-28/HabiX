// ============================================================
// AppTextField.js — Ortak premium input primitive'i.
// Durumlar: focus (animasyonlu kenarlık + hafif dolgu + glow),
// error (danger kenarlık + satır içi metin), disabled, hint
//   (açıklayıcı satır, isteğe bağlı renk). Formlarda TEK görsel dil
//   sağlar (odak davranışı her yerde aynı). Tüketici: AddHabitModal.
//   `focused`  — verilirse dışarıdan yönetilir (AuthScreen modu);
//                verilmezse bileşen kendi odağını yönetir.
//   `secure`   — göster/gizle düğmesi ekler; odağı VE klavyeyi korur.
//   `inputRef` / `containerRef` — dışarıdan odak + konum ölçümü için.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import Icon from './icons';

const FOCUS_MS = 180;

export default function AppTextField({
  icon,
  label,
  hint,
  hintColor,
  error,
  secure = false,
  focused: focusedProp,
  onFocus,
  onBlur,
  style,
  inputStyle,
  editable = true,
  inputRef,
  containerRef,
  secureTextEntry,
  ...rest
}) {
  const { colors: C, radius, type, space, glow } = useTheme();
  const [innerFocus, setInnerFocus] = useState(false);
  const [hidden, setHidden] = useState(true);
  const controlled = focusedProp !== undefined;
  const focused = controlled ? focusedProp : innerFocus;
  const styles = useMemo(() => makeStyles(C, radius, type, space), [C, radius, type, space]);

  const localInputRef = useRef(null);
  const setInputRef = (el) => {
    localInputRef.current = el;
    if (typeof inputRef === 'function') inputRef(el);
    else if (inputRef) inputRef.current = el;
  };

  const hasError = !!error;
  const ringOn = focused && !hasError;

  // Odak geçişi UI thread'de animasyonlu (remount/blink yok).
  const ring = useSharedValue(0);
  useEffect(() => {
    ring.value = withTiming(ringOn ? 1 : 0, {
      duration: FOCUS_MS,
      easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(ring);
  }, [ringOn, ring]);

  const ringStyle = useAnimatedStyle(() => ({ opacity: ring.value }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: ring.value * 0.07 }));

  // Göster/gizle: odak KAYBEDİLMEZ ve klavye AÇIK KALIR.
  const toggleSecure = () => {
    setHidden((v) => !v);
    const el = localInputRef.current;
    if (
      el &&
      typeof el.isFocused === 'function' &&
      !el.isFocused() &&
      typeof el.focus === 'function'
    ) {
      el.focus();
    }
  };

  return (
    <View
      ref={containerRef}
      collapsable={containerRef ? false : undefined}
      style={[styles.wrap, style]}
    >
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.box,
          { backgroundColor: C.surfaceLight, borderColor: hasError ? C.danger : C.border },
          ringOn ? glow(C.primary, { opacity: 0.16, radius: 14, offset: 0, elevation: 0 }) : null,
          !editable && styles.boxDisabled,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.overlay,
            { backgroundColor: C.primary, borderRadius: radius.control },
            fillStyle,
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.overlay,
            styles.ring,
            { borderColor: C.primary, borderRadius: radius.control },
            ringStyle,
          ]}
        />
        <View style={styles.row}>
          {icon ? (
            <Icon
              name={icon}
              size={16}
              color={hasError ? C.danger : ringOn ? C.primary : C.textMuted}
              style={styles.icon}
            />
          ) : null}
          <TextInput
            {...rest}
            ref={setInputRef}
            placeholderTextColor={C.textMuted}
            style={[styles.input, { color: C.text }, !editable && styles.inputDisabled, inputStyle]}
            editable={editable}
            secureTextEntry={secure ? hidden : secureTextEntry}
            onFocus={(e) => {
              if (!controlled) setInnerFocus(true);
              if (onFocus) onFocus(e);
            }}
            onBlur={(e) => {
              if (!controlled) setInnerFocus(false);
              if (onBlur) onBlur(e);
            }}
            accessibilityLabel={rest.accessibilityLabel || rest.placeholder || label}
          />
          {secure ? (
            <Pressable
              onPress={toggleSecure}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={hidden ? 'Şifreyi göster' : 'Şifreyi gizle'}
              accessibilityState={{ hidden }}
              style={styles.reveal}
            >
              <Icon
                name={hidden ? 'eye-outline' : 'eye'}
                size={18}
                color={ringOn ? C.primary : C.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
      {hasError ? (
        <View style={styles.msgRow} accessibilityRole="alert">
          <Icon name="alert-circle" size={13} color={C.danger} />
          <Text style={[styles.msg, { color: C.danger }]}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={[styles.msg, hintColor ? { color: hintColor } : null]}>{hint}</Text>
      ) : null}
    </View>
  );
}

function makeStyles(C, radius, type, space) {
  return StyleSheet.create({
    wrap: {
      gap: space.sm,
    },
    label: {
      color: C.textMuted,
      ...type.label,
    },
    box: {
      borderWidth: 1,
      borderRadius: radius.control,
      position: 'relative',
    },
    boxDisabled: {
      opacity: 0.55,
    },
    // Odak katmanları: mutlak konumlu, dokunuş almaz (pointerEvents:none).
    overlay: {
      ...StyleSheet.absoluteFillObject,
    },
    ring: {
      borderWidth: 1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      minHeight: 48,
      paddingHorizontal: space.lg,
    },
    icon: {
      marginRight: 0,
    },
    input: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      paddingVertical: 0,
    },
    inputDisabled: {
      opacity: 0.7,
    },
    reveal: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
    },
    msgRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    msg: {
      color: C.textMuted,
      ...type.small,
    },
  });
}
