// ============================================================
// gradientColors.js — expo-linear-gradient için güvenli renk listesi.
//
// NEDEN: android.graphics.LinearGradient "iki RENKTEN AZ" renk dizisiyle
// ÇÖKER ("there are less than two colors" → LinearGradient construction
// failed). expo-linear-gradient bu hatayı JS'te yakalamaz; uygulama
// native crash verir. Bu yüzden tek renkli bir dolgu (ör. colors={[C.primary]})
// Android'de patlar — QuestBoard / League / SeasonPass ekranları tam olarak
// bu yüzden çöküyordu. Leaderboard kilit ekranı ve TeamScreen de aynı
// tuzağa sahipti.
//
// KURAL: expo-linear-gradient'a giden dizi HER ZAMAN >= 2 geçerli renk
// içermeli. Tek renk → iki kez yazılır (düz renk dolgu), boş/geçersiz
// liste → tema varsayılanına düşer.
// ============================================================

function isColor(c) {
  return typeof c === 'string' && c.trim().length > 0;
}

// Verilen renk listesini LinearGradient için güvenli hale getirir.
// - >= 2 geçerli renk  → olduğu gibi döner
// - 1 geçerli renk     → [renk, renk] (düz dolgu)
// - 0 geçerli renk     → [fallback[0], fallback[1]] (tema varsayılanı)
export default function normalizeGradientColors(colors, fallback) {
  const list = Array.isArray(colors) ? colors.filter(isColor) : [];
  if (list.length >= 2) return list;
  const safeFallback = (Array.isArray(fallback) ? fallback.filter(isColor) : []).slice(0, 2);
  if (list.length === 1) return [list[0], list[0]];
  if (safeFallback.length >= 2) return safeFallback;
  const single = list[0] || safeFallback[0] || '#FFFFFF';
  return [single, single];
}
