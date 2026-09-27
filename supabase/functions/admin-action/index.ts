// ============================================================
// admin-action — Supabase Edge Function (Habit Tracker Yönetici Paneli)
// Admin hesabından gelen istekleri servis rolüyle işler:
//   login        — yönetici şifresini sunucuda doğrular, imzalı token döner
//   search_users — kullanıcı ara (isim benzerliği)
//   get_user     — profil detayı + 7 günlük XP trendi
//   ban / unban  — yasaklama (sync engellenir, liderlikten gizlenir)
//   adjust       — XP/altın cezası veya ödülü (pozitif/negatif)
//   transfer     — XP/altını bir kullanıcıdan başkasına aktar
//   grant/revoke — hediye: tema, avatar, çerçeve ver/geri al
//   unflag       — şüpheli bayrağını kaldır
//   logs         — denetim günlüğü (son 30 işlem)
//
// GÜVENLİK MODELİ (eski "client'ta gömülü ADMIN_KEY" modelinin yerine):
//   - İstemcide HİÇBİR gizli anahtar yoktur.
//   - `login`: istemci yönetici şifresinin hash'ini yollar; sunucu
//     ADMIN_PASSWORD_HASH (Secrets) ile karşılaştırır ve 12 saatlik
//     HMAC imzalı token döner.
//   - Diğer işlemler: `x-admin-token` başlığındaki imzalı token
//     doğrulanır. actor değeri token'dan TÜRETİLİR (istemciden alınmaz).
//   - Geçiş dönemi: ADMIN_KEY Secret'ı tanımlıysa eski istekler de kabul
//     edilir; anahtar kaynaktan ve istemciden TAMAMEN silinmiştir.
//   - Secrets (Dashboard → Edge Functions → Secrets):
//       ADMIN_PASSWORD_HASH  — hashPassword(şifre) çıktısı (16 hex)
//       ADMIN_TOKEN_SECRET   — rastgele uzun bir parola (token imzalama)
//       ADMIN_KEY            — (opsiyonel, geçiş) eski anahtar
//       ADMIN_USERNAME       — (opsiyonel, varsayılan "P4SH4")
//   - Secrets tanımlı değilse fonksiyon 503 döner (sessizce çalışmaz).
//
// Deploy: Verify JWT KAPALI (diğer fonksiyonlarla aynı) — kimlik
// doğrulama fonksiyonun İÇİNDE token ile yapılır.
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Gizli yapılandırma YALNIZCA ortam değişkenlerinden okunur.
// (Eski sürümde kaynak koda gömülü yedek anahtar vardı — kaldırıldı.)
const ADMIN_USERNAME = Deno.env.get('ADMIN_USERNAME') ?? 'P4SH4';
const ADMIN_PASSWORD_HASH = Deno.env.get('ADMIN_PASSWORD_HASH') ?? '';
const ADMIN_TOKEN_SECRET = Deno.env.get('ADMIN_TOKEN_SECRET') ?? '';
const LEGACY_ADMIN_KEY = Deno.env.get('ADMIN_KEY') ?? '';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 saat

const ITEM_TYPES = new Set(['theme', 'avatar', 'frame']);
const DAYS_7 = 6;
const USERNAME_RE = /^[A-Za-z0-9_ÇĞİÖŞÜçğıöşü. -]{2,32}$/;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function json(res, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validUsername(s) {
  return typeof s === 'string' && USERNAME_RE.test(s.trim());
}

// ---------- Basit bellek içi hız sınırı (best-effort) ----------
// Edge isolate'leri kısa ömürlüdür; asıl koruma platform katmanındaki
// (Supabase WAF / gateway) IP sınırıdır. Buradaki amaç confusionsuz
// brute-force ve çift dokunuş trafiğini kesmek.
const buckets = new Map();
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  b.count += 1;
  return b.count > limit;
}
function clientKey(req) {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : 'local') || 'local';
}

// ---------- İmzalı token (HMAC-SHA256) ----------
function b64urlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function b64urlDecode(str) {
  const pad = str.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(pad + '='.repeat((4 - (pad.length % 4)) % 4))));
}
async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function signToken(payload) {
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = await hmacHex(ADMIN_TOKEN_SECRET, body);
  return `${body}.${sig}`;
}
async function verifyToken(token) {
  if (!ADMIN_TOKEN_SECRET || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = await hmacHex(ADMIN_TOKEN_SECRET, body);
  if (sig.length !== expected.length) return null;
  // Zamanlama saldırılarına karşı sabit zamanlı karşılaştırma.
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body));
    if (!payload || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    if (payload.role !== 'admin') return null;
    return payload;
  } catch {
    return null;
  }
}

