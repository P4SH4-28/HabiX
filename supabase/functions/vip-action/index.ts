// ============================================================
// vip-action — Supabase Edge Function
// VIP (Season Pass) satın alımını sunucu tarafında doğrular:
// - Altın bakiyesi SUNUCU tarafındaki 'profiles.coins' değerinden
//   kontrol edilir (istemciye güvenilmez).
// - Ödeme kabul edilirse coins düşülür ve vip_until = şimdi + 30 gün
//   yazılır. Süresi dolmamış aktif VIP yeniden satın alınamaz.
// - İstemci aynı altın düşümünü yerel olarak yapar; delta senkronu
//   (sync-profile) iki taraf da eşit düştüğü için ayrışmaz.
//
// Deploy: Supabase Dashboard → Edge Functions (Verify JWT KAPALI).
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const VIP_PRICE_GOLD = 5000;
const VIP_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function json(res, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Bellek içi hız sınırı: kullanıcı başına dakikada 10 deneme.
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
  if (rateLimit(username, 10, 60_000)) {
    return json(req, 429, { error: 'rate_limited' });
  }

  let { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('username, coins, vip_until, banned, ban_reason')
    .eq('username', username)
    .maybeSingle();

  if (profErr && profErr.code !== 'PGRST116') {
    return json(req, 500, { error: 'profile_lookup_failed' });
  }
  if (prof?.banned) {
    return json(req, 403, { error: 'banned', reason: prof.ban_reason || null });
  }
  if (!prof) {
    return json(req, 404, { error: 'profile_not_found' });
  }

  const now = new Date();
  const vipUntil = prof.vip_until ? Date.parse(prof.vip_until) : NaN;
  if (!Number.isNaN(vipUntil) && vipUntil > now.getTime()) {
    return json(req, 409, { error: 'already_vip', vipUntil: prof.vip_until });
  }

  const coins = typeof prof.coins === 'number' ? prof.coins : 0;
  if (coins < VIP_PRICE_GOLD) {
    return json(req, 409, { error: 'insufficient_gold' });
  }

  const newVipUntil = new Date(now.getTime() + VIP_DURATION_MS).toISOString();

  // Atomik: altın düş + VIP süresi uzat. Koşullu güncelleme (.eq coins)
  // eşzamanlı çift harcamayı engeller; .select() ile ETKİLENEN SATIR
  // sayısına bakılır (0 satır = çakışma → indirim uygulanmadan döner).
  const { data: updatedRows, error: updateErr } = await supabase
    .from('profiles')
    .update({
      coins: coins - VIP_PRICE_GOLD,
      vip_until: newVipUntil,
      last_sync_at: now.toISOString(),
    })
    .eq('username', username)
    .eq('coins', coins)
    .select('coins, vip_until');

  if (updateErr) {
    return json(req, 500, { error: 'vip_purchase_failed' });
  }
  if (!updatedRows || updatedRows.length === 0) {
    // Bakiye bu arada değişti: hiçbir şey düşülmedi — kullanıcıya dene dese.
    return json(req, 409, { error: 'concurrency_conflict' });
  }

  return json(req, 200, {
    ok: true,
    vipUntil: newVipUntil,
    coins: coins - VIP_PRICE_GOLD,
    price: VIP_PRICE_GOLD,
    durationDays: 30,
  });
});
