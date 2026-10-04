// ============================================================
// useDismissOnEscape — Modal'ları klavye Escape ile kapat.
// (Web/desktop için; native back tuşu RN Modal'ın `onRequestClose`
//  prop'u tarafından zaten consume edilir — ek BackHandler GEREKMEZ,
//  iki katman aynı anda kapatırsa çift tetik olur.)
//   active    → modal görünür mü (mount koşulu)
//   onDismiss → kapatma fonksiyonu (onClose / dismiss...)
// ============================================================
import { useEffect } from 'react';

export default function useDismissOnEscape(active, onDismiss) {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (event) => {
      if (event.key === 'Escape') onDismiss();
    };
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
    return undefined;
  }, [active, onDismiss]);
}
