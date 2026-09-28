// ============================================================
// useReducedMotion.js — Erişilebilirlik: "hareketi azalt" tercihi.
// Sistemde hareket azaltma açıksa animasyonlar anında tamamlanır
// (yalpalama yok), uygulama tamamen kullanılabilir kalır.
// AccessibilityInfo hem iOS hem Android hem web'de desteklenir.
// ============================================================
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export default function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduced(!!enabled);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (mounted) setReduced(!!enabled);
    });
    return () => {
      mounted = false;
      // RN 0.65+: subscription.remove(); eski sarmalayıcılar için güvenli düşüş.
      if (sub && typeof sub.remove === 'function') sub.remove();
    };
  }, []);

  return reduced;
}
