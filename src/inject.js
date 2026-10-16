/* global QuietTimelineFilter, QuietTimelineMute */
'use strict';

/*
 * Quiet Timeline — sayfa (MAIN world) katmanı.
 * Build sırasında filter.js ve mute.js ile tek bir IIFE içinde birleştirilir;
 * sayfaya global değişken sızdırmaz.
 *
 * - Reklamlar API cevabından tamamen çıkarılır.
 * - Takip edilmeyen mavi tikli tweetler sayfada kapalı gösterilir:
 *   [Göster] [Sessize al] [Filtrelemeyi bırak]
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

// ---------------------------------------------------------------- durum

const ALLOW_KEY = 'quiet-timeline:allow';
const FLAG_LIMIT = 5000;

const state = {
  flagged: new Map(), // tweetId → { userId, screenName, name }
  allowIds: loadAllow(), // filtresi bırakılan hesaplar (kalıcı, x.com localStorage)
  mutedIds: new Set(), // bu oturumda sessize alınanlar (kalıcı kayıt X'te)
  revealed: new Set(), // açılan tweetler (bu sayfa oturumu)
  bearer: null, // sayfanın kendi isteklerinden yakalanır
};

function loadAllow() {
  try {
    const arr = JSON.parse(localStorage.getItem(ALLOW_KEY) || '[]');
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && /^\d+$/.test(x)) : []);
  } catch (_) {
    return new Set();
  }
}

function saveAllow() {
  try {
    localStorage.setItem(ALLOW_KEY, JSON.stringify(Array.from(state.allowIds)));
  } catch (_) {
    /* depolama kapalı: yalnız bu oturumda geçerli */
  }
}

function rememberFlags(list) {
  for (const f of list) {
    const info = { userId: f.userId, screenName: f.screenName, name: f.name };
    for (const id of f.tweetIds) {
      state.flagged.delete(id);
      state.flagged.set(id, info);
    }
  }
  while (state.flagged.size > FLAG_LIMIT) state.flagged.delete(state.flagged.keys().next().value);
}

// ---------------------------------------------------------------- kendi kimliğim

let cachedSelfId = null;

