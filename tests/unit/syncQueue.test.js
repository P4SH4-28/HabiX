// ============================================================
// syncService.ts — mutation kuyruğu ve drain mantığı birim testleri
// Kapsanan riskler:
//   1) Eşzamanlı enqueue'lar (race) item kaybına yol açmamalı.
//   2) mergeKey ile birleşim, MEVCUT id'yi döndürmeli (yoksa silme işlemi
//      var olmayan id'ye yapılır ve item sonsuza dek kalır).
//   3) Drain sürerken güncellenen satır silinmemeli (yeni değer kaybolmasın).
//   4) Başarılı/başarısız drain akışları (retry sayaçları) doğru çalışmalı.
// ============================================================
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../src/config/supabase', () => ({
  SUPABASE_URL: 'https://test.supabase.co',
  supabase: { from: () => ({}) },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  enqueueMutation,
  getQueue,
  getQueueCount,
  removeFromQueue,
  bumpRetryCount,
  drainQueue,
  queueKeyFor,
  mergeEarnings,
  mergeProfileMeta,
  localWins,
} from '../../src/services/syncService';

const NAME = 'Test Kullanıcı';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('kuyruk anahtarı', () => {
  test('ad güvenli hale getirilir', () => {
    expect(queueKeyFor('P4SH4')).toBe('@sync_engine:mutation_queue:p4sh4');
    expect(queueKeyFor('')).toBe('@sync_engine:mutation_queue:varsayilan');
    expect(queueKeyFor('Ayşe 123')).toBe('@sync_engine:mutation_queue:ay_e_123');
  });
});

describe('enqueueMutation', () => {
  test('item ekler ve { id, timestamp } döner', async () => {
    const h = await enqueueMutation(NAME, {
      action: 'UPDATE',
      table: 'profiles',
      payload: { kind: 'meta', bio: 'merhaba', mergeKey: 'meta' },
    });
    expect(typeof h.id).toBe('string');
    expect(typeof h.timestamp).toBe('number');
    const q = await getQueue(NAME);
    expect(q).toHaveLength(1);
    expect(q[0].id).toBe(h.id);
  });

  test('aynı mergeKey için birleşir ve MEVCUT id’yi döndürür', async () => {
    const first = await enqueueMutation(NAME, {
      action: 'UPDATE',
      table: 'profiles',
      payload: { kind: 'earnings', deltaXp: 25, deltaGold: 10, mergeKey: 'earnings' },
    }, mergeEarnings);
    const second = await enqueueMutation(NAME, {
      action: 'UPDATE',
      table: 'profiles',
      payload: { kind: 'earnings', deltaXp: 30, deltaGold: 5, mergeKey: 'earnings' },
    }, mergeEarnings);

    expect(second.id).toBe(first.id);
    const q = await getQueue(NAME);
    expect(q).toHaveLength(1);
    expect(q[0].payload.deltaXp).toBe(55);
    expect(q[0].payload.deltaGold).toBe(15);
    // birleşim sonrası timestamp güncellenmelidir (LWW tespiti için)
    expect(q[0].timestamp).toBe(second.timestamp);
  });

  test('eşzamanlı enqueue’lar item kaybettirmez (race)', async () => {
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        enqueueMutation(NAME, {
          action: 'CREATE',
          table: 'pomodoro',
          payload: { kind: 'pomodoro_done', xp: 10 + i, gold: 5, mergeKey: `p_${i}` },
        })
      )
    );
    expect(await getQueueCount(NAME)).toBe(12);
  });

  test('eşzamanlı enqueue + drain temizliği birbirini bozmaz', async () => {
    const enq = await enqueueMutation(NAME, {
      action: 'UPDATE',
      table: 'profiles',
      payload: { kind: 'meta', bio: 'a', mergeKey: 'meta' },
    });
    // drain sürerken kullanıcı bio’yu değiştirir → aynı id güncellenir
    await new Promise((r) => setTimeout(r, 5));
    const concurrent = enqueueMutation(NAME, {
      action: 'UPDATE',
      table: 'profiles',
      payload: { kind: 'meta', bio: 'b', mergeKey: 'meta' },
    });
    await removeFromQueue(NAME, [enq.id], { [enq.id]: enq.timestamp });
    await concurrent;
    const q = await getQueue(NAME);
    expect(q).toHaveLength(1);
    expect(q[0].payload.bio).toBe('b');
  });
});

