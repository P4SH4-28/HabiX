// ============================================================
// typography.js — Tipografi skalası
//   H1 28/800/-0.5 · H2 22/700 · H3 17/600
//   body 15/400 · small 13/500 · micro 11/600 uppercase
// Ekranlarda fontSize sabitleme YOK; `type.*` token'ı kullan.
// ============================================================
export const TYPE = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  h3: { fontSize: 17, lineHeight: 23, fontWeight: '600', letterSpacing: -0.1 },

  title: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.4 },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  stat: { fontSize: 22, lineHeight: 27, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statSm: { fontSize: 15, lineHeight: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
};

export default TYPE;
