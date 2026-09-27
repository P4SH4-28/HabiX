// ============================================================
// adminService.js — Yönetici Paneli sunucu servisi
// admin-action Edge Function'ına istek gönderir.
//
// GÜVENLİK: İstemcide hiçbir gizli anahtar tutulmaz. Yönetici girişi
// sunucuda doğrulanır (admin-action `login`) ve 12 saatlik imzalı bir
// token alınır; sonraki tüm işlemler bu token'la yapılır. Kimlik
// doğrulamanın tamamı sunucudadır — gizli bilgi APK'ya gömülmez.
//
// Token yaşam döngüsü AuthContext yönetir (girişte alır, çıkışta siler,
// oturum yenilenince geri yükler).
// ============================================================
import { edgeFetch } from './edgeFetch';
import { SUPABASE_URL } from '../config/supabase';

const FN_URL = `${SUPABASE_URL}/functions/v1/admin-action`;

// Oturum token'ı (yalnızca bellekte; kalıcı kopyası AuthContext'te).
let adminToken = null;

export function setAdminToken(token) {
  adminToken = typeof token === 'string' && token.length > 0 ? token : null;
}

export function getAdminToken() {
  return adminToken;
}

// Yönetici girişi: şifre hash'i sunucuda doğrulanır.
// Başarı: { ok: true, token, expiresAt }
// Hata:   { ok: false, error } — 'forbidden' | 'admin_not_configured' |
//         'rate_limited' | bağlantı hatası
export async function adminLogin(username, passHash) {
  try {
    const r = await edgeFetch(FN_URL, { body: { action: 'login', username, passHash } });
    if (!r.ok) {
      const err = r.data?.error || `Sunucu hatası (${r.status})`;
      return { ok: false, error: adminErrorText(err), code: err };
    }
    const token = r.data?.token;
    if (!token) return { ok: false, error: 'Geçersiz sunucu yanıtı', code: 'invalid_response' };
    setAdminToken(token);
    return { ok: true, token, expiresAt: r.data?.expiresAt };
  } catch (e) {
    return { ok: false, error: 'Sunucuya ulaşılamadı (çevrimdışı mısın?)', code: 'offline' };
  }
}

// Değiştiren işlemler için tekil istek kimliği (tekrar oynatma koruması).
const MUTATING = new Set([
  'ban',
  'unban',
  'adjust',
  'transfer',
  'grant',
  'revoke',
  'unflag',
]);
function makeRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Sunucu hata kodlarını kullanıcıya gösterilebilir metne çevirir.
// Teknik kodlar arayüze asla çıplak yansıtılmaz.
export function adminErrorText(code) {
  switch (code) {
    case 'forbidden':
      return 'Yönetici oturumu reddedildi — çıkış yapıp tekrar giriş yap';
    case 'session_expired':
      return 'Yönetici oturumu bulunamadı — çıkış yapıp tekrar giriş yap';
    case 'admin_not_configured':
      return 'Yönetici erişimi sunucuda yapılandırılmamış (Secrets eksik)';
    case 'rate_limited':
      return 'Çok fazla istek gönderildi — biraz bekleyip tekrar dene';
    case 'duplicate':
      return 'Bu işlem zaten uygulandı';
    case 'not_found':
      return 'Kullanıcı bulunamadı';
    case 'insufficient_balance':
      return 'Kaynak hesapta yeterli bakiye yok';
    default:
      return typeof code === 'string' ? code : 'Beklenmeyen bir hata oluştu';
  }
}

// Admin işlemi çalıştırır. Başarı: { ok: true, data } | { ok: false, error }.
// action: login | search_users | get_user | ban | unban | adjust |
//         grant | revoke | unflag | logs
export async function adminAction(action, payload = {}) {
  if (!adminToken) return { ok: false, error: 'session_expired' };
  try {
    const r = await edgeFetch(FN_URL, {
      body: {
        action,
        ...(MUTATING.has(action) ? { requestId: makeRequestId() } : {}),
        ...payload,
      },
      headers: { 'x-admin-token': adminToken },
    });
    if (!r.ok) {
      const err = r.data?.error || `Sunucu hatası (${r.status})`;
      // Token süresi dolmuş / geçersiz: oturumu temizle ki UI yeniden sorsun.
      if (r.status === 403 && err === 'forbidden') setAdminToken(null);
      return { ok: false, error: adminErrorText(err), code: err };
    }
    return { ok: true, data: r.data };
  } catch (e) {
    return { ok: false, error: 'Sunucuya ulaşılamadı (çevrimdışı mısın?)' };
  }
}
