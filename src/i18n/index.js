// ============================================================
// src/i18n/index.js — Mini i18n (7 dil: tr kaynak + en/de/fr/es/ru/ar)
//
// TASARIM
//   - Anahtarlar düz ve noktalı: 'settings.language.auto'
//   - KAYNAK dil TR: eksik anahtar önce seçili dilde, sonra tr'de, o da
//     yoksa anahtarın kendisinde biter (uygulama asla çökmez).
//   - Modül store (currentLocale + subscribe): React DIŞINDAKİ kod da
//     t() kullanabilir (servisler, DataContext toast'ları, notification).
//   - useT(): useSyncExternalStore → dil değişince bileşen yeniden render.
//   - RTL: yalnız ARAPÇA. forceRTL kalıcıdır ve SONRAKİ açılışta uygulanır;
//     bu yüzden needsRTLRestart() true dönerse "uygulamayı kapatıp aç" uyarısı
//     gösterilir (expo-updates kurulu değil → anlık reload yok).
//
// KULLANIM
//   import { useT, t } from '../i18n';
//   const t = useT();            // bileşenlerde (re-render alır)
//   t('app.tab.home')            // 'Bugün'
//   t('app.banned.reason', { reason })  // {{reason}} yerine konur
// ============================================================
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import { I18nManager } from 'react-native';
import ar from './locales/ar';
import de from './locales/de';
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import ru from './locales/ru';
import tr from './locales/tr';

// ---------- Diller ----------
export const LOCALES = ['tr', 'en', 'de', 'fr', 'es', 'ru', 'ar'];

// Arayüzde her dil KENDİ adıyla listelenir (seçim listesi + mevcut değer).
export const LANG_LABELS = {
  tr: { flag: '🇹🇷', name: 'Türkçe' },
  en: { flag: '🇬🇧', name: 'English' },
  de: { flag: '🇩🇪', name: 'Deutsch' },
  fr: { flag: '🇫🇷', name: 'Français' },
  es: { flag: '🇪🇸', name: 'Español' },
  ru: { flag: '🇷🇺', name: 'Русский' },
  ar: { flag: '🇸🇦', name: 'العربية' },
};

const DICTS = { tr, en, de, fr, es, ru, ar };

const DEV =
  typeof __DEV__ !== 'undefined'
    ? !!__DEV__
    : typeof process !== 'undefined' && process && process.env && process.env.NODE_ENV !== 'production';

// expo-localization native modüldür; Node (jest) ortamında yüklenemeyebilir.
let readDeviceLocales = null;
try {
  const loc = require('expo-localization');
  readDeviceLocales = loc && typeof loc.getLocales === 'function' ? loc.getLocales : null;
} catch (e) {
  readDeviceLocales = null;
}

// ---------- Store ----------
let currentLocale = 'tr';
let wantRTL = false;
const listeners = new Set();

export function getLocale() {
  return currentLocale;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      // Dinleyici hatası yayılmaz (tek dinleyici tüm aboneleri bozmasın).
    }
  });
}

// RTL yalnızca Arapça içindir; izin baştan verilir ki forceRTL etkili olsun.
try {
  I18nManager.allowRTL(true);
} catch (e) {
  // Platform desteklemiyorsa sessiz geç.
}

/**
 * Geçerli dili ayarlar ve (gerekirse) RTL yönünü günceller.
 * forceRTL değişikliği cihazda ancak uygulama yeniden açıldığında görünür.
 */
export function setLocale(locale) {
  const next = LOCALES.includes(locale) ? locale : 'tr';
  currentLocale = next;
  const rtl = next === 'ar';
  wantRTL = rtl;
  try {
    if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl);
  } catch (e) {
    // RTL desteklenmiyorsa yalnız dil değişir.
  }
  notify();
}

/** Seçili dil yönü ile cihazın mevcut yönü farklıysa yeniden başlatma gerekir. */
export function needsRTLRestart() {
  return I18nManager.isRTL !== wantRTL;
}

export function isRTLLocale(locale) {
  return (locale || currentLocale) === 'ar';
}

/** Cihaz dili desteklenen listede değilse 'tr'. */
export function deviceLocale() {
  try {
    const loc = readDeviceLocales ? readDeviceLocales()[0] : null;
    const raw = String((loc && (loc.languageCode || loc.languageTag)) || '').toLowerCase();
    const code = raw.split('-')[0];
    return LOCALES.includes(code) ? code : 'tr';
  } catch (e) {
    return 'tr';
  }
}

// ---------- Çeviri ----------
const warned = new Set();

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) =>
    vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : match
  );
}

/**
 * Anahtar çevirisi. Yok: seçili dil → tr → anahtarın kendisi.
 * Vars: {{name}} yerine konur.
 */
