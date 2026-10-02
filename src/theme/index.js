// ============================================================
// theme/index.js — Design System v3 girişi
// (Apple Fitness/Headspace zemini + Linear tipografi disiplini)
//
// Token dosyaları:
//   colors.js      → C.background / C.primary / ...  (4 nötr + 3 anlamsal + yardımcı)
//   typography.js  → type.micro/small/body/h3/h1     (5 ölçek, 3 weight, 1.4x line)
//   spacing.js     → space.xs..5xl  (4-8-12-16-20-24-32-40-48 grid)
//   radius.js      → radius.sm/md/lg/xl/full (4 + full, semantic alias)
//   shadows.js     → SHADOWS.card (tek gölge, elevated) · glow() no-op
//   animations.js  → DURATION(fast/normal/slow) / EASE / MOTION · LOOP = null
//
// ---------- DIŞ YÜZEY (DEĞİŞMEZ — 59 import eden dosya) ----------
//   export { COLORS, SPACE, TYPE, RADIUS, SHADOWS, glow,
//            DURATION, EASE, MOTION, LOOP, TOUCH, tint,
//            EMOJIS, HABIT_COLORS, THEMES,
//            getTheme, resolveTheme, ThemeProvider, useTheme, useAnimation }
//   useTheme()     → { colors, radius, space, type, motion, touch, glow }
//   useAnimation() → { duration, ease }   (süre + easing token'ları)
//
// ---------- YENİ (v3) — design tooling ----------
//   export { COLOR_GROUPS, FONT_WEIGHTS, SPACE_STEPS, CARD_PADDING }
//
// THEMES: Dükkan'da satılan tema tanımları. v3 kimliği: TÜM temalarda
// zemin ortak (background token'ı — tema override'ı YOK); tema rengi yalnızca
// yüzey tonu + primary/accent'te yaşar.
// ============================================================
import { createContext, useContext } from 'react';
import { COLORS, COLOR_GROUPS } from './colors';
import { SPACE, SPACE_STEPS, CARD_PADDING } from './spacing';
import { TYPE, FONT_WEIGHTS } from './typography';
import { RADIUS } from './radius';
import { SHADOWS, glow } from './shadows';
import { DURATION, EASE, MOTION, LOOP } from './animations';

export {
  COLORS,
  SPACE,
  TYPE,
  RADIUS,
  SHADOWS,
  glow,
  DURATION,
  EASE,
  MOTION,
  LOOP,
  // v3 design tooling
  COLOR_GROUPS,
  FONT_WEIGHTS,
  SPACE_STEPS,
  CARD_PADDING,
};

// Minimum dokunma hedefi (erişilebilirlik): 44pt Apple / 48dp Material.
export const TOUCH = { min: 44 };

// Renk alpha üretici: tint(C.surface, '1A') → `${C.surface}1A`.
export function tint(color, hexAlpha = '1A') {
  return `${color}${hexAlpha}`;
}

// Alışkanlık oluştururken seçilebilecek semboller (EmojiPicker).
export const EMOJIS = [
  '💧', '🏃', '📖', '🧘', '💪', '🍎', '🎨', '🎸',
  '✍️', '🧹', '💻', '🚶', '🌅', '😴', '🥗', '📵',
  '🌊', '🔥', '⚽', '🎵', '📷', '🌱', '🍵', '💊',
  '💡', '🧠', '🎯', '🚿', '🛌', '🧦', '🦷', '⏰',
];

// Alışkanlık oluştururken seçilebilecek renkler (ColorPicker).
// NOT: Bu kullanıcı-seçimli palet; ekran-başı renk kuralı buraya uygulanmaz.
export const HABIT_COLORS = [
  '#7C5CFF', '#22D3A5', '#38BDF8', '#F59E0B', '#F0436E',
  '#4ADE80', '#C084FC', '#F472B6', '#EF4444', '#60A5FA',
];

