// ============================================================
// edgeFetch.js — Edge Function çağrıları için ortak HTTP katmanı
// Neden var:
//  1) Tekrarlanan fetch + AbortController + JSON ayrıştırma kodunu
//     8 serviste yeniden yazmak yerine tek yerde toplar.
//  2) Edge Function yanıtlarının HTTP "Date" başlığından SUNUCU saatini
//     okur. Eskiden yalnızca Supabase tablo sorguları wrapFetch üzerinden
//     geçtiği için saf Edge Function trafiği sunucu saatini tazelemiyor,
//     bu da "saat taze değil" kapısı gereksiz yere kilitleniyordu.
// Ağ hataları çağıranın kendi try/catch'ine bırakılır (servislerin
// kullanıcıya özel hata mesajları vardır).
// ============================================================
import { setServerOffset } from './serverClock';

export const EDGE_TIMEOUT_MS = 10000;

// Edge Function'a JSON POST atar.
// Dönüş: { ok, status, data, warn } — data JSON değilse null.
// HTTP hataları fırlatmaz (status ile bildirilir); yalnızca ağ/zaman
// aşımı hataları fırlatır.
export async function edgeFetch(
  url,
  { body = null, headers = {}, timeoutMs = EDGE_TIMEOUT_MS, method = 'POST' } = {}
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined || body === null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    // Sunucu saatini tazele (zaman farm'ı koruması).
    try {
      const dateHeader = res && res.headers && res.headers.get ? res.headers.get('date') : null;
      if (dateHeader) {
        const serverTime = Date.parse(dateHeader);
        if (!Number.isNaN(serverTime)) setServerOffset(serverTime);
      }
    } catch (e) {
      // Başlık okunamadı: mevcut offset korunur.
    }
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      // JSON olmayan yanıt: data null kalır.
    }
    return { ok: res.ok, status: res.status, data, warn: data?.warn };
  } finally {
    clearTimeout(timer);
  }
}
