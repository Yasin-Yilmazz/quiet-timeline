/* global QuietTimelineFilter */
'use strict';

/*
 * Quiet Timeline — sayfa (MAIN world) katmanı.
 * Build sırasında filter.js ile tek bir IIFE içinde birleştirilir;
 * sayfaya global değişken sızdırmaz.
 */

const DEBUG = false;
const TAG = '[Quiet Timeline]';

function log() {
  if (!DEBUG) return;
  try {
    console.log.apply(console, [TAG].concat(Array.prototype.slice.call(arguments)));
  } catch (_) {
    /* yok say */
  }
}

// ---------------------------------------------------------------- kendi kimliğim

let cachedSelfId = null;

function readSelfId() {
  try {
    const m = /(?:^|;\s*)twid=([^;]*)/.exec(document.cookie || '');
    if (m) {
      const v = decodeURIComponent(m[1].replace(/^"|"$/g, ''));
      const id = /u=(\d+)/.exec(v);
      if (id) return id[1];
    }
  } catch (_) {
    /* çerez okunamadı */
  }
  try {
    const s = window.__INITIAL_STATE__;
    const id = s && s.session && s.session.user_id;
    if (id != null && /^\d+$/.test(String(id))) return String(id);
  } catch (_) {
    /* başlangıç durumu yok */
  }
  return null;
}

function getSelfId() {
  if (!cachedSelfId) cachedSelfId = readSelfId();
  return cachedSelfId;
}

// ---------------------------------------------------------------- filtre çağrısı

function runFilter(json, url) {
  const selfId = getSelfId();
  const res = QuietTimelineFilter.filterTimelineDetailed(json, { selfId });
  if (DEBUG) {
    const counts = {};
    for (const r of res.removed) counts[r.reason] = (counts[r.reason] || 0) + 1;
    log(
      QuietTimelineFilter.operationName(url) + ': ' + res.removed.length + ' girdi kaldırıldı',
      counts,
      res.removed,
      selfId ? '' : '(kendi kimliğim bulunamadı: mavi tik filtresi pasif)'
    );
    if (res.error) log('filtre hatası, cevap değiştirilmedi:', res.error);
  }
  return res;
}

// Değişiklik yoksa null döner; çağıran orijinali kullanır.
function filterText(text, url) {
  let json;
  try {
    json = JSON.parse(text);
  } catch (_) {
    return null;
  }
  const res = runFilter(json, url);
  return res.changed ? JSON.stringify(res.json) : null;
}

// ---------------------------------------------------------------- fetch

function patchFetch() {
  const origFetch = window.fetch;
  if (typeof origFetch !== 'function') return;

  const wrapped = function fetch(input, init) {
    let url = '';
    try {
      url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input && input.url) || '';
    } catch (_) {
      url = '';
    }
    const p = origFetch.apply(this, arguments);
    if (!QuietTimelineFilter.isTargetUrl(url)) return p;

    return p.then(function (res) {
      try {
        if (!res || !res.ok) return res;
        return res
          .clone()
          .text()
          .then(function (text) {
            const out = filterText(text, url);
            if (out == null) return res;
            const headers = new Headers(res.headers);
            headers.delete('content-length');
            headers.delete('content-encoding');
            const nr = new Response(out, { status: res.status, statusText: res.statusText, headers });
            try {
              Object.defineProperty(nr, 'url', { value: res.url });
              Object.defineProperty(nr, 'redirected', { value: res.redirected });
            } catch (_) {
              /* önemsiz */
            }
            return nr;
          })
          .catch(function () {
            return res;
          });
      } catch (_) {
        return res;
      }
    });
  };

  try {
    const nativeToString = Function.prototype.toString.call(origFetch);
    Object.defineProperty(wrapped, 'toString', { value: () => nativeToString, configurable: true });
  } catch (_) {
    /* önemsiz */
  }
  window.fetch = wrapped;
}

// ---------------------------------------------------------------- XMLHttpRequest

