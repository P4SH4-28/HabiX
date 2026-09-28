// ============================================================
// AnimatedCounter.js - Değer değişince yumuşakça sayan animasyonlu sayaç.
// Alışkanlık tamamlanınca XP/altın/istatistik değerlerinin heyecanla
// artıp düşmesini sağlar. Sadece sayıyı gösterir; stil dışarıdan gelir.
// İyileştirmeler:
// - Reduce-motion açıksa sayım yok, anında değer (erişilebilirlik).
// - Yalnızca GÖRÜNEN tamsayı değişince setState → gereksiz render yok.
// - Ease-out eğrisi: başlangıç hızlı, bitiş yumuşak (premium his).
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Text } from 'react-native';

export default function AnimatedCounter({ value, duration = 520, style }) {
  const [display, setDisplay] = useState(value);
  const [reduced, setReduced] = useState(false);
  const anim = useRef(new Animated.Value(value)).current;
  const prevRef = useRef(value);
  const displayRef = useRef(value);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((en) => mounted && setReduced(!!en))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev === value) return undefined;
    prevRef.current = value;

    if (reduced) {
      displayRef.current = value;
      setDisplay(value);
      anim.setValue(value);
      return undefined;
    }

    anim.setValue(prev);
    const listener = anim.addListener(({ value: v }) => {
      const n = Math.round(v);
      // Yalnızca görünen sayı değiştiyse render et (aynı karede tekrar yok).
      if (n !== displayRef.current) {
        displayRef.current = n;
        setDisplay(n);
      }
    });
    Animated.timing(anim, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(listener);
  }, [value, duration, anim, reduced]);

  return <Text style={style}>{display}</Text>;
}