// Tema tanımları. "colors" yalnızca COLORS'tan farklı olanları içerir.
// v3 hizalama: background TEMADA OVERRIDE EDİLMEZ → tüm temalar
// colors.background (#0A0A0F) kullanır; tema yalnızca yüzey tonu + primary'dir.
// primary/primaryDark/accent/text* tema kimliğidir — DOKUNULMAZ.
export const THEMES = [
  {
    id: 'dark',
    name: 'Gece',
    emoji: '🌑',
    price: 0,
    desc: 'Klasik koyu tema',
    pattern: null,
    colors: {},
  },
  {
    id: 'mono',
    name: 'Siyah Beyaz',
    emoji: '⚫',
    price: 0,
    desc: 'Sade ve şık monokrom',
    pattern: null,
    colors: {
      surface: '#19191D',
      surfaceLight: '#28282D',
      border: '#28282C',
      primary: '#F5F5F5',
      primaryDark: '#C9C9CE',
      accent: '#9E9EA6',
      text: '#F2F2F4',
      textMuted: '#8F8F98',
      xp: '#D8D8DE',
      gold: '#CFCFD6',
      silver: '#A9A9B0',
      bronze: '#8A8A92',
      onPrimary: '#0B0B0D',
    },
  },
  {
    id: 'heart',
    name: 'Kalpli',
    emoji: '❤️',
    price: 300,
    desc: 'Sevimli kalp deseni',
    pattern: '❤️',
    colors: {
      onPrimary: '#0A0A0F',
      surface: '#23121E',
      surfaceLight: '#381C2D',
      border: '#381C2E',
      primary: '#FF5C8A',
      primaryDark: '#D94371',
      accent: '#FF8FB0',
    },
  },
  {
    id: 'forest',
    name: 'Orman',
    emoji: '🌲',
    price: 350,
    desc: 'Yeşilin huzuru',
    pattern: '🌲',
    colors: {
      textMuted: '#9797A5',
      onPrimary: '#0A0A0F',
      surface: '#142118',
      surfaceLight: '#213327',
      border: '#223226',
      primary: '#4ADE80',
      primaryDark: '#36B962',
      accent: '#86EFAC',
    },
  },
  {
    id: 'ocean',
    name: 'Okyanus',
    emoji: '🌊',
    price: 350,
    desc: 'Derin mavi dalgalar',
    pattern: '🌊',
    colors: {
      textMuted: '#9494A3',
      onPrimary: '#0A0A0F',
      surface: '#101F25',
      surfaceLight: '#19303B',
      border: '#192E3B',
      primary: '#22D3EE',
      primaryDark: '#17A9C6',
      accent: '#2DD4BF',
    },
  },
  {
    id: 'lavender',
    name: 'Lavanta',
    emoji: '💜',
    price: 400,
    desc: 'Yumuşak mor tonlar',
    pattern: '💜',
    colors: {
      onPrimary: '#0A0A0F',
      surface: '#181125',
      surfaceLight: '#261B39',
      border: '#261C38',
      primary: '#C084FC',
      primaryDark: '#A05FE0',
      accent: '#E9D5FF',
    },
  },
  {
    id: 'sunset',
    name: 'Gün Batımı',
    emoji: '🌅',
    price: 400,
    desc: 'Turuncu-pembe ufuk',
    pattern: '🌅',
    colors: {
      textMuted: '#8F8F9E',
      onPrimary: '#0A0A0F',
      surface: '#241611',
      surfaceLight: '#3A231A',
      border: '#3A241A',
      primary: '#FF8A5C',
      primaryDark: '#E06E42',
      accent: '#FFC46B',
    },
  },
  {
    id: 'galaxy',
    name: 'Galaksi',
    emoji: '🌌',
    price: 450,
    desc: 'Yıldız tozu deseni',
    pattern: '✨',
    colors: {
      onPrimary: '#0A0A0F',
      surface: '#101325',
      surfaceLight: '#191D3B',
      border: '#1A1E3A',
      primary: '#9164F6',
      primaryDark: '#6F3FE0',
      accent: '#38BDF8',
    },
  },
  {
    id: 'candy',
    name: 'Şekerleme',
    emoji: '🍬',
    price: 450,
    desc: 'Tatlı pembe-mor',
    pattern: '🍬',
    colors: {
      onPrimary: '#0A0A0F',
      surface: '#191125',
      surfaceLight: '#251B39',
      border: '#261B39',
      primary: '#F472B6',
      primaryDark: '#D7509B',
      accent: '#A78BFA',
    },
  },
  {
    id: 'cherry',
    name: 'Kiraz',
    emoji: '🍒',
    price: 500,
    desc: 'Kırmızı-pembe kiraz',
    pattern: '🍒',
    colors: {
      textMuted: '#8C8C9C',
      onPrimary: '#0A0A0F',
      surface: '#241221',
      surfaceLight: '#361E32',
      border: '#351F34',
      primary: '#FF4D6D',
      primaryDark: '#DE3357',
      accent: '#FF7A9E',
    },
  },
  {
    id: 'cyber',
    name: 'Siber',
    emoji: '🤖',
    price: 550,
    desc: 'Neon yeşil-mor',
    pattern: '🤖',
    colors: {
      textMuted: '#8F8F9E',
      surface: '#101A25',
      surfaceLight: '#1A2A3A',
      border: '#1B2B39',
      primary: '#00FFC2',
      primaryDark: '#00CC9B',
      accent: '#886BFF',
      onPrimary: '#00231A',
    },
  },
  {
    id: 'royal',
    name: 'Kraliyet',
    emoji: '👑',
    price: 600,
    desc: 'Altın ve mor ihtişam',
    pattern: '👑',
    colors: {
      onPrimary: '#0A0A0F',
      surface: '#161025',
      surfaceLight: '#22193B',
      border: '#22193B',
      primary: '#D4A92E',
      primaryDark: '#B38C1F',
      accent: '#E8C75A',
    },
  },
  {
    id: 'dragon',
    name: 'Ejderha',
    emoji: '🐲',
    price: 700,
    desc: 'Ateşli kırmızı-amber',
    pattern: '🐲',
    colors: {
      onPrimary: '#0A0A0F',
      surface: '#151124',
      surfaceLight: '#221B39',
      border: '#241D37',
      primary: '#EF4444',
      primaryDark: '#D02C2C',
      accent: '#F59E0B',
    },
  },
];