function patchXHR() {
  const XHR = window.XMLHttpRequest;
  if (typeof XHR !== 'function') return;
  const proto = XHR.prototype;
  const textDesc = Object.getOwnPropertyDescriptor(proto, 'responseText');
  const respDesc = Object.getOwnPropertyDescriptor(proto, 'response');
  if (!textDesc || !textDesc.get || !respDesc || !respDesc.get) return;

  const state = new WeakMap();
  const origOpen = proto.open;

  proto.open = function (method, url) {
    try {
      const u = url instanceof URL ? url.href : String(url);
      if (QuietTimelineFilter.isTargetUrl(u)) state.set(this, { url: u, done: false });
      else state.delete(this);
    } catch (_) {
      /* önemsiz */
    }
    return origOpen.apply(this, arguments);
  };

  // readyState 4'te bir kez filtreler ve sonucu önbelleğe alır.
  function filtered(xhr) {
    const st = state.get(xhr);
    if (!st || xhr.readyState !== 4) return null;
    if (st.done) return st;
    st.done = true;
    try {
      if (xhr.status < 200 || xhr.status >= 300) return st;
      const rt = xhr.responseType;
      if (rt === '' || rt === 'text') {
        const out = filterText(textDesc.get.call(xhr), st.url);
        if (out != null) st.text = out;
      } else if (rt === 'json') {
        const raw = respDesc.get.call(xhr);
        if (raw && typeof raw === 'object') {
          const res = runFilter(raw, st.url);
          if (res.changed) st.json = res.json;
        }
      }
    } catch (_) {
      /* orijinali kullan */
    }
    return st;
  }

  Object.defineProperty(proto, 'responseText', {
    configurable: true,
    enumerable: textDesc.enumerable,
    get: function () {
      const st = filtered(this);
      if (st && st.text != null) return st.text;
      return textDesc.get.call(this);
    },
  });

  Object.defineProperty(proto, 'response', {
    configurable: true,
    enumerable: respDesc.enumerable,
    get: function () {
      const st = filtered(this);
      if (st) {
        const rt = this.responseType;
        if ((rt === '' || rt === 'text') && st.text != null) return st.text;
        if (rt === 'json' && st.json !== undefined) return st.json;
      }
      return respDesc.get.call(this);
    },
  });
}

// ---------------------------------------------------------------- DOM yedek katmanı

// Yalnızca API filtresinden kaçan reklamlar için güvenlik ağı.
const AD_LABELS = new Set([
  'Ad', 'Ads', 'Promoted', 'Reklam', 'Sponsorlu', 'Tanıtılan',
  'Anzeige', 'Gesponsert', 'Publicidad', 'Promocionado', 'Sponsorisé', 'Annonce',
  'Sponsorizzato', 'Patrocinado', 'Promovido', 'Advertentie', 'Реклама', '広告', 'プロモーション', '광고',
]);

function isHomePath() {
  try {
    return location.pathname === '/home' || location.pathname === '/home/';
  } catch (_) {
    return false;
  }
}

function isAdArticle(article) {
  if (article.closest('[data-testid="placementTracking"]')) return true;
  const spans = article.querySelectorAll('span');
  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    if (s.children.length !== 0) continue;
    const t = (s.textContent || '').trim();
    if (!t || t.length > 20 || !AD_LABELS.has(t)) continue;
    if (s.closest('[data-testid="tweetText"],[data-testid="User-Name"],[data-testid="card.wrapper"]')) continue;
    return true;
  }
  return false;
}

const HIDDEN_ATTR = 'data-quiet-timeline-hidden';

function scanDom() {
  if (!isHomePath()) return;
  // Sanal liste hücreleri yeniden kullanırsa yanlış gizlenmiş hücreyi geri aç.
  document.querySelectorAll('[' + HIDDEN_ATTR + ']').forEach(function (cell) {
    const a = cell.matches('article') ? cell : cell.querySelector('article[data-testid="tweet"]');
    if (!a || !isAdArticle(a)) {
      cell.style.removeProperty('display');
      cell.removeAttribute(HIDDEN_ATTR);
    }
  });
  let n = 0;
  document.querySelectorAll('article[data-testid="tweet"]').forEach(function (a) {
    const cell = a.closest('[data-testid="cellInnerDiv"]') || a;
    if (cell.hasAttribute(HIDDEN_ATTR)) return;
    if (isAdArticle(a)) {
      cell.style.setProperty('display', 'none', 'important');
      cell.setAttribute(HIDDEN_ATTR, '');
      n++;
    }
  });
  if (n) log('DOM katmanı: ' + n + ' reklam gizlendi');
}

function startDomLayer() {
  if (typeof MutationObserver !== 'function') return;
  let scheduled = false;
  const schedule = function () {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      try {
        scanDom();
      } catch (_) {
        /* önemsiz */
      }
    }, 150);
  };
  const begin = function () {
    try {
      new MutationObserver(function () {
        if (isHomePath()) schedule();
      }).observe(document.documentElement, { childList: true, subtree: true });
      schedule();
    } catch (_) {
      /* önemsiz */
    }
  };
  if (document.documentElement) begin();
  else document.addEventListener('readystatechange', begin, { once: true });
}

// ---------------------------------------------------------------- başlat

try {
  patchFetch();
} catch (e) {
  log('fetch yaması başarısız', e);
}
try {
  patchXHR();
} catch (e) {
  log('XHR yaması başarısız', e);
}
try {
  startDomLayer();
} catch (e) {
  log('DOM katmanı başarısız', e);
}
