// ============================================================
// i18n.test.js — Dil altyapısı garantileri (7 dil: tr + en/de/fr/es/ru/ar)
//
// 1) Anahtar seti 7 dilde BİREBİR aynı (eksik çeviri = kırık ekran değil,
//    ama sessiz kalması istenmez → test düşer).
// 2) t(): fallback (seçili dil → tr → anahtar) ve {{var}} interpolation.
// 3) plural(): RU (one/few/many) ve genel tek/çok biçim.
// 4) Biçimlendirme ve dil etiketleri.
//
// react-native Node ortamında doğrudan import edilemez (flow dosyaları);
// RTL/ekran tarafı mock'lanır — gerçek cihaz davranışı cihazda doğrulanır.
// ============================================================
jest.mock('react-native', () => ({
  I18nManager: { allowRTL: jest.fn(), forceRTL: jest.fn(), isRTL: false },
  Platform: { OS: 'ios' },
}));

import {
  LANG_LABELS,
  LOCALES,
  dayNameShort,
  formatNumber,
  formatDate,
  getLocale,
  needsRTLRestart,
  plural,
  setLocale,
  t,
} from '../../src/i18n';
import tr from '../../src/i18n/locales/tr';
import en from '../../src/i18n/locales/en';
import de from '../../src/i18n/locales/de';
import fr from '../../src/i18n/locales/fr';
import es from '../../src/i18n/locales/es';
import ru from '../../src/i18n/locales/ru';
import ar from '../../src/i18n/locales/ar';

const DICTS = { tr, en, de, fr, es, ru, ar };

afterEach(() => {
  setLocale('tr');
});

describe('locale dosyaları', () => {
  test('7 dil dosyası var ve anahtar setleri birebir aynı', () => {
    const base = Object.keys(tr).sort();
    expect(base.length).toBeGreaterThan(0);
    for (const code of LOCALES) {
      expect(Object.keys(DICTS[code]).sort()).toEqual(base);
    }
  });

  test('hiçbir dilde boş değer yok', () => {
    for (const code of LOCALES) {
      for (const [key, value] of Object.entries(DICTS[code])) {
        expect(typeof value).toBe('string');
        expect(value.trim()).not.toBe('');
      }
    }
  });

  test('interpolation yer tutucuları diller arası tutarlı', () => {
    const placeholders = (value) =>
      (String(value).match(/\{\{\s*\w+\s*\}\}/g) || []).sort().join(',');
    for (const key of Object.keys(tr)) {
      const expected = placeholders(tr[key]);
      for (const code of LOCALES) {
        expect(placeholders(DICTS[code][key])).toBe(expected);
      }
    }
  });

  test('dil etiketleri (bayrak + ad) eksiksiz', () => {
    for (const code of LOCALES) {
      expect(LANG_LABELS[code].name).toBeTruthy();
      expect(LANG_LABELS[code].flag).toBeTruthy();
    }
  });
});

describe('t()', () => {
  test('seçili dilde çevirir', () => {
    setLocale('en');
    expect(t('app.tab.home')).toBe('Today');
    setLocale('de');
    expect(t('app.tab.home')).toBe('Heute');
  });

  test('{{var}} interpolation', () => {
    setLocale('tr');
    expect(t('app.banned.reason', { reason: 'spam' })).toBe('Gerekçe: spam');
    setLocale('en');
    expect(t('app.banned.reason', { reason: 'spam' })).toBe('Reason: spam');
  });

  test('eksik anahtar → tr fallback, o da yoksa anahtarın kendisi', () => {
    setLocale('tr');
    expect(t('olmayan.anahtar')).toBe('olmayan.anahtar');
    expect(t('')).toBe('');
    expect(t(null)).toBe('');
  });
});

describe('dil ve RTL', () => {
  test('setLocale geçerli dili kurar, geçersizde tr\'ye düşer', () => {
    setLocale('ru');
    expect(getLocale()).toBe('ru');
    setLocale('xx');
    expect(getLocale()).toBe('tr');
  });

  test('RTL yalnız Arapça: ar seçilince yeniden başlatma gerekir', () => {
    setLocale('en');
    expect(needsRTLRestart()).toBe(false);
    setLocale('ar');
    expect(needsRTLRestart()).toBe(true);
  });
});

describe('plural() ve biçimlendirme', () => {
  test('rusça 3 biçim (one/few/many)', () => {
    setLocale('ru');
    const forms = { one: 'a', few: 'b', many: 'c' };
    expect(plural(1, forms)).toBe('a');
    expect(plural(3, forms)).toBe('b');
    expect(plural(5, forms)).toBe('c');
    expect(plural(21, forms)).toBe('a');
  });

  test('tek/çok biçim (tr/en)', () => {
    setLocale('tr');
    expect(plural(1, { one: 'x', other: 'y' })).toBe('x');
    expect(plural(0, { one: 'x', other: 'y' })).toBe('y');
    expect(plural(7, { one: 'x', other: 'y' })).toBe('y');
  });

  test('formatDate / formatNumber / dayNameShort döner', () => {
    setLocale('tr');
    expect(formatDate(new Date(2026, 0, 5))).toMatch(/2026/);
    expect(formatNumber(1234)).toMatch(/1.?234|1,234/);
    expect(dayNameShort(new Date(2026, 0, 5))).toBeTruthy();
  });
});