describe('removeFromQueue', () => {
  test('expected timestamp uyuşmuyorsa satır silinmez', async () => {
    const h = await enqueueMutation(NAME, {
      action: 'UPDATE',
      table: 'profiles',
      payload: { kind: 'meta', bio: 'eski', mergeKey: 'meta' },
    });
    // Gönderim sonrası satır yenilendi (timestamp değişti). Aynı ms içinde
    // yapılan iki yazmada timestamp eşit kalabileceği için küçük bir bekleme.
    await new Promise((r) => setTimeout(r, 5));
    const updated = await enqueueMutation(NAME, {
      action: 'UPDATE',
      table: 'profiles',
      payload: { kind: 'meta', bio: 'yeni', mergeKey: 'meta' },
    });
    expect(updated.timestamp).toBeGreaterThan(h.timestamp);
    await removeFromQueue(NAME, [h.id], { [h.id]: h.timestamp });
    const q = await getQueue(NAME);
    expect(q).toHaveLength(1);
    expect(q[0].payload.bio).toBe('yeni');

    // Beklenen timestamp güncel ise silinir
    await removeFromQueue(NAME, [updated.id], { [updated.id]: updated.timestamp });
    expect(await getQueueCount(NAME)).toBe(0);
  });
});

describe('bumpRetryCount', () => {
  test('retry artar ve sınırın üstüne çıkmaz', async () => {
    const h = await enqueueMutation(NAME, {
      action: 'UPDATE',
      table: 'profiles',
      payload: { kind: 'meta', bio: 'x', mergeKey: 'meta' },
    });
    for (let i = 0; i < 8; i++) await bumpRetryCount(NAME, [h.id]);
    const q = await getQueue(NAME);
    expect(q[0].retryCount).toBe(5);
  });
});

describe('drainQueue', () => {
  const earningsInput = {
    action: 'UPDATE',
    table: 'profiles',
    payload: { kind: 'earnings', mergeKey: 'earnings', deltaXp: 25, deltaGold: 10 },
  };
  const metaInput = {
    action: 'UPDATE',
    table: 'profiles',
    payload: { kind: 'meta', bio: 'selo', mergeKey: 'meta' },
  };

  test('başarılı publish kazanım item’larını temizler', async () => {
    await enqueueMutation(NAME, earningsInput, mergeEarnings);
    const res = await drainQueue(NAME, {
      publishEarnings: async () => true,
      applyMeta: async () => true,
    });
    expect(res.synced).toBe(1);
    expect(await getQueueCount(NAME)).toBe(0);
  });

  test('başarısız publish item’ları kuyrukta tutar ve retry artırır', async () => {
    await enqueueMutation(NAME, earningsInput, mergeEarnings);
    const res = await drainQueue(NAME, {
      publishEarnings: async () => false,
      applyMeta: async () => true,
    });
    expect(res.retried).toBe(1);
    const q = await getQueue(NAME);
    expect(q).toHaveLength(1);
    expect(q[0].retryCount).toBe(1);
  });

  test('meta handler başarısızsa item kalır, kazanım düzeltilir', async () => {
    await enqueueMutation(NAME, earningsInput, mergeEarnings);
    await enqueueMutation(NAME, metaInput, mergeProfileMeta);
    const res = await drainQueue(NAME, {
      publishEarnings: async () => true,
      applyMeta: async () => false,
    });
    expect(res.synced).toBe(1);
    expect(res.retried).toBe(1);
    const q = await getQueue(NAME);
    expect(q).toHaveLength(1);
    expect(q[0].payload.kind).toBe('meta');
  });

  test('boş kuyrukta hiçbir handler çağrılmaz', async () => {
    const res = await drainQueue(NAME, {
      publishEarnings: jest.fn(async () => true),
      applyMeta: jest.fn(async () => true),
    });
    expect(res).toEqual({ synced: 0, retried: 0 });
  });
});

describe('merge stratejileri', () => {
  test('mergeEarnings deltaları toplar', () => {
    const merged = mergeEarnings(
      { deltaXp: 25, deltaGold: 10, totalXp: 100, claimedDay: '2026-09-26' },
      { deltaXp: 30, deltaGold: 5, totalXp: 155, claimedDay: '2026-09-27' }
    );
    expect(merged.deltaXp).toBe(55);
    expect(merged.deltaGold).toBe(15);
    expect(merged.totalXp).toBe(155);
    expect(merged.claimedDay).toBe('2026-09-27');
  });

  test('mergeProfileMeta alanları birleştirir', () => {
    const merged = mergeProfileMeta(
      { bio: 'eski', mergeKey: 'meta' },
      { photoUrl: 'https://x/y.png', mergeKey: 'meta' }
    );
    expect(merged.bio).toBe('eski');
    expect(merged.photoUrl).toBe('https://x/y.png');
    expect(merged.mergeKey).toBe('meta');
  });
});

describe('localWins (LWW)', () => {
  test('sunucu değeri yoksa yerel kazanır', () => {
    expect(localWins(Date.now(), null)).toBe(true);
  });
  test('yerel daha yeniyse yerel kazanır', () => {
    expect(localWins(3000, '1970-01-01T00:00:02.000Z')).toBe(true);
    expect(localWins(1000, '1970-01-01T00:00:02.000Z')).toBe(false);
  });
  test('bozuk sunucu zamanı yerel lehine yorumlanır', () => {
    expect(localWins(1, 'bozuk-zaman')).toBe(true);
  });
});
