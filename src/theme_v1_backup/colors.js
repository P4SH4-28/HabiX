// ============================================================
// colors.js — Dark tema renk paleti (Linear/Vercel kimliği)
// Tüm ekranlar C.* üzerinden bu token'ları kullanır; hard-coded hex YOK.
// Erişilebilirlik (WCAG AA, 4.5:1 hedef):
//   text/#FFFFFF   → background 20.0:1 ✓  surface 18.4:1 ✓
//   textMuted      → background  7.4:1 ✓  surface  5.4:1 ✓
//   accent         → background 10.8:1 ✓
//   danger         → background  5.9:1 ✓
//   warning        → background 10.0:1 ✓
//   primary        → background  4.6:1 ✓  (surface üzerinde 4.3:1 —
//                    küçük metin için birikimli değil, büyük/bold kullan)
// ============================================================
export const COLORS = {
  background: '#0A0A0F',
  surface: '#15151F',
  surfaceLight: '#1F1F2E',
  border: '#2A2A3A',

  primary: '#6C63FF',
  primaryDark: '#5A51E5',
  accent: '#00D9A3',
  danger: '#FF4757',
  warning: '#FFA502',

  text: '#FFFFFF',
  textMuted: '#8A8A9A',

  gold: '#FFD700',
  xp: '#FFB454',
  silver: '#C0C8D8',
  bronze: '#D98E5A',

  // Buton metni rengi (primary/danger zemin üzerinde).
  onPrimary: '#FFFFFF',
  // Ekran arka planına serpiştirilen dekoratif desen emojisi (null = desensiz).
  pattern: null,
};

export default COLORS;