function readSelfId() {
  try {
    const v = QuietTimelineMute.readCookie(document.cookie || '', 'twid');
    const id = v && /u=(\d+)/.exec(v.replace(/^"|"$/g, ''));
    if (id) return id[1];
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
  const res = QuietTimelineFilter.filterTimelineDetailed(json, {
    selfId,
    allowIds: state.allowIds,
    mutedIds: state.mutedIds,
  });
  if (res.flagged && res.flagged.length) {
    rememberFlags(res.flagged);
    scheduleScan();
  }
  if (DEBUG) {
    const counts = {};
    for (const r of res.removed) counts[r.reason] = (counts[r.reason] || 0) + 1;
    log(
      QuietTimelineFilter.operationName(url) + ': ' + res.removed.length + ' girdi kaldırıldı, ' +
        (res.flagged ? res.flagged.length : 0) + ' tweet kapalı gösterilecek',
      counts,
      res.removed,
      res.flagged,
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

function captureBearer(name, value) {
  try {
    if (String(name).toLowerCase() === 'authorization' && /^Bearer \S+$/.test(String(value))) {
      state.bearer = String(value);
    }
  } catch (_) {
    /* önemsiz */
  }
}

function captureFromHeaders(h) {
  try {
    if (!h) return;
    if (typeof h.forEach === 'function' && typeof h.get === 'function') h.forEach((v, k) => captureBearer(k, v));
    else if (Array.isArray(h)) h.forEach((p) => captureBearer(p[0], p[1]));
    else if (typeof h === 'object') Object.keys(h).forEach((k) => captureBearer(k, h[k]));
  } catch (_) {
    /* önemsiz */
  }
}

// ---------------------------------------------------------------- fetch

let origFetch = null;

function patchFetch() {
  origFetch = window.fetch;
  if (typeof origFetch !== 'function') return;

  const wrapped = function fetch(input, init) {
    let url = '';
    try {
      url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input && input.url) || '';
    } catch (_) {
      url = '';
    }
    if (!state.bearer) {
      captureFromHeaders(init && init.headers);
      if (input && typeof input === 'object' && input.headers) captureFromHeaders(input.headers);
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

  const xhrState = new WeakMap();
  const origOpen = proto.open;
  const origSetHeader = proto.setRequestHeader;

  proto.open = function (method, url) {
    try {
      const u = url instanceof URL ? url.href : String(url);
      if (QuietTimelineFilter.isTargetUrl(u)) xhrState.set(this, { url: u, done: false });
      else xhrState.delete(this);
    } catch (_) {
      /* önemsiz */
    }
    return origOpen.apply(this, arguments);
  };

  if (typeof origSetHeader === 'function') {
    proto.setRequestHeader = function (name, value) {
      if (!state.bearer) captureBearer(name, value);
      return origSetHeader.apply(this, arguments);
    };
  }

  // readyState 4'te bir kez filtreler ve sonucu önbelleğe alır.
  function filtered(xhr) {
    const st = xhrState.get(xhr);
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

// ---------------------------------------------------------------- sessize alma

function muteUser(userId) {
  let lang = '';
  try {
    lang = document.documentElement.lang || '';
  } catch (_) {
    /* önemsiz */
  }
  const req = QuietTimelineMute.buildMuteRequest({
    userId,
    origin: location.origin,
    csrfToken: QuietTimelineMute.readCookie(document.cookie || '', 'ct0'),
    bearer: state.bearer,
    lang,
  });
  if (!req || typeof origFetch !== 'function') return Promise.resolve(false);
  return origFetch
    .call(window, req.url, req.init)
    .then((res) => {
      log('sessize alma', userId, res.status);
      return res.ok;
    })
    .catch(() => false);
}

// ---------------------------------------------------------------- DOM katmanı

// Reklam tanıma: yalnızca API filtresinden kaçanlar için güvenlik ağı.
const AD_LABELS = new Set([
  'Ad', 'Ads', 'Promoted', 'Reklam', 'Sponsorlu', 'Tanıtılan',
  'Anzeige', 'Gesponsert', 'Publicidad', 'Promocionado', 'Sponsorisé', 'Annonce',
  'Sponsorizzato', 'Patrocinado', 'Promovido', 'Advertentie', 'Реклама', '広告', 'プロモーション', '광고',
]);

const TEXT = {
  tr: {
    label: 'Takip etmediğin mavi tikli hesap',
    show: 'Göster',
    mute: 'Sessize al',
    allow: 'Filtrelemeyi bırak',
    muting: 'Sessize alınıyor…',
    muteFailed: 'Sessize alınamadı, tekrar dene',
  },
  en: {
    label: "Paid-verified account you don't follow",
    show: 'Show',
    mute: 'Mute',
    allow: 'Stop filtering',
    muting: 'Muting…',
    muteFailed: "Couldn't mute, try again",
  },
};

function t() {
  try {
    if (/^tr\b/i.test(document.documentElement.lang || '')) return TEXT.tr;
  } catch (_) {
    /* önemsiz */
  }
  return TEXT.en;
}

const CELL_ATTR = 'data-quiet-timeline-hidden'; // 'ad' | 'muted'
const PH_CLASS = 'quiet-timeline-ph';
const STYLE_ID = 'quiet-timeline-style';

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
    const txt = (s.textContent || '').trim();
    if (!txt || txt.length > 20 || !AD_LABELS.has(txt)) continue;
    if (s.closest('[data-testid="tweetText"],[data-testid="User-Name"],[data-testid="card.wrapper"]')) continue;
    return true;
  }
  return false;
}

// Tweetin kendi bağlantısı (zaman damgası) ilk /status/ bağlantısıdır; alıntı kutusu sonra gelir.
function getTweetId(article) {
  const time = article.querySelector('a[href*="/status/"] time');
  const a = time && time.closest('a');
  const m = a && /\/status\/(\d+)/.exec(a.getAttribute('href') || '');
  return m ? m[1] : null;
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = [
    '.' + PH_CLASS + '{box-sizing:border-box;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;',
    'padding:12px 16px;border-bottom:1px solid var(--qt-border);cursor:pointer;',
    'font:14px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--qt-muted)}',
    '.' + PH_CLASS + ':hover{background:var(--qt-hover)}',
    '.' + PH_CLASS + ' .qt-text{flex:1 1 220px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.' + PH_CLASS + ' .qt-name{color:var(--qt-fg);font-weight:700}',
    '.' + PH_CLASS + ' .qt-actions{display:flex;flex-wrap:wrap;gap:8px}',
    '.' + PH_CLASS + ' button{font:inherit;font-weight:700;font-size:13px;line-height:1;padding:7px 14px;border-radius:9999px;',
    'border:1px solid var(--qt-btn-border);background:transparent;color:var(--qt-fg);cursor:pointer}',
    '.' + PH_CLASS + ' button:hover{background:var(--qt-hover)}',
    '.' + PH_CLASS + ' button:disabled{opacity:.6;cursor:default}',
    '.' + PH_CLASS + ' button.qt-mute{color:#f4212e;border-color:rgba(244,33,46,.45)}',
  ].join('');
  (document.head || document.documentElement).appendChild(st);
}

// X'in renk temasına uyum: gövde arka planının parlaklığına bakılır.
function applyTheme(el) {
  let dark = true;
  try {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(document.body).backgroundColor || '');
    if (m) dark = (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) / 255 < 0.5;
  } catch (_) {
    /* varsayılan: koyu */
  }
  const v = dark
    ? { fg: '#e7e9ea', muted: '#71767b', border: '#2f3336', btn: '#536471', hover: 'rgba(231,233,234,.06)' }
    : { fg: '#0f1419', muted: '#536471', border: '#eff3f4', btn: '#cfd9de', hover: 'rgba(15,20,25,.04)' };
  el.style.setProperty('--qt-fg', v.fg);
  el.style.setProperty('--qt-muted', v.muted);
  el.style.setProperty('--qt-border', v.border);
  el.style.setProperty('--qt-btn-border', v.btn);
  el.style.setProperty('--qt-hover', v.hover);
}

function button(label, cls, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(b);
  });
  return b;
}

function buildPlaceholder(tweetId, info) {
  const s = t();
  const ph = document.createElement('div');
  ph.className = PH_CLASS;
  ph.setAttribute('data-qt-for', tweetId);
  ph.setAttribute('role', 'button');
  ph.setAttribute('tabindex', '0');
  applyTheme(ph);

  const text = document.createElement('div');
  text.className = 'qt-text';
  text.append(s.label + ' · ');
  const name = document.createElement('span');
  name.className = 'qt-name';
  name.textContent = info.name || '';
  text.append(name);
  if (info.screenName) text.append(' @' + info.screenName);

  const reveal = () => {
    state.revealed.add(tweetId);
    scanNow();
  };
  const actions = document.createElement('div');
  actions.className = 'qt-actions';
  actions.append(
    button(s.show, 'qt-show', reveal),
    button(s.mute, 'qt-mute', (b) => {
      b.disabled = true;
      b.textContent = s.muting;
      muteUser(info.userId).then((ok) => {
        if (ok) {
          state.mutedIds.add(info.userId);
          scanNow();
        } else {
          b.disabled = false;
          b.textContent = s.muteFailed;
        }
      });
    }),
    button(s.allow, 'qt-allow', () => {
      state.allowIds.add(info.userId);
      saveAllow();
      scanNow();
    })
  );

  ph.append(text, actions);
  ph.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    reveal();
  });
  ph.addEventListener('keydown', (e) => {
    if (e.target === ph && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      reveal();
    }
  });
  return ph;
}

