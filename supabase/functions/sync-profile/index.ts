// ============================================================
// sync-profile — Supabase Edge Function (Habit Tracker Katman 3)
// Günlük XP/Altın kazançlarını sunucu tarafında doğrular:
// - Yalnızca DELTA (fark) kabul eder; mutlak değerler güvenilmez.
// - daily_earnings defterine günlük tavanı (500 XP / 150 🪙) uygular.
// - Cihaz tarihi ileri alınmışsa (claimedDay > sunucuGünü + 1) isteği
//   reddetmez ama günü sunucu gününe kıstırır (warn: clock_ahead).
// - Rate limit: aynı profil 10 saniyede bir defadan fazla sync edemez.
// - Tavan aşımı tespit edilirse profil "flagged" işaretlenir (Katman 4).
// - Yalnızca servis rolüyle yazar (RLS'yi bypass eder); istemci anahtarı
//   profiles tablosunda yazma yapamaz (bkz. supabase-anti-farm.sql).
//
// Deploy: Supabase Dashboard → Edge Functions → yapıştır → Deploy
// (JWT doğrulaması KAPALI olmalı: "Verify JWT" işaretsiz bırakılır —
//  istemci anon key ile değil doğrudan HTTP ile çağırır).
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const DAY_XP_CAP = 500;
const DAY_GOLD_CAP = 150;
// Negatif delta (geri alma/ceza) günlük tavanı: kimlik doğrulaması
// olmadan çağrılabilen bu uç noktada herkesin bakiyesini sıfırlama
// saldırısı ancak BU tavanla sınırlı kalır (bkz. güvenlik geçişi 001).
const DAY_XP_NEG_CAP = 500;
const DAY_GOLD_NEG_CAP = 300;
const MIN_SYNC_MS = 10_000;
// Aynı requestId bu süreden yeniyse "uygulanmış" sayılır; daha eskiyse
// önceki deneme yarım kalmıştır (çökme) → yeniden uygulamaya izin verilir.
const IDEMPOTENCY_MAX_AGE_MS = 15 * 60 * 1000;
// Cihaz günü sunucu gününden en fazla +1 gün ileride olabilir
// (saat dilimi toleransı; daha fazlası = saat oynatma).
const MAX_DAY_AHEAD = 1;

// Bellek içi hız sınırı (IP başına; best-effort).
const rateBuckets = new Map<string, { count: number; reset: number }>();
function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = rateBuckets.get(key);
  if (!b || now > b.reset) {
    rateBuckets.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  b.count += 1;
  return b.count > limit;
}
function clientKey(req): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : 'local') || 'local';
}

