// ============================================================
// recovery-action — Supabase Edge Function (Hesap kurtarma)
// Şifre sıfırlama için kurtarma anahtarını yönetir:
// - "set":    recovery_hash yazar. Profilde hiç anahtar yoksa serbest;
//             mevcut anahtar varsa yalnızca ESKİ anahtarın hash'iyle
//             değiştirilebilir (başkasının anahtarını üzerine yazma
//             engellenir — kimlik yok, bu yüzden bu kontrol şart).
// - "verify": verilen hash ile saklanan hash'i karşılaştırır; uyuşursa
//             ok:true döner (istemci yeni şifreyi cihaza yazar).
// Güvenlik: istemci anahtarı recovery_hash sütununu OKUYAMAZ (RLS);
// bu fonksiyon yalnızca servis rolüyle çalışır. Hız sınırı ayrı bir
// sayaçla tutulur (IP + kullanıcı) — normal senkronu etkilemez.
//
// Deploy: Supabase Dashboard → Edge Functions → recovery-action →
// index.ts içeriğini yapıştır → Deploy (JWT doğrulaması KAPALI).
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// ---------- Hız sınırları (ayrı anahtar: sync'in last_sync_at'ı KULLANILMAZ) ----------
// Eski kod last_sync_at üzerinden 10 sn kısıtı uyguluyordu; bu hem normal
// senkronu kilitleyebiliyor hem de gerçek zamanlı brute-force koruması
// sağlamıyordu. Artık IP + kullanıcı adı bazlı, bellek içi sayaç var.
const buckets = new Map<string, { count: number; reset: number }>();
function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  b.count += 1;
  return b.count > limit;
}
function clientKey(req): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : 'local') || 'local';
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function json(res, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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

  const action = typeof body?.action === 'string' ? body.action : '';
  if (action !== 'set' && action !== 'verify') {
    return json(req, 400, { error: 'invalid_action' });
  }
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  if (!username || username.length < 2) {
    return json(req, 400, { error: 'username_required' });
  }
  const recoveryHash = typeof body?.recoveryHash === 'string' ? body.recoveryHash.trim() : '';
  if (!recoveryHash || recoveryHash.length < 8) {
    return json(req, 400, { error: 'recovery_hash_required' });
  }
  // Eski anahtarın hash'i (yalnızca "set" için): mevcut anahtar varsa
  // değişiklik için eski anahtarın doğrulanması gerekir.
  const oldHash = typeof body?.oldHash === 'string' ? body.oldHash.trim() : '';

  const now = new Date();

  // ---------- Profili getir ----------
  let { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('username, recovery_hash, last_sync_at')
    .eq('username', username)
    .maybeSingle();

  if (profErr && profErr.code !== 'PGRST116') {
    return json(req, 500, { error: 'profile_lookup_failed' });
  }

  // ---------- Hız sınırları ----------
  // Aynı IP: dakikada 20 istek (kendi cihazına yeterli).
  // IP + kullanıcı: 5 dakikada 12 deneme (anahtar tahmini yavaşlatır).
  const ip = clientKey(req);
  if (hit(`ip:${ip}`, 20, 60_000) || hit(`ipu:${ip}:${username}`, 12, 300_000)) {
    return json(req, 429, { error: 'rate_limited', retryAfterMs: 60_000 });
  }

  // ---------- "verify": hash karşılaştır ----------
  if (action === 'verify') {
    if (!prof?.recovery_hash) {
      return json(req, 404, { error: 'no_recovery_key' });
    }
    const ok = prof.recovery_hash === recoveryHash;
    if (!ok) {
      // Yanlış deneme: sayaç zaten hit() içinde arttı — 401 dön.
      return json(req, 401, { error: 'invalid_recovery' });
    }
    return json(req, 200, { ok: true });
  }

  // ---------- "set": anahtar yaz (üzerine yazma koruması) ----------
  // Profil yoksa yeni kayıt açılır (kayıt akışı; profiller zaten
  // sync-profile ile kullanıcı adı bazlı oluşturuluyor).
  if (!prof) {
    const { error: createErr } = await supabase.from('profiles').insert({
      username,
      xp: 0,
      coins: 0,
      recovery_hash: recoveryHash,
      last_sync_at: now.toISOString(),
    });
    if (createErr) return json(req, 500, { error: 'profile_create_failed' });
    return json(req, 200, { ok: true });
  }

  if (prof.recovery_hash) {
    // Mevcut anahtar yalnızca KENDİ eski anahtarının hash'iyle değişebilir.
    // (İstemci, kurtarma akışında önce verify eder, sonra yeni set yapar.)
    if (oldHash !== prof.recovery_hash) {
      return json(req, 401, { error: 'invalid_recovery' });
    }
  }

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ recovery_hash: recoveryHash, last_sync_at: now.toISOString() })
    .eq('username', username);
  if (updErr) return json(req, 500, { error: 'profile_update_failed' });

  return json(req, 200, { ok: true });
});