// Denetim günlüğüne ekler (asla isteği durdurmaz; hata yutulur).
// requestId verilirse tekrar oynatma (replay) tespiti için kaydedilir.
async function log(actor, action, target, detail, requestId = null) {
  try {
    await supabase.from('admin_logs').insert({
      actor,
      action,
      target: target ?? null,
      detail: detail ?? null,
      request_id: requestId,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    // günlük yazılamadı — işlem yine de tamamlanır
  }
}

// Aynı requestId ile daha önce uygulanmış mı? (adjust/transfer/grant)
async function alreadyApplied(requestId) {
  if (!requestId) return false;
  try {
    const { data, error } = await supabase
      .from('admin_logs')
      .select('id')
      .eq('request_id', requestId)
      .maybeSingle();
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

// Son 7 günün XP toplamı (liderlik trendiyle aynı hesap).
async function xp7dFor(username) {
  try {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - DAYS_7);
    const { data } = await supabase
      .from('daily_earnings')
      .select('xp')
      .eq('username', username)
      .gte('day', since.toISOString().slice(0, 10));
    return (data || []).reduce((sum, r) => sum + (r.xp || 0), 0);
  } catch (e) {
    return 0;
  }
}

// Profil detayı: recovery_hash ASLA istemciye dönmez (kolon listeli okuma).
async function getProfile(username) {
  const { data } = await supabase
    .from('profiles')
    .select(
      'id, username, name, emoji, streak, xp, coins, xp7d, avatar_id, frame_id, ' +
        'flagged, flagged_reason, banned, ban_reason, granted_items, bio, photo_url, ' +
        'vip_until, created_at, updated_at'
    )
    .eq('username', username)
    .maybeSingle();
  return data || null;
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
  const ipKey = clientKey(req);

  // ---------- login: yönetici şifresi sunucuda doğrulanır ----------
  if (action === 'login') {
    if (!ADMIN_PASSWORD_HASH || !ADMIN_TOKEN_SECRET) {
      return json(req, 503, { error: 'admin_not_configured' });
    }
    if (rateLimit(`login:${ipKey}`, 5, 60_000)) {
      return json(req, 429, { error: 'rate_limited' });
    }
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const passHash = typeof body?.passHash === 'string' ? body.passHash : '';
    if (username.toLowerCase() !== ADMIN_USERNAME.toLowerCase() || !passHash) {
      // Kullanıcı adı da şifre hash'i de yanlış: aynı hata mesajı (tahmin zor).
      return json(req, 403, { error: 'forbidden' });
    }
    // Sabit zamanlı karşılaştırma.
    let diff = passHash.length ^ ADMIN_PASSWORD_HASH.length;
    for (let i = 0; i < Math.max(passHash.length, ADMIN_PASSWORD_HASH.length); i += 1) {
      diff |= (passHash.charCodeAt(i) || 0) ^ (ADMIN_PASSWORD_HASH.charCodeAt(i) || 0);
    }
    if (diff !== 0) {
      await log(ADMIN_USERNAME, 'login_failed', null, 'bad_password');
      return json(req, 403, { error: 'forbidden' });
    }
    const exp = Date.now() + TOKEN_TTL_MS;
    const token = await signToken({ sub: ADMIN_USERNAME, role: 'admin', exp });
    await log(ADMIN_USERNAME, 'login', null, 'ok');
    return json(req, 200, { ok: true, token, expiresAt: exp });
  }

  // ---------- diğer işlemler: token veya geçiş anahtarı ----------
  let actor = null;
  const headerToken = req.headers.get('x-admin-token');
  if (headerToken) {
    const payload = await verifyToken(headerToken);
    if (payload) actor = payload.sub;
  }
  if (!actor && LEGACY_ADMIN_KEY && body?.adminKey === LEGACY_ADMIN_KEY) {
    // Geçiş dönemi: eski istemciler hâlâ adminKey yollar.
    // actor artık istemciden değil, yapılandırmadan gelir.
    actor = ADMIN_USERNAME;
  }
  if (!actor) {
    if (!ADMIN_PASSWORD_HASH || !ADMIN_TOKEN_SECRET) {
      return json(req, 503, { error: 'admin_not_configured' });
    }
    return json(req, 403, { error: 'forbidden' });
  }
  if (rateLimit(`act:${actor}`, 60, 60_000)) {
    return json(req, 429, { error: 'rate_limited' });
  }

  const target = typeof body?.target === 'string' ? body.target.trim() : '';
  // Tekrar oynatma koruması: istemci her değişimde benzersiz bir
  // requestId yollar; aynı id ile ikinci istek uygulanmaz.
  const requestId =
    typeof body?.requestId === 'string' && body.requestId.length <= 64
      ? body.requestId
      : null;

  switch (action) {
    case 'search_users': {
      const q = typeof body?.q === 'string' ? body.q.trim() : '';
      if (q.length < 1) return json(req, 400, { error: 'query_required' });
      if (q.length > 40) return json(req, 400, { error: 'query_too_long' });
      // ILIKE joker karakter kaçışı: % ve _ kullanıcı verisi olamaz.
      const escaped = q.replace(/[\\%_]/g, (m) => `\\${m}`);
      const { data, error } = await supabase
        .from('profiles')
        .select('username, xp, coins, flagged, banned, ban_reason, granted_items')
        .ilike('username', `%${escaped}%`)
        .order('xp', { ascending: false })
        .limit(25);
      if (error) return json(req, 500, { error: 'lookup_failed' });
      return json(req, 200, { ok: true, users: data || [] });
    }

    case 'get_user': {
      if (!validUsername(target)) return json(req, 400, { error: 'target_required' });
      const prof = await getProfile(target);
      if (!prof) return json(req, 404, { ok: false, error: 'not_found' });
      const xp7d = await xp7dFor(target);
      return json(req, 200, { ok: true, user: { ...prof, xp7d } });
    }

    case 'ban': {
      if (!validUsername(target)) return json(req, 400, { error: 'target_required' });
      if (target === actor) return json(req, 400, { error: 'cannot_ban_self' });
      const prof = await getProfile(target);
      if (!prof) return json(req, 404, { ok: false, error: 'not_found' });
      const reason =
        typeof body?.reason === 'string' ? body.reason.trim().slice(0, 200) : '';
      const { error } = await supabase
        .from('profiles')
        .update({
          banned: true,
          ban_reason: reason || null,
          flagged: true,
          flagged_reason: 'banned',
        })
        .eq('username', target);
      if (error) return json(req, 500, { error: 'ban_failed' });
      await log(actor, 'ban', target, reason || null, requestId);
      return json(req, 200, { ok: true });
    }

    case 'unban': {
      if (!validUsername(target)) return json(req, 400, { error: 'target_required' });
      const { error } = await supabase
        .from('profiles')
        .update({ banned: false, ban_reason: null })
        .eq('username', target);
      if (error) return json(req, 500, { error: 'unban_failed' });
      await log(actor, 'unban', target, null, requestId);
      return json(req, 200, { ok: true });
    }

    case 'adjust': {
      if (!validUsername(target)) return json(req, 400, { error: 'target_required' });
      const xp = Number(body?.xp);
      const coins = Number(body?.coins);
      if (!Number.isFinite(xp) || !Number.isFinite(coins)) {
        return json(req, 400, { error: 'invalid_amounts' });
      }
      // Makul sınır: tek işlemde ±100_000 (yanlış tuş/veri girişi koruması).
      if (Math.abs(xp) > 100_000 || Math.abs(coins) > 100_000) {
        return json(req, 400, { error: 'amount_too_large' });
      }
      if (xp === 0 && coins === 0) return json(req, 400, { error: 'empty_adjust' });
      if (await alreadyApplied(requestId)) {
        return json(req, 200, { ok: true, duplicate: true });
      }
      const prof = await getProfile(target);
      if (!prof) return json(req, 404, { ok: false, error: 'not_found' });
      const newXp = Math.max(0, (prof.xp ?? 0) + Math.round(xp));
      const newCoins = Math.max(0, (prof.coins ?? 0) + Math.round(coins));
      const { error } = await supabase
        .from('profiles')
        .update({ xp: newXp, coins: newCoins })
        .eq('username', target);
      if (error) return json(req, 500, { error: 'adjust_failed' });
      await log(actor, 'adjust', target, `xp:${xp} coins:${coins}`, requestId);
      return json(req, 200, { ok: true, user: { xp: newXp, coins: newCoins } });
    }

    case 'transfer': {
      // XP/altın aktarımı: source hesabından target hesabına.
      // source bakiyesi düşer, target bakiyesi artar. İkisi de aynı
      // istek içinde yazılır; kaynakta yeterli bakiye yoksa reddedilir.
      const source = typeof body?.source === 'string' ? body.source.trim() : '';
      if (!validUsername(source)) return json(req, 400, { error: 'source_required' });
      if (!validUsername(target)) return json(req, 400, { error: 'target_required' });
      if (source === target) return json(req, 400, { error: 'same_account' });
      const xp = Number(body?.xp);
      const coins = Number(body?.coins);
      if (!Number.isFinite(xp) || !Number.isFinite(coins)) {
        return json(req, 400, { error: 'invalid_amounts' });
      }
      const xpR = Math.round(xp);
      const coinsR = Math.round(coins);
      if (xpR < 0 || coinsR < 0) return json(req, 400, { error: 'negative_amount' });
      if (xpR > 100_000 || coinsR > 100_000) {
        return json(req, 400, { error: 'amount_too_large' });
      }
      if (xpR === 0 && coinsR === 0) return json(req, 400, { error: 'empty_transfer' });
      if (await alreadyApplied(requestId)) {
        return json(req, 200, { ok: true, duplicate: true });
      }

      const src = await getProfile(source);
      if (!src) return json(req, 404, { ok: false, error: 'source_not_found' });
      const dst = await getProfile(target);
      if (!dst) return json(req, 404, { ok: false, error: 'target_not_found' });

      if ((src.xp ?? 0) < xpR || (src.coins ?? 0) < coinsR) {
        // DİKKAT: bakiye rakamı döndürülmez (bilgi sızıntısı).
        return json(req, 409, { ok: false, error: 'insufficient_balance' });
      }

      const newSrcXp = (src.xp ?? 0) - xpR;
      const newSrcCoins = (src.coins ?? 0) - coinsR;
      const newDstXp = (dst.xp ?? 0) + xpR;
      const newDstCoins = (dst.coins ?? 0) + coinsR;

      // Kaynak düş + hedef artır (sıralı — ara durum kısa).
      const { error: srcErr } = await supabase
        .from('profiles')
        .update({ xp: newSrcXp, coins: newSrcCoins })
        .eq('username', source);
      if (srcErr) return json(req, 500, { error: 'source_update_failed' });

      const { error: dstErr } = await supabase
        .from('profiles')
        .update({ xp: newDstXp, coins: newDstCoins })
        .eq('username', target);
      if (dstErr) {
        // Hedef yazılamazsa kaynağı geri al (basit geri alma).
        await supabase
          .from('profiles')
          .update({ xp: src.xp ?? 0, coins: src.coins ?? 0 })
          .eq('username', source);
        return json(req, 500, { error: 'target_update_failed' });
      }

      await log(
        actor,
        'transfer',
        target,
        `from:${source} xp:${xpR} coins:${coinsR}`,
        requestId
      );
      return json(req, 200, {
        ok: true,
        source: { xp: newSrcXp, coins: newSrcCoins },
        target: { xp: newDstXp, coins: newDstCoins },
      });
    }

    case 'grant': {
      if (!validUsername(target)) return json(req, 400, { error: 'target_required' });
      const itemType = body?.itemType;
      const itemId = typeof body?.itemId === 'string' ? body.itemId.trim() : '';
      if (!ITEM_TYPES.has(itemType) || !itemId || itemId.length > 40) {
        return json(req, 400, { error: 'invalid_item' });
      }
      if (await alreadyApplied(requestId)) {
        return json(req, 200, { ok: true, duplicate: true });
      }
      const prof = await getProfile(target);
      if (!prof) return json(req, 404, { ok: false, error: 'not_found' });
      const list = Array.isArray(prof.granted_items) ? prof.granted_items : [];
      if (!list.some((i) => i.type === itemType && i.id === itemId)) {
        list.push({ type: itemType, id: itemId });
      }
      const { error } = await supabase
        .from('profiles')
        .update({ granted_items: list })
        .eq('username', target);
      if (error) return json(req, 500, { error: 'grant_failed' });
      await log(actor, 'grant', target, `${itemType}:${itemId}`, requestId);
      return json(req, 200, { ok: true });
    }

    case 'revoke': {
      if (!validUsername(target)) return json(req, 400, { error: 'target_required' });
      const itemType = body?.itemType;
      const itemId = typeof body?.itemId === 'string' ? body.itemId.trim() : '';
      if (!ITEM_TYPES.has(itemType) || !itemId || itemId.length > 40) {
        return json(req, 400, { error: 'invalid_item' });
      }
      const prof = await getProfile(target);
      if (!prof) return json(req, 404, { ok: false, error: 'not_found' });
      const list = (Array.isArray(prof.granted_items) ? prof.granted_items : []).filter(
        (i) => !(i.type === itemType && i.id === itemId)
      );
      const { error } = await supabase
        .from('profiles')
        .update({ granted_items: list })
        .eq('username', target);
      if (error) return json(req, 500, { error: 'revoke_failed' });
      await log(actor, 'revoke', target, `${itemType}:${itemId}`, requestId);
      return json(req, 200, { ok: true });
    }

    case 'unflag': {
      if (!validUsername(target)) return json(req, 400, { error: 'target_required' });
      const { error } = await supabase
        .from('profiles')
        .update({ flagged: false, flagged_reason: null })
        .eq('username', target);
      if (error) return json(req, 500, { error: 'unflag_failed' });
      await log(actor, 'unflag', target, null, requestId);
      return json(req, 200, { ok: true });
    }

    case 'logs': {
      const { data, error } = await supabase
        .from('admin_logs')
        .select('id, actor, action, target, detail, created_at')
        .order('id', { ascending: false })
        .limit(30);
      if (error) return json(req, 500, { error: 'logs_failed' });
      return json(req, 200, { ok: true, logs: data || [] });
    }

    default:
      return json(req, 400, { error: 'unknown_action' });
  }
});
