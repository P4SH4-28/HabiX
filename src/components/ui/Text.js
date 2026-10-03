// ============================================================
// ui/Text.js — Uygulamanın TEK metin bileşeni.
//
// Kural: react-native'den `Text` import etmek YASAK (widget dosyaları hariç).
// Her <Text> buradan gelir; tipografi garantisi burada zorlanır:
//
//   • lineHeight garantisi: token verildiğinde token lineHeight'ı;
//     yalnız fontSize varsa fontSize x 1.4 (yuvarlanmış) üretilir.
//     Hiçbir metin lineHeight'sız render edilmez.
//   • variant verilen yerde token'ın fontSize/letterSpacing/textTransform/
//     fontVariant değerleri style'da override edilmedikçe uygulanır.
//   • weight/align/color prop'ları style'ı ezer (override).
//   • numberOfLines: micro/label/h1/h3/stat/display ölçeklerinde, içerik tek
//     parça ve kısa ise (< 30 karakter) varsayılan 1 — etiket/başlık ortadan
//     bölünmez, uzun açıklamalar sarmalanmaya devam eder. Açıkça verilen
//     değer her zaman kazanır (numberOfLines={0} ile sınırsız yapılabilir).
//   • ellipsizeMode varsayılanı 'tail'.
//   • color verilmemiş üst metinde C.text uygulanır — iç içe (nested) metinde
//     uygulanmaz, RN kalıtımı bozulmasın diye.
//   • allowFontScaling varsayılanı false + maxFontSizeMultiplier 1.2.
//     Global koruma: react-native yaması (patches/react-native+0.86.2.patch)
//     çünkü React 19 + automatic JSX runtime `defaultProps` uygulamıyor.
// ============================================================
import React, { createContext, forwardRef, memo, useContext } from 'react';
import { StyleSheet, Text as RNText } from 'react-native';
import { useTheme, TYPE } from '../../theme';
import { scaleForSize, lineHeightFor } from '../../theme/typography';

// İç içe metin tespiti: alt metnin rengi üstten kalıtılırsa dokunma.
const NestedTextContext = createContext(false);

// Varsayılan tek satır davranışı olan ölçek/variantlar.
// Açıklama/paragraf metinleri buraya girmez (uzun içerikte sarmalanır).
const SINGLE_LINE_SCALES = new Set([
  'micro',
  'label',
  'h1',
  'h3',
  'stat',
  'statSm',
  'display',
  'displayXl',
]);

// Tek parça ve kısa içerikte tek satır davranışı uygulanır:
// etiket/başlık taşması ortadan iki bölünme yerine "…" ile sonuçlanır,
// uzun açıklamalar sarmalanmaya devam eder (içerik kaybı olmaz).
const SHORT_TEXT_LIMIT = 30;

function isShortContent(children) {
  if (typeof children === 'number') return true;
  if (typeof children === 'string') return children.length <= SHORT_TEXT_LIMIT;
  return false;
}

function TextComponent(
  {
    variant,
    color,
    weight,
    align,
    numberOfLines,
    ellipsizeMode = 'tail',
    allowFontScaling = false,
    maxFontSizeMultiplier = 1.2,
    style,
    children,
    ...rest
  },
  ref
) {
  const { colors: C } = useTheme();
  const nested = useContext(NestedTextContext);
  const flat = StyleSheet.flatten(style) || null;
  const token = variant ? TYPE[variant] : null;

  const computed = {};

  if (token) {
    // Explicit variant → token alanları (style'da olanlar korunur).
    if (!flat || flat.fontSize == null) computed.fontSize = token.fontSize;
    if (!flat || flat.lineHeight == null) computed.lineHeight = token.lineHeight;
    if (!flat || flat.fontWeight == null) computed.fontWeight = token.fontWeight;
    if (!flat || flat.letterSpacing == null) computed.letterSpacing = token.letterSpacing;
    if (token.textTransform && (!flat || flat.textTransform == null)) {
      computed.textTransform = token.textTransform;
    }
    if (token.fontVariant && (!flat || flat.fontVariant == null)) {
      computed.fontVariant = token.fontVariant;
    }
  } else if (flat && flat.fontSize != null && flat.lineHeight == null) {
    // Variant yoksa bile lineHeight garantisi (kural: lineHeight'sız fontSize YOK).
    computed.lineHeight = lineHeightFor(flat.fontSize, scaleForSize(flat.fontSize));
  }

  if (weight != null) computed.fontWeight = String(weight);
  if (align != null) computed.textAlign = align;

  const resolvedColor =
    color != null ? color : flat && flat.color != null ? flat.color : nested ? undefined : C.text;
  if (resolvedColor != null) computed.color = resolvedColor;

  const scaleKey =
    variant || (flat && flat.fontSize != null ? scaleForSize(flat.fontSize) : null);
  const resolvedLines =
    numberOfLines != null
      ? numberOfLines
      : scaleKey && SINGLE_LINE_SCALES.has(scaleKey) && isShortContent(children)
        ? 1
        : undefined;

  return (
    <NestedTextContext.Provider value={true}>
      <RNText
        ref={ref}
        allowFontScaling={allowFontScaling}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        numberOfLines={resolvedLines}
        ellipsizeMode={resolvedLines != null ? ellipsizeMode : undefined}
        style={[style, computed]}
        {...rest}
      >
        {children}
      </RNText>
    </NestedTextContext.Provider>
  );
}

const Text = memo(forwardRef(TextComponent));
Text.displayName = 'Text';

export default Text;