export function t(key, vars) {
  if (key === null || key === undefined || key === '') return '';
  const dict = DICTS[currentLocale] || DICTS.tr;
  let raw = dict[key];
  if (raw === undefined && currentLocale !== 'tr') raw = DICTS.tr[key];
  if (raw === undefined) {
    const id = currentLocale + ':' + key;
    if (DEV && !warned.has(id)) {
      warned.add(id);
      console.warn('[i18n] eksik anahtar:', key, '(' + currentLocale + ')');
    }
    return key;
  }
  return interpolate(raw, vars);
}

export default t;

// ---------- React ----------
const I18nContext = createContext({ locale: 'tr' });

function useStoreLocale() {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
}

/** Kök: dil değişiminde i18n'e bağlı tüm tüketici bileşenler yenilenir. */
export function I18nProvider({ children }) {
  const locale = useStoreLocale();
  const value = useMemo(() => ({ locale }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Geçerli dil kodu (re-render alır). */
export function useLocale() {
  useStoreLocale();
  const ctx = useContext(I18nContext);
  return ctx && ctx.locale ? ctx.locale : currentLocale;
}

/** Bileşenlerde çeviri fonksiyonu (dil değişince yeniden render). */
export function useT() {
  useStoreLocale();
  return t;
}

// ---------- Biçimlendirme ----------
const DAY_FALLBACK = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const DAY_FIRST = { tr: true, de: true, fr: true, ru: true, es: true, ar: true };

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** 'DD.MM.YYYY' (gün-öncelikli) veya 'MM/DD/YYYY'. */
export function formatDate(value) {
  const d = toDate(value);
  try {
    return new Intl.DateTimeFormat(currentLocale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch (e) {
    const yyyy = d.getFullYear();
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    return DAY_FIRST[currentLocale] ? `${dd}.${mm}.${yyyy}` : `${mm}/${dd}/${yyyy}`;
  }
}

/** Tarih + saat ('HH:MM'). */
export function formatDateTime(value) {
  const d = toDate(value);
  try {
    return new Intl.DateTimeFormat(currentLocale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch (e) {
    return `${formatDate(d)} ${formatTime(d)}`;
  }
}

/** 'HH:MM' (24 saat). */
export function formatTime(value) {
  const d = toDate(value);
  try {
    return new Intl.DateTimeFormat(currentLocale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch (e) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
}

export function formatNumber(value) {
  try {
    return new Intl.NumberFormat(currentLocale).format(value);
  } catch (e) {
    return String(value);
  }
}

/** '3 gün önce' / 'yarın' gibi göreli zaman. */
export function formatRelative(value) {
  const d = toDate(value);
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  try {
    const rtf = new Intl.RelativeTimeFormat(currentLocale, { numeric: 'auto' });
    if (abs >= 86400000) return rtf.format(Math.round(diff / 86400000), 'day');
    if (abs >= 3600000) return rtf.format(Math.round(diff / 3600000), 'hour');
    if (abs >= 60000) return rtf.format(Math.round(diff / 60000), 'minute');
    return rtf.format(0, 'minute');
  } catch (e) {
    return formatDate(d);
  }
}

/** Haftanın kısa gün adı ('Pzt' / 'Mon' / 'Mo'). */
export function dayNameShort(value) {
  const d = toDate(value);
  try {
    return new Intl.DateTimeFormat(currentLocale, { weekday: 'short' })
      .format(d)
      .replace(/\.$/, '');
  } catch (e) {
    return DAY_FALLBACK[d.getDay()];
  }
}

// Intl.PluralRules yoksa kullanılacak yedek kurallar (RU 3, AR 6 biçim).
function fallbackPlural(locale, n, forms) {
  const pick = (category) => {
    if (forms[category] !== undefined) return forms[category];
    if (forms.other !== undefined) return forms.other;
    return forms.one || '';
  };
  if (locale === 'ru') {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return pick('one');
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return pick('few');
    return pick('many');
  }
  if (locale === 'ar') {
    if (n === 0) return pick('zero');
    if (n === 1) return pick('one');
    if (n === 2) return pick('two');
    const m100 = n % 100;
    if (m100 >= 3 && m100 <= 10) return pick('few');
    if (m100 >= 11 && m100 <= 99) return pick('many');
    return pick('other');
  }
  return pick(n === 1 ? 'one' : 'other');
}

/**
 * Çoğul metin. forms: { one, other, few?, many?, zero?, two? }
 * Türkçe tek biçim verdiği için genelde { one, other } yeterlidir.
 */
export function plural(count, forms) {
  const n = Number(count);
  const value = Number.isFinite(n) ? n : 0;
  try {
    const category = new Intl.PluralRules(currentLocale).select(value);
    if (forms[category] !== undefined) return forms[category];
  } catch (e) {
    // Intl yok → yedek kurallar aşağıda.
  }
  return fallbackPlural(currentLocale, value, forms);
}
