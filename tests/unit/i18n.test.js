// ============================================================
// i18n.test.js — Dil altyapısı garantileri (2 dil: tr + en)
//
// 1) Anahtar seti 2 dilde BİREBİR aynı (eksik çeviri = kırık ekran değil,
//    ama sessiz kalması istenmez → test düşer).
// 2) t(): fallback (seçili dil → tr → anahtar) ve {{var}} interpolation.
// 3) plural(): tek/çok biçim (tr/en).
// 4) Biçimlendirme ve dil etiketleri.
// ============================================================

import {
  LANG_LABELS,
  LOCALES,
  dayNameShort,
  formatNumber,
  formatDate,
  getLocale,
  plural,
  setLocale,
  t,
} from '../../src/i18n';
import tr from '../../src/i18n/locales/tr';
import en from '../../src/i18n/locales/en';

const DICTS = { tr, en };

afterEach(() => {
  setLocale('tr');
});

describe('locale dosyaları', () => {
  test('2 dil dosyası var ve anahtar setleri birebir aynı', () => {
    const base = Object.keys(tr).sort();
    expect(base.length).toBeGreaterThan(0);
    expect(LOCALES).toEqual(['tr', 'en']);
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
    setLocale('tr');
    expect(t('app.tab.home')).toBe('Bugün');
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

  test('en\'de eksik anahtar tr\'ye düşer', () => {
    setLocale('en');
    expect(t('settings.section.language')).toBe('Language');
  });
});

describe('setLocale', () => {
  test('geçerli dili kurar, geçersizde tr\'ye düşer', () => {
    setLocale('en');
    expect(getLocale()).toBe('en');
    setLocale('xx');
    expect(getLocale()).toBe('tr');
  });
});

describe('plural() ve biçimlendirme', () => {
  test('tek/çok biçim (tr/en)', () => {
    setLocale('tr');
    expect(plural(1, { one: 'x', other: 'y' })).toBe('x');
    expect(plural(0, { one: 'x', other: 'y' })).toBe('y');
    expect(plural(7, { one: 'x', other: 'y' })).toBe('y');
    setLocale('en');
    expect(plural(1, { one: 'x', other: 'y' })).toBe('x');
    expect(plural(2, { one: 'x', other: 'y' })).toBe('y');
  });

  test('formatDate / formatNumber / dayNameShort döner', () => {
    setLocale('tr');
    expect(formatDate(new Date(2026, 0, 5))).toMatch(/2026/);
    expect(formatNumber(1234)).toMatch(/1.?234|1,234/);
    expect(dayNameShort(new Date(2026, 0, 5))).toBeTruthy();
    setLocale('en');
    expect(formatDate(new Date(2026, 0, 5))).toMatch(/2026/);
  });
});
