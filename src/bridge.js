'use strict';

/*
 * Quiet Timeline — köprü (ISOLATED world).
 *
 * "Filtrelemeyi bırak" listesinin asıl kaydı eklentinin kendi deposundadır
 * (chrome.storage.local). x.com'un localStorage'ı X tarafından (çıkış, hesap
 * değiştirme) ya da tarayıcının site verisi temizliğiyle silinebilir; bu depo
 * silinmez ve x.com / twitter.com ile tüm sekmelerde ortaktır.
 *
 * Her hesap ayrı bir anahtardır (allow:<id>): aynı anda iki sekmeden yapılan
 * eklemeler birbirini ezmez. Sayfa katmanıyla yalnızca postMessage ile konuşur.
 */

const PREFIX = 'allow:';
const FROM_PAGE = 'quiet-timeline:page';
const FROM_BRIDGE = 'quiet-timeline:bridge';
const LIMIT = 10000;

function isId(x) {
  return typeof x === 'string' && /^\d{1,25}$/.test(x);
}

function storage() {
  try {
    return chrome.storage.local;
  } catch (_) {
    return null; // eklenti güncellendi/kaldırıldı: bağlam geçersiz
  }
}

function sendToPage() {
  const s = storage();
  if (!s) return;
  try {
    s.get(null, (items) => {
      if (chrome.runtime.lastError || !items) return;
      const ids = Object.keys(items)
        .filter((k) => k.startsWith(PREFIX))
        .map((k) => k.slice(PREFIX.length))
        .filter(isId);
      window.postMessage({ source: FROM_BRIDGE, allowIds: ids }, location.origin);
    });
  } catch (_) {
    /* bağlam geçersiz */
  }
}

window.addEventListener('message', (e) => {
  const d = e.data;
  if (e.source !== window || !d || d.source !== FROM_PAGE || !Array.isArray(d.allowIds)) return;
  const items = {};
  for (const id of d.allowIds.slice(0, LIMIT)) if (isId(id)) items[PREFIX + id] = 1;
  const s = storage();
  if (!s || Object.keys(items).length === 0) return sendToPage();
  try {
    s.set(items, sendToPage);
  } catch (_) {
    /* bağlam geçersiz */
  }
});

// Başka sekmede (x.com ya da twitter.com) eklenen hesaplar bu sekmeye de gelsin.
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && Object.keys(changes).some((k) => k.startsWith(PREFIX))) sendToPage();
  });
} catch (_) {
  /* bağlam geçersiz */
}

sendToPage();