function setHidden(el, hidden) {
  if (hidden) {
    if (el.style.getPropertyValue('display') !== 'none') el.style.setProperty('display', 'none', 'important');
  } else if (el.style.getPropertyValue('display') === 'none') {
    el.style.removeProperty('display');
  }
}

function placeholderOf(article) {
  const prev = article.previousElementSibling;
  return prev && prev.classList.contains(PH_CLASS) ? prev : null;
}

function processArticle(article) {
  const cell = article.closest('[data-testid="cellInnerDiv"]') || article;
  let ph = placeholderOf(article);

  let mode = 'show';
  let tweetId = null;
  let info;
  if (isAdArticle(article)) {
    mode = 'ad';
  } else {
    tweetId = getTweetId(article);
    info = tweetId ? state.flagged.get(tweetId) : undefined;
    mode = QuietTimelineFilter.decideDisplay(info, tweetId, state);
  }

  // Hücre düzeyi: reklam ve sessize alınan hesap tamamen gizlenir.
  if (mode === 'ad' || mode === 'hide') {
    cell.setAttribute(CELL_ATTR, mode === 'ad' ? 'ad' : 'muted');
    setHidden(cell, true);
  } else if (cell.hasAttribute(CELL_ATTR)) {
    cell.removeAttribute(CELL_ATTR);
    setHidden(cell, false);
  }

  if (mode === 'collapse') {
    if (ph && ph.getAttribute('data-qt-for') !== tweetId) {
      ph.remove();
      ph = null;
    }
    if (!ph) article.parentElement.insertBefore(buildPlaceholder(tweetId, info), article);
    setHidden(article, true);
  } else {
    if (ph) ph.remove();
    // Hücre yoksa hücre = makale; reklam/sessiz durumda gizli kalmalı.
    if (!(cell === article && (mode === 'ad' || mode === 'hide'))) setHidden(article, false);
  }
}