// Sütun yokluğu (migration henüz uygulanmadı) hatası mı?
function isColumnMissing(err): boolean {
  if (!err) return false;
  const msg = String(err.message || '');
  return err.code === 'PGRST204' || /neg_xp|neg_gold|column/i.test(msg);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function json(res, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function utcDayKey(date) {
  return date.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json(req, 405, { error: 'method_not_allowed' });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: 'bad_json' });
  }

  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  if (!username || username.length < 2 || username.length > 64) {
    return json(req, 400, { error: 'username_required' });
  }
  // IP başına hız sınırı: dakikada 30 istek (kendi cihazına rahatça yeter).
  if (rateLimit(clientKey(req), 30, 60_000)) {
    return json(req, 429, { error: 'rate_limited' });
  }

  // Deltalar sayı olmalı; eksikse 0 kabul edilir. NaN → reddet.
  const deltaXpRaw = Number(body?.deltaXp);
  const deltaGoldRaw = Number(body?.deltaGold);
  if (!Number.isFinite(deltaXpRaw) || !Number.isFinite(deltaGoldRaw)) {
    return json(req, 400, { error: 'invalid_delta' });
  }
  const claimedDay = typeof body?.claimedDay === 'string' ? body.claimedDay : null;

  // Profil meta bilgisi (isteğe bağlı; yalnızca verilirse yazılır).
  const bio = typeof body?.bio === 'string' ? body.bio.trim().slice(0, 200) : null;
  const photoUrl =
    typeof body?.photoUrl === 'string' && body.photoUrl.trim().length > 0
      ? body.photoUrl.trim().slice(0, 300)
      : typeof body?.photoUrl === 'string'
        ? ''
        : null;

  const now = new Date();
  const serverDay = utcDayKey(now);

  // ---------- Profili getir ----------
  let { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('xp, coins, last_sync_at, banned, ban_reason')
    .eq('username', username)
    .maybeSingle();

  if (profErr && profErr.code !== 'PGRST116') {
    return json(req, 500, { error: 'profile_lookup_failed' });
  }

  // ---------- Yasak kontrolü ----------
  // Banlı kullanıcının kazanç senkronu tamamen durdurulur; uygulaması
  // yasak ekranı gösterir (403 + reason). Yeni profiller asla banlı doğmaz.
  if (prof?.banned) {
    return json(req, 403, {
      error: 'banned',
      warn: 'banned',
      reason: prof.ban_reason || null,
    });
  }

  // ---------- Rate limit (10 sn) ----------
  // Yalnızca KAYITLI profillere uygulanır: yeni oluşturulan profil zaten
  // last_sync_at = şimdi taşır; kontrol edilirse ilk senkron hep 429 olur.
  if (prof?.last_sync_at) {
    const last = Date.parse(prof.last_sync_at);
    if (!Number.isNaN(last) && now.getTime() - last < MIN_SYNC_MS) {
      return json(req, 429, {
        error: 'rate_limited',
        warn: 'rate_limited',
        retryAfterMs: MIN_SYNC_MS - (now.getTime() - last),
      });
    }
  }

  // ---------- Profili oluştur (yoksa) ----------
  if (!prof) {
    const { data: created, error: createErr } = await supabase
      .from('profiles')
      .insert({ username, xp: 0, coins: 0, last_sync_at: now.toISOString() })
      .select('xp, coins, last_sync_at')
      .single();
    if (createErr) return json(req, 500, { error: 'profile_create_failed' });
    prof = created;
  }

  // ---------- Tekrar oynatma (idempotency) koruması ----------
  // İstemci aynı delta'yı yanıtı kaybettiğinde yeniden dener. sync_requests
  // tablosundaki tekil kayıt, AYNI delta'nın ikinci kez uygulanmasını engeller
  // (çift kredi / çift ceza önlenir). Tablo yoksa (migration henüz
  // uygulanmamış) idempotency atlanır ve akış normale döner.
  const requestId =
    typeof body?.requestId === 'string' && body.requestId.length <= 64
      ? body.requestId
      : null;
  // Yazma başarısız olursa kaydı geri al: yarım kalan bir alım, istemcinin
  // yeniden denemesini engellmesin (veri KAYBI yerine en fazla sınırlı
  // tekrar uygulama riski kalır — o da günlük tavanlarla korunur).
  const releaseRequestId = () => {
    if (!requestId) return;
    supabase
      .from('sync_requests')
      .delete()
      .eq('username', username)
      .eq('request_id', requestId)
      .then(() => {})
      .catch(() => {});
  };
  if (requestId) {
    try {
      const { data: inserted, error: insErr } = await supabase
        .from('sync_requests')
        .insert({ username, request_id: requestId, created_at: now.toISOString() })
        .select('request_id');
      const duplicateKey = insErr?.code === '23505';
      if (duplicateKey || (!insErr && (!inserted || inserted.length === 0))) {
        // Çakışma: bu id daha önce kaydedilmiş. Kayıt TAZEYSE (< 15 dk)
        // uygulanmış demektir → duplicate dön. ESKİYSE önceki deneme
        // tamamlanmamıştır (ör. çökme) → kayıt tazelenip akışa devam edilir
        // (aksi halde kullanıcı verisi kalıcı olarak kaybolurdu).
        const { data: existing } = await supabase
          .from('sync_requests')
          .select('created_at')
          .eq('username', username)
          .eq('request_id', requestId)
          .maybeSingle();
        const createdAt = existing?.created_at ? Date.parse(existing.created_at) : NaN;
        const ageOk = !Number.isNaN(createdAt) && now.getTime() - createdAt < IDEMPOTENCY_MAX_AGE_MS;
        if (ageOk) {
          return json(req, 200, {
            ok: true,
            duplicate: true,
            serverXp: prof.xp ?? 0,
            serverGold: prof.coins ?? 0,
            day: serverDay,
            flagged: false,
          });
        }
        await supabase
          .from('sync_requests')
          .update({ created_at: now.toISOString() })
          .eq('username', username)
          .eq('request_id', requestId);
      }
      // Periyodik temizlik: 2 günden eski kayıtlar silinir (~%5 istekte).
      if (Math.random() < 0.05) {
        await supabase
          .from('sync_requests')
          .delete()
          .lt('created_at', new Date(now.getTime() - 2 * 86400000).toISOString());
      }
    } catch {
      // İdempotency katmanı hatası akışı durdurmaz.
    }
  }

  // ---------- Gün seçimi: cihazın "bugün"ü mü, sunucu günü mü? ----------
  // claimedDay sunucu gününü +MAX_DAY_AHEAD aşarsa saat ileri alınmıştır:
  // isteği reddetmek yerine günü sunucu gününe kıstır ve kullanıcıyı uyar.
  let day = serverDay;
  let clockAhead = false;
  if (claimedDay && /^\d{4}-\d{2}-\d{2}$/.test(claimedDay)) {
    if (claimedDay <= serverDay) {
      day = claimedDay; // geçmiş/güncel gün normal kabul edilir
    } else {
      const daysDiff = Math.round(
        (Date.parse(claimedDay + 'T00:00:00Z') - Date.parse(serverDay + 'T00:00:00Z')) / 86400000
      );
      if (daysDiff <= MAX_DAY_AHEAD) {
        day = claimedDay; // saat dilimi toleransı
      } else {
        day = serverDay; // kıstır
        clockAhead = true;
      }
    }
  }

  // ---------- Günlük defter ----------
  const { data: dayRow } = await supabase
    .from('daily_earnings')
    .select('xp, gold, neg_xp, neg_gold')
    .eq('username', username)
    .eq('day', day)
    .maybeSingle();
  const usedXp = dayRow?.xp ?? 0;
  const usedGold = dayRow?.gold ?? 0;
  // migration uygulanana kadar bu kolonlar okunamaz → tavanlar devre dışı kalır.
  const negXpUsed = typeof dayRow?.neg_xp === 'number' ? dayRow.neg_xp : null;
  const negGoldUsed = typeof dayRow?.neg_gold === 'number' ? dayRow.neg_gold : null;

  // ---------- Tavan doğrulaması ----------
  // Pozitif kazançlar güne göre kıstırılır. Negatif deltalar (geri alma,
  // ceza) da ARTIK sınırlı: tek istekte ve günde en fazla
  // -500 XP / -300 altın — böylece kimliksiz bir istemci hiçbir hesabın
  // bakiyesini serbestçe sıfırlayamaz (günlük defterde neg_* birikir).
  let acceptedXp = deltaXpRaw;
  let acceptedGold = deltaGoldRaw;
  let clamped = false;
  if (acceptedXp > 0) {
    acceptedXp = Math.min(acceptedXp, Math.max(0, DAY_XP_CAP - usedXp));
    if (acceptedXp < deltaXpRaw) clamped = true;
  } else if (acceptedXp < 0) {
    const room = Math.max(0, DAY_XP_NEG_CAP - (negXpUsed ?? 0));
    const floor = Math.max(acceptedXp, -Math.min(room, DAY_XP_NEG_CAP));
    if (floor > acceptedXp) clamped = true;
    acceptedXp = floor;
  }
  if (acceptedGold > 0) {
    acceptedGold = Math.min(acceptedGold, Math.max(0, DAY_GOLD_CAP - usedGold));
    if (acceptedGold < deltaGoldRaw) clamped = true;
  } else if (acceptedGold < 0) {
    const room = Math.max(0, DAY_GOLD_NEG_CAP - (negGoldUsed ?? 0));
    const floor = Math.max(acceptedGold, -Math.min(room, DAY_GOLD_NEG_CAP));
    if (floor > acceptedGold) clamped = true;
    acceptedGold = floor;
  }

  const newXp = Math.max(0, (prof.xp ?? 0) + Math.round(acceptedXp));
  const newGold = Math.max(0, (prof.coins ?? 0) + Math.round(acceptedGold));
  const newDayXp = Math.max(0, usedXp + Math.round(acceptedXp));
  const newDayGold = Math.max(0, usedGold + Math.round(acceptedGold));
  const newNegXp = Math.max(0, (negXpUsed ?? 0) + Math.max(0, -Math.round(acceptedXp)));
  const newNegGold = Math.max(0, (negGoldUsed ?? 0) + Math.max(0, -Math.round(acceptedGold)));

  // ---------- Yaz: defter + profil ----------
  const ledgerBase = { username, day, xp: newDayXp, gold: newDayGold, updated_at: now.toISOString() };
  let dayErr = null;
  if (negXpUsed === null) {
    // migration yok: negatif tavan kolonları olmadan yaz.
    const r = await supabase.from('daily_earnings').upsert(ledgerBase, { onConflict: 'username,day' });
    dayErr = r.error;
  } else {
    const r = await supabase
      .from('daily_earnings')
      .upsert({ ...ledgerBase, neg_xp: newNegXp, neg_gold: newNegGold }, { onConflict: 'username,day' });
    if (r.error && isColumnMissing(r.error)) {
      const retry = await supabase.from('daily_earnings').upsert(ledgerBase, { onConflict: 'username,day' });
      dayErr = retry.error;
    } else {
      dayErr = r.error;
    }
  }
  if (dayErr) {
    releaseRequestId();
    return json(req, 500, { error: 'ledger_write_failed' });
  }

  // Katman 4: tavan aşımı tespiti → profil bayraklanır (liderlikte ⚠️).
  const flagged = clamped || clockAhead;
  const updateFields = {
    xp: newXp,
    coins: newGold,
    last_sync_at: now.toISOString(),
    // Offline-First delta senkronu: istemciler yalnızca son senkrondan
    // sonra GÜNCELLENMİŞ kayıtları çeker (updated_at > last_synced_at).
    updated_at: now.toISOString(),
    ...(flagged
      ? {
          flagged: true,
          flagged_reason: clockAhead
            ? `clock_ahead (claimed ${claimedDay})`
            : `daily_cap_clamped (${day})`,
        }
      : {}),
  };
  if (bio !== null) updateFields.bio = bio;
  if (photoUrl !== null) updateFields.photo_url = photoUrl || null;
  const { error: profUpdErr } = await supabase
    .from('profiles')
    .update(updateFields)
    .eq('username', username);
  if (profUpdErr) {
    releaseRequestId();
    return json(req, 500, { error: 'profile_update_failed' });
  }

  return json(req, 200, {
    ok: true,
    serverXp: newXp,
    serverGold: newGold,
    acceptedXp,
    acceptedGold,
    day,
    flagged,
    ...(clockAhead ? { warn: 'clock_ahead' } : {}),
  });
});
