// ============================================================
// typography.js — v4 tipografi: 6 boyut, 5 weight, zorunlu lineHeight
//
// Kural: ESKİ ANAHTARLAR alias olarak KORUNUR (import kırılmaz);
// hepsi 6 boyuta bağlanır. Font boyutu 19 → 6.
//
// WEIGHT İZNİ: yalnızca 400 · 500 · 600 · 700 · 800 (başka değer YASAK).
// LINE HEIGHT: her boyutta ZORUNLU — lineHeight'sız token YOK.
// GÖVDE: hiyerarşi h1 > h3 > body > small > micro. Arada yeni boyut YOK.
//
// ---------- 6 BOYUT (NE ZAMAN KULLANILIR) ----------
// micro     11/14   → Chip/etiket/metadata/mini sayaç. UPPERCASE.
// small     13/18   → Yardımcı metin, açıklama, ipucu, hata yazısı.
// body      15/21   → Gövde metni (varsayılan okuma), input metni.
// h3        17/24   → Bölüm/kart başlığı.
// h1        22/30   → Ekran başlığı / sayısal vurgu. EKRAN BAŞI 1 ADET.
// displayXl 48/56   → Hero/timer sayısı. Başlık/gövdede YASAK.
// ============================================================

export const TYPE = {
  // ---------- 6 BOYUT ----------
  micro: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400', letterSpacing: 0 },
  h3: { fontSize: 17, lineHeight: 24, fontWeight: '600', letterSpacing: -0.1 },
  h1: { fontSize: 22, lineHeight: 30, fontWeight: '700', letterSpacing: -0.3 },

  // ---------- Hero/timer sayısı (İSTİSNA — sadece burada) ----------
  displayXl: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },

  // ---------- ALIAS (eski anahtarlar → 6 boyut, import kırılmaz) ----------
  display: { fontSize: 22, lineHeight: 30, fontWeight: '700', letterSpacing: -0.3 },
  h2: { fontSize: 15, lineHeight: 21, fontWeight: '700', letterSpacing: -0.1 },
  title: { fontSize: 15, lineHeight: 21, fontWeight: '700', letterSpacing: -0.1 },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600', letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0 },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  // Sayısal vurgu (h1 ölçeği + tabular)
  stat: { fontSize: 22, lineHeight: 30, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statSm: { fontSize: 22, lineHeight: 30, fontWeight: '700', fontVariant: ['tabular-nums'] },
};

// İzinli weight'ler (lint/test kontrolü için).
export const FONT_WEIGHTS = ['400', '500', '600', '700', '800'];

// 6 boyutun ölçüleri — Text bileşeni buradan lineWidth garantisini üretir.
export const SCALES = ['micro', 'small', 'body', 'h3', 'h1', 'displayXl'];

// Herhangi bir fontSize için en yakın boyut anahtarını bulur (runtime fallback).
export function scaleForSize(fontSize) {
  let best = 'body';
  let bestDelta = Infinity;
  for (const key of SCALES) {
    const delta = Math.abs(TYPE[key].fontSize - fontSize);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = key;
    }
  }
  return best;
}

// Zorunlu lineHeight üretici: token'daki değer birebir yoksa 1.4x (yuvarlanmış).
// Kural: hiçbir fontSize lineHeight'sız render edilmez.
export function lineHeightFor(fontSize, scaleKey = scaleForSize(fontSize)) {
  const token = TYPE[scaleKey];
  if (token && token.fontSize === fontSize && token.lineHeight) return token.lineHeight;
  return Math.round(fontSize * 1.4);
}

export default TYPE;
