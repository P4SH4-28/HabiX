// ============================================================
// typography.js — v3 tipografi: 5 ölçek, 3 weight
//
// Kural: ESKİ ANAHTARLAR alias olarak KORUNUR (import kırılmaz);
// hepsi 5 ölçeğe bağlanır. Font boyutu 23 → 5.
//
// WEIGHT İZNİ: yalnızca 400 · 600 · 700 (500/800/900 YASAK).
// LINE HEIGHT: her ölçek 1.4x (yuvarlanmış).
//
// ---------- 5 ÖLÇEK (NE ZAMAN KULLANILIR) ----------
// micro  11/600/15 → Chip/etiket/metadata. UPPERCASE.
// small  13/400/18 → Yardımcı metin, açıklama, ipucu, hata yazısı.
// body   15/400/21 → Gövde metni (varsayılan okuma), input metni.
// h3     17/600/24 → Bölüm/kart başlığı.
// h1     22/700/31 → Ekran başlığı. EKRAN BAŞINA 1 ADET.
//
// Kural: h1 > h3 > body > small > micro. Arada yeni boyut EKLEME.
// ============================================================

export const TYPE = {
  // ---------- 5 ÖLÇEK ----------
  micro: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400', letterSpacing: 0 },
  h3: { fontSize: 17, lineHeight: 24, fontWeight: '600', letterSpacing: -0.1 },
  h1: { fontSize: 22, lineHeight: 31, fontWeight: '700', letterSpacing: -0.3 },

  // ---------- Sayısal vurgu (h1 ölçeği + tabular) ----------
  stat: { fontSize: 22, lineHeight: 31, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // ---------- ALIAS (eski anahtarlar → 5 ölçek) ----------
  display: { fontSize: 22, lineHeight: 31, fontWeight: '700', letterSpacing: -0.3 },
  h2: { fontSize: 15, lineHeight: 21, fontWeight: '700', letterSpacing: -0.1 },
  title: { fontSize: 15, lineHeight: 21, fontWeight: '700', letterSpacing: -0.1 },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600', letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0 },
  label: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statSm: { fontSize: 22, lineHeight: 31, fontWeight: '700', fontVariant: ['tabular-nums'] },
};

// İzinli weight'ler (lint/test kontrolü için).
export const FONT_WEIGHTS = ['400', '600', '700'];

export default TYPE;
