// ============================================================
// GradientButton.js — Geriye dönük uyumlu sarmalayıcı.
// Tüm eski API (label/icon/colors/start/end/glowColor/compact/haptic/
// loading/disabled/textStyle) korunur; görsel artık ui/Button'dan gelir.
// Yeni kod doğrudan `import Button from './ui/Button'` kullanmalı.
// ============================================================
import Button from './ui/Button';

export default function GradientButton(props) {
  return <Button {...props} variant="primary" />;
}
