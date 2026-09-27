// ============================================================
// profileService.js — Supabase profil servisi (Katman 3 doğrulamalı)
// Kullanıcının XP/Altın kazançları 'sync-profile' Edge Function'ına
// DELTA olarak gönderilir; fonksiyon günlük tavanı sunucu tarafında
// doğrular (daily_earnings defteri) ve yalnızca kabul edilen farkı
// 'profiles' tablosuna yazar. Böylece saat ileri alma, veri oynatma
// ve doğrudan tabloya yazma ile farm yapılamaz.
// - Kimlik kullanıcı adıyla yürütülür (uygulama Supabase Auth kullanmaz).
// - Mutlak (toplam) değer ASLA istemciden yazılmaz: 404/eksik fonksiyon
//   durumunda sessiz mutlak upsert yolunun güvenlik açığı vardı ve RLS
//   tarafından zaten engelleniyordu — kaldırıldı.
// ============================================================
import { supabase, SUPABASE_URL } from '../config/supabase';
import { edgeFetch } from './edgeFetch';

const SYNC_FN_URL = `${SUPABASE_URL}/functions/v1/sync-profile`;
// Görev ödülü onayı (Katman 3): bekleme süresi ve günlük ödül limitleri
// 'sync-quest' Edge Function'ında SUNUCU saatine göre doğrulanır. Cihaz
// saati oynatılsa bile ödül verilmez; bu fonksiyon yalnızca "onay" döner,
// ödül miktarları yine sync-profile'in günlük tavanından geçer.
const QUEST_FN_URL = `${SUPABASE_URL}/functions/v1/sync-quest`;

// Sunucudaki mevcut profil toplamlarını döndürür (delta köprüsü için).
// Dönüş: { ok: true, profile } — profile null ise kayıt yok demektir.
//        { ok: false }         — ağ/izin hatası: SONUÇ GÜVENİLİR DEĞİL.
// Bu ayrım kritiktir: hatayı "kayıt yok" sanıp köprüyü 0'dan
// başlatırsak sunucudaki mevcut XP yeniden gönderilerek çiftlenirdi.
// Yanıt ayrıca ban durumunu ve admin hediyesi ürünleri içerir.
export async function getServerProfile(currentUsername) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('xp, coins, banned, ban_reason, granted_items, bio, photo_url')
      .eq('username', currentUsername)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: true, profile: null };
    return {
      ok: true,
      profile: {
        xp: data.xp || 0,
        coins: data.coins || 0,
        banned: !!data.banned,
        banReason: data.ban_reason || null,
        grantedItems: Array.isArray(data.granted_items) ? data.granted_items : [],
        bio: data.bio || '',
        photoUrl: data.photo_url || null,
      },
    };
  } catch (e) {
    return { ok: false };
  }
}

// Profil meta bilgilerini (bio / profil fotoğrafı) sunucuya yazar.
// sync-profile'i deltasız çağırır; 10 sn rate limit'e takılırsa sessiz geçer.
export async function updateProfileMeta(
  currentUsername,
  { bio = null, photoUrl = null } = {}
) {
  try {
    const r = await edgeFetch(SYNC_FN_URL, {
      body: {
        username: currentUsername,
        deltaXp: 0,
        deltaGold: 0,
        claimedDay: null,
        ...(bio !== null ? { bio } : {}),
        ...(photoUrl !== null ? { photoUrl } : {}),
      },
    });
    if (!r.ok) return { ok: false, error: r.data?.error || `Sunucu hatası (${r.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Sunucuya ulaşılamadı (çevrimdışı mısın?)' };
  }
}

// Kullanıcının kazanç deltasını sunucuya gönderir.
// - deltaXp: son senkrondan bu yana kazanılan XP (geri alma negatif olabilir)
// - deltaGold: son senkrondan bu yana kazanılan altın (ceza negatif olabilir)
// - bankDelta: XP kumbarasının net değişimi (sunucu da aynı kuralı uygular)
// - claimedDay: cihazın "bugün" anahtarı (sunucu günüyle +1 gün toleransı)
// - requestId: yayın TEKRARI koruması (idempotency). Aynı delta'yı yeniden
//   gönderirken AYNI id kullanılır; sunucu aynı id'yi ikinci kez uygulamaz
//   (yanıt kaybı sonrası çift kredi engellenir) ve güncel toplamları döndürür.
// Başarı: { ok: true, data: { serverXp, serverGold, acceptedXp, acceptedGold, day, flagged, duplicate } }
export async function updateProfileData(
  currentUsername,
  { deltaXp = 0, deltaGold = 0, bankDelta = 0, claimedDay = null, requestId = null } = {}
) {
  try {
    const r = await edgeFetch(SYNC_FN_URL, {
      body: {
        username: currentUsername,
        deltaXp,
        deltaGold,
        bankDelta,
        claimedDay,
        ...(requestId ? { requestId } : {}),
      },
    });

    // Edge Function henüz deploy edilmemiş: bu bir yapılandırma hatasıdır;
    // istemci mutlak değer yazamaz (yazsa RLS zaten engellerdi) — net hata döner.
    if (r.status === 404) {
      return { ok: false, error: 'sync_not_deployed', warn: 'sync_not_deployed' };
    }
    if (!r.ok) {
      return {
        ok: false,
        error: r.data?.error || `Senkron hatası (${r.status})`,
        warn: r.data?.warn,
      };
    }
    return { ok: true, data: r.data, warn: r.data?.warn };
  } catch (e) {
    return { ok: false, error: 'Sunucuya ulaşılamadı (çevrimdışı mısın?)' };
  }
}

// Görev ödülünü sunucuda onaylatır. Dönüş:
//   ok: true → onaylandı (bekleme + günlük limit temiz)
//   ok: false, error: 'cooldown' + remainingMs → bekleme süresi dolmadı
//   ok: false, error: 'daily_claim_limit' → günlük ödül limiti doldu
//   ok: false, error: 'banned' → hesap yasaklandı
//   ok: false, error: diğer → bağlantı/sunucu hatası
export async function claimQuestServer(username, questId) {
  try {
    const r = await edgeFetch(QUEST_FN_URL, { body: { username, questId } });
    const data = r.data;
    if (r.status === 403) {
      return { ok: false, error: data?.error || 'banned' };
    }
    if (r.status === 409) {
      return {
        ok: false,
        error: data?.error || 'rejected',
        remainingMs: typeof data?.remainingMs === 'number' ? data.remainingMs : 0,
      };
    }
    if (!r.ok) {
      return { ok: false, error: data?.error || `Sunucu hatası (${r.status})` };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: 'Sunucuya ulaşılamadı (çevrimdışı mısın?)' };
  }
}