// Tema id'sine göre tema tanımını döndürür (yoksa varsayılan "Gece").
export function getTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

// Tema id'si için TAM renk sözlüğünü üretir (temel + tema farkları + desen).
// success ↔ accent alias'ı tema genelinde senkron kalır (accent'i override
// eden tema, success'i de aynı renge çeker).
export function resolveTheme(themeId) {
  const theme = getTheme(themeId);
  const colors = { ...COLORS, ...theme.colors, pattern: theme.pattern || null };
  if (theme.colors.accent && !theme.colors.success) {
    colors.success = theme.colors.accent;
  }
  return colors;
}

// ---------- Tema Context ----------
const ThemeContext = createContext({ colors: COLORS, radius: RADIUS, space: SPACE });

export const ThemeProvider = ThemeContext.Provider;

// Bileşenler useTheme() ile renk paletine + yapısal token'lara tek yerden erişir:
//   const { colors: C, radius, space, type, motion, glow } = useTheme();
// NOT: Dönüş yüzeyi DEĞİŞMEZ (geriye dönük uyum).
export function useTheme() {
  const ctx = useContext(ThemeContext);
  return {
    colors: ctx.colors || COLORS,
    radius: ctx.radius || RADIUS,
    space: ctx.space || SPACE,
    type: TYPE,
    motion: MOTION,
    touch: TOUCH,
    glow,
  };
}

// Hareket token'larına tek yerden erişim:
//   const { duration, ease } = useAnimation();
//   withTiming(x, { duration: duration.fast, easing: Easing.bezier(...ease.out) })
export function useAnimation() {
  return {
    duration: DURATION,
    ease: EASE,
  };
}
