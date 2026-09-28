// ============================================================
// AppTextField.js — Ortak premium input primitive'i.
// Durumlar: focus (border + glow), error (danger border + satır içi
// metin), disabled, hint (açıklayıcı satır). AuthScreen ve formlarda
// TEK görsel dil sağlar (odak davranışı her yerde aynı).
// `focused` prop'u verilirse dışarıdan yönetilir (AuthScreen modu);
// verilmezse bileşen kendi odağını yönetir.
// ============================================================
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import Icon from './icons';

export default function AppTextField({
  icon,
  label,
  hint,
  error,
  focused: focusedProp,
  onFocus,
  onBlur,
  style,
  inputStyle,
  editable = true,
  ...rest
}) {
  const { colors: C, radius, glow } = useTheme();
  const [innerFocus, setInnerFocus] = useState(false);
  const controlled = focusedProp !== undefined;
  const focused = controlled ? focusedProp : innerFocus;
  const styles = useMemo(() => makeStyles(C, radius), [C, radius]);

  const borderColor = error ? C.danger : focused ? C.primary : C.border;
  const hasError = !!error;

  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.box,
          {
            backgroundColor: C.surfaceLight,
            borderColor,
          },
          focused && !hasError
            ? glow(C.primary, { opacity: 0.16, radius: 14, offset: 0, elevation: 0 })
            : null,
          !editable && styles.boxDisabled,
        ]}
      >
        {icon ? (
          <Icon
            name={icon}
            size={16}
            color={hasError ? C.danger : focused ? C.primary : C.textMuted}
            style={styles.icon}
          />
        ) : null}
        <TextInput
          placeholderTextColor={C.textMuted}
          style={[styles.input, { color: C.text }, !editable && styles.inputDisabled, inputStyle]}
          editable={editable}
          onFocus={(e) => {
            if (!controlled) setInnerFocus(true);
            if (onFocus) onFocus(e);
          }}
          onBlur={(e) => {
            if (!controlled) setInnerFocus(false);
            if (onBlur) onBlur(e);
          }}
          accessibilityLabel={rest.accessibilityLabel || rest.placeholder || label}
          {...rest}
        />
      </View>
      {hasError ? (
        <View style={styles.msgRow} accessibilityRole="alert">
          <Icon name="alert-circle" size={13} color={C.danger} />
          <Text style={[styles.msg, { color: C.danger }]}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.msg}>{hint}</Text>
      ) : null}
    </View>
  );
}

function makeStyles(C, radius) {
  return StyleSheet.create({
    wrap: {
      gap: 6,
    },
    label: {
      color: C.textMuted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 50,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderRadius: radius.control,
    },
    boxDisabled: {
      opacity: 0.55,
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
    msgRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    msg: {
      color: C.textMuted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
    },
  });
}
