// ============================================================
// TextInput.js — Form alanı primitive'i (v3)
//
//   Yapı: label (micro/uppercase) → alan → error|hint
//   Alan : surface zemin · 1px border · radius md(12) · yükseklik 48
//   Focus: border primary'ye 150ms ease-out geçiş (cancelAnimation cleanup)
//   Error : border + yazı danger. Error VARKEN focus kenarlığı ezmez.
//   Sağ ikon: şifre göster/gizle gibi eylemler (onRightIconPress).
//
//   Erişilebilirlik: accessibilityLabel = label, accessibilityHint = error/hint.
//   forwardRef → RN TextInput'a ref; containerRef → dış kapsayıcıya ref.
//   GLOW YOK · LOOP YOK.
// ============================================================
import { forwardRef, memo, useEffect, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput as RNTextInput,
  View
} from 'react-native';
import Text from './Text';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import useReducedMotion from '../../hooks/useReducedMotion';
import { DURATION, EASE, useTheme } from '../../theme';

const FIELD_HEIGHT = 48;
const LINE = 22; // body lineHeight

const TextInput = forwardRef(function AppTextInput(
  {
    label,
    value,
    onChangeText,
    placeholder,
    secureTextEntry = false,
    keyboardType = 'default',
    autoCapitalize = 'sentences',
    autoCorrect = false,
    multiline = false,
    numberOfLines = 1,
    error,
    hint,
    icon,
    rightIcon,
    onRightIconPress,
    editable = true,
    containerRef,
    onFocus,
    onBlur,
    style,
    ...rest
  },
  ref
) {
  const { colors: C, radius, type } = useTheme();
  const reduced = useReducedMotion();
  const styles = useMemo(() => makeStyles(C, radius, type), [C, radius, type]);

  const progress = useSharedValue(0);
  // Prensip: animasyon başlatan her bileşen unmount olurken iptal etmeli.
  useEffect(() => () => cancelAnimation(progress), [progress]);

  // Error varsa odak renk geçişi bastırılır (error her zaman kazanır).
  const borderBase = error ? C.danger : C.border;
  const borderActive = error ? C.danger : C.primary;
  const animatedBorder = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [borderBase, borderActive]),
  }));

  const duration = reduced ? 0 : DURATION.fast;
  const handleFocus = (e) => {
    progress.value = withTiming(1, {
      duration,
      easing: Easing.bezier(...EASE.out),
    });
    if (onFocus) onFocus(e);
  };
  const handleBlur = (e) => {
    progress.value = withTiming(0, {
      duration,
      easing: Easing.bezier(...EASE.out),
    });
    if (onBlur) onBlur(e);
  };

  const fieldSize = multiline
    ? {
        minHeight: FIELD_HEIGHT + Math.max(0, numberOfLines - 1) * LINE,
        paddingTop: 12,
        paddingBottom: 12,
        alignItems: 'flex-start',
      }
    : { height: FIELD_HEIGHT, alignItems: 'center' };

  return (
    <View ref={containerRef} style={[styles.container, style]}>
      {label ? <Text variant="micro" style={styles.label}>{label}</Text> : null}

      <Animated.View
        style={[styles.field, fieldSize, animatedBorder, !editable && styles.disabled]}
      >
        {icon ? <View style={styles.affixLeft}>{icon}</View> : null}

        <RNTextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[styles.input, multiline && styles.inputMultiline]}
          accessibilityLabel={label}
          accessibilityHint={error || hint}
          {...rest}
        />

        {rightIcon ? (
          <Pressable
            onPress={onRightIconPress}
            hitSlop={10}
            style={styles.affixRight}
            accessibilityRole="button"
          >
            {rightIcon}
          </Pressable>
        ) : null}
      </Animated.View>

      {error ? (
        <Text variant="small" style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text variant="small" style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

function makeStyles(C, radius, type) {
  return StyleSheet.create({
    container: { alignSelf: 'stretch' },
    label: {
      ...type.micro,
      color: C.textMuted,
      marginBottom: 6,
      lineHeight: 16,
    },
    field: {
      flexDirection: 'row',
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: radius.md,
      paddingHorizontal: 14,
      gap: 8,
    },
    disabled: { opacity: 0.5 },
    affixLeft: { justifyContent: 'center' },
    affixRight: { justifyContent: 'center' },
    input: {
      flex: 1,
      ...type.body,
      color: C.text,
      padding: 0,
      margin: 0,
      minWidth: 0,
      lineHeight: 22,
    },
    inputMultiline: { textAlignVertical: 'top' },
    error: {
      ...type.small,
      color: C.danger,
      marginTop: 6,
      lineHeight: 20,
    },
    hint: {
      ...type.small,
      color: C.textMuted,
      marginTop: 6,
      lineHeight: 20,
    },
  });
}

export default memo(TextInput);
