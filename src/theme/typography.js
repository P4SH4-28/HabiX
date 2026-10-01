// ============================================================
// typography.js — v2 tipografi: 5 ölçek, 3 weight (Linear disiplini)
//
// Kural: ESKİ ANAHTARLAR alias olarak KORUNUR (import kırılmaz);
// hepsi yeni 5 ölçeğe bağlanır. Font boyutu 23 → 5.
//
// WEIGHT İZNİ: yalnızca 400 · 600 · 700 (800/900 YASAK).
//
// ---------- NE ZAMAN KULLANILIR ----------
// h1     17/700 → Ekran başlığı. EKRAN BAŞINA 1 ADET.
// title  15/700 → Bölüm/kart başlığı. En fazla bir basamak altında.
// body   15/400 → Gövde metni (varsayılan okuma).
// small  13/400 → Yardımcı metin, açıklama, ikincil bilgi.
// micro  11/600 → Chip/etiket/metadata. UPPERCASE yalnız `label`.
// stat   22/700 → Sayısal vurgu (tabular-nums).
//
// Kural: başlık > gövde > yardımcı olarak 3 basamaktan fazlası KULLANMA.
// ============================================================

export const TYPE = {
  // ---------- 5 ÖLÇEK ----------
  h1: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400', letterSpacing: 0 },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0 },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.4 },
  stat: { fontSize: 22, lineHeight: 27, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // ---------- ALIAS (eski anahtarlar → yeni ölçek) ----------
  display: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2 },
  h2: { fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: -0.1 },
  h3: { fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: -0.1 },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600', letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0 },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statSm: { fontSize: 22, lineHeight: 27, fontWeight: '700', fontVariant: ['tabular-nums'] },
};

// İzinli weight'ler (lint/test kontrolü için).
export const FONT_WEIGHTS = ['400', '600', '700'];

export default TYPE;