function scanDom() {
  if (!isHomePath()) return;
  ensureStyle();
  // Makalesi kaybolmuş (sanal liste tarafından değiştirilmiş) yer tutucuları temizle.
  document.querySelectorAll('.' + PH_CLASS).forEach((ph) => {
    const next = ph.nextElementSibling;
    if (!next || !next.matches('article[data-testid="tweet"]')) ph.remove();
  });
  document.querySelectorAll('article[data-testid="tweet"]').forEach((a) => {
    try {
      processArticle(a);
    } catch (e) {
      log('DOM işleme hatası', e);
    }
  });
}

function scanNow() {
  try {
    scanDom();
  } catch (e) {
    log('DOM taraması başarısız', e);
  }
}

let scheduled = false;
function scheduleScan() {
  if (scheduled || typeof setTimeout !== 'function') return;
  scheduled = true;
  setTimeout(function () {
    scheduled = false;
    if (typeof document !== 'undefined' && document.querySelectorAll) scanNow();
  }, 100);
}

function startDomLayer() {
  if (typeof MutationObserver !== 'function') return;
  const begin = function () {
    try {
      new MutationObserver(function () {
        if (isHomePath()) scheduleScan();
      }).observe(document.documentElement, { childList: true, subtree: true });
      scheduleScan();
    } catch (_) {
      /* önemsiz */
    }
  };
  if (document.documentElement) begin();
  else document.addEventListener('readystatechange', begin, { once: true });

  // Başka sekmede "Filtrelemeyi bırak" denirse bu sekme de güncellensin.
  try {
    window.addEventListener('storage', (e) => {
      if (e.key === ALLOW_KEY) {
        state.allowIds = loadAllow();
        scheduleScan();
      }
    });
  } catch (_) {
    /* önemsiz */
  }
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
