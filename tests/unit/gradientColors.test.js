// gradientColors — LinearGradient renk listesinin normalize edilmesi.
//
// Regresyon: android.graphics.LinearGradient iki renkten AZ renkle ÇÖKER.
// QuestBoard / League / SeasonPass ekranları tek renkli <Progress colors={[...]} />
// verdiği için native crash alıyordu. Burada tek renk, boş liste ve geçersiz
// değerler en az iki geçerli renge indirgenir.
import normalizeGradientColors from '../../src/components/ui/gradientColors';

const FALLBACK = ['#111111', '#222222'];

describe('normalizeGradientColors', () => {
  it('iki veya daha fazla geçerli rengi olduğu gibi bırakır', () => {
    expect(normalizeGradientColors(['#AABBCC', '#DDEEFF'], FALLBACK)).toEqual([
      '#AABBCC',
      '#DDEEFF',
    ]);
  });

  it('tek rengi düz dolgu için iki kez yazar (ANDROID CRASH koruması)', () => {
    expect(normalizeGradientColors(['#AABBCC'], FALLBACK)).toEqual(['#AABBCC', '#AABBCC']);
  });

  it('geçersiz/boş renkleri eler, tek kalan geçerli rengi çoğaltır', () => {
    expect(normalizeGradientColors([undefined, '#AABBCC', ''], FALLBACK)).toEqual([
      '#AABBCC',
      '#AABBCC',
    ]);
  });

  it('liste yoksa tema varsayılanına düşer', () => {
    expect(normalizeGradientColors(undefined, FALLBACK)).toEqual(FALLBACK);
    expect(normalizeGradientColors([], FALLBACK)).toEqual(FALLBACK);
    expect(normalizeGradientColors('primary', FALLBACK)).toEqual(FALLBACK);
  });

  it('DAİMA en az iki renk döndürür (yoksa tek beyaz)', () => {
    expect(normalizeGradientColors([], [])).toEqual(['#FFFFFF', '#FFFFFF']);
  });
});
