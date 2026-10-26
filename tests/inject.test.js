'use strict';

// Derlenmiş content.js'i sahte bir tarayıcı ortamında (vm + küçük sahte DOM)
// çalıştırıp fetch / XHR yamalarını ve kapalı tweet arayüzünü uçtan uca doğrular.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { bundleContentScript, bundleBridgeScript } = require('../scripts/build');
const { Document, h } = require('./helpers/fake-dom');

const FIX = path.join(__dirname, 'fixtures');
const HOME = fs.readFileSync(path.join(FIX, 'home-timeline.json'), 'utf8');
const { selfId: SELF } = JSON.parse(fs.readFileSync(path.join(FIX, 'self.json'), 'utf8'));

const HOME_URL = 'https://x.com/i/api/graphql/abc/HomeTimeline?variables=%7B%7D';
const DETAIL_URL = 'https://x.com/i/api/graphql/abc/TweetDetail?variables=%7B%7D';
const MUTE_URL = 'https://x.com/i/api/1.1/mutes/users/create.json';
const PROMO = 'promoted-tweet-1006-a1b2c3';
const BUNDLE = bundleContentScript();
const BRIDGE = bundleBridgeScript();

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function server(url) {
  if (url.includes('/BrokenJson')) return '{bozuk json';
  return HOME; // her uç noktaya aynı gövde: filtre yalnız hedeflerde çalışmalı
}

class FakeXHR {
  constructor() {
    this.readyState = 0;
    this.status = 0;
    this.responseType = '';
  }
  open(method, url) {
    this._url = String(url);
    this.readyState = 1;
  }
  setRequestHeader() {}
  send() {
    this._body = server(this._url);
    this._json = undefined;
    this.status = 200;
    this.readyState = 4;
    if (this.onload) this.onload();
  }
}
Object.defineProperty(FakeXHR.prototype, 'responseText', {
  configurable: true,
  enumerable: true,
  get() {
    if (this.responseType !== '' && this.responseType !== 'text') throw new Error('InvalidStateError');
    return this.readyState === 4 ? this._body : '';
  },
});
Object.defineProperty(FakeXHR.prototype, 'response', {
  configurable: true,
  enumerable: true,
  get() {
    if (this.readyState !== 4) return null;
    if (this.responseType === 'json') {
      if (this._json === undefined) this._json = JSON.parse(this._body);
      return this._json;
    }
    return this._body;
  },
});

function fakeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

// Aynı penceredeki MAIN ve ISOLATED dünyalar postMessage'ı paylaşır.
function attachBus(bus, win) {
  win.addEventListener = (type, fn) => {
    // Bağlam içindeki `window`, vm'nin sardığı global nesnedir; e.source onunla eşleşmeli.
    if (type === 'message') bus.push({ win: vm.runInContext('globalThis', win), fn });
  };
  win.postMessage = (data) => {
    const copy = structuredClone(data);
    setTimeout(() => bus.forEach((l) => l.fn({ data: structuredClone(copy), source: l.win })), 0);
  };
}

// Sekmeler arasında ortak eklenti deposu (chrome.storage.local).
function fakeChrome(data = {}) {
  const listeners = [];
  return {
    data,
    runtime: { lastError: undefined },
    storage: {
      local: {
        get: (_, cb) => setTimeout(() => cb(Object.assign({}, data)), 0),
        set: (items, cb) =>
          setTimeout(() => {
            const changes = {};
            for (const k of Object.keys(items)) {
              if (data[k] !== items[k]) changes[k] = { newValue: items[k] };
              data[k] = items[k];
            }
            if (Object.keys(changes).length) listeners.forEach((fn) => fn(changes, 'local'));
            if (cb) cb();
          }, 0),
      },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
  };
}

function makeEnv({
  cookie = `twid=u%3D${SELF}; ct0=abc123def; lang=tr`,
  initialState,
  pathname = '/home',
  muteStatus = 200,
  storage = fakeStorage(),
  lang = 'tr',
  chrome = null, // verilirse köprü (bridge.js) de çalışır
} = {}) {
  const doc = new Document();
  doc.cookie = cookie;
  doc.documentElement.lang = lang;
  const calls = [];
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    structuredClone,
    URL,
    Headers,
    Response,
    Request,
    XMLHttpRequest: FakeXHR,
    localStorage: storage,
    location: { pathname, origin: 'https://x.com' },
    document: doc,
    getComputedStyle: () => ({ backgroundColor: 'rgb(0, 0, 0)' }),
    fetch: async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      calls.push({ url, init });
      if (url === MUTE_URL) return new Response('{}', { status: muteStatus });
      return new Response(server(url), { status: 200, headers: { 'content-type': 'application/json', 'content-length': '999' } });
    },
  };
  if (initialState) sandbox.__INITIAL_STATE__ = initialState;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  if (chrome) {
    const bus = [];
    attachBus(bus, sandbox);
    const iso = { chrome, location: sandbox.location };
    iso.window = iso;
    attachBus(bus, iso);
    vm.createContext(iso);
    vm.runInContext(BRIDGE, iso, { filename: 'bridge.js' });
  }
  vm.runInContext(BUNDLE, sandbox, { filename: 'content.js' });
  return { env: sandbox, doc, calls, storage };
}

// X'in tweet hücresine benzeyen yapı. displayName "Ad" bilerek: reklam sanılmamalı.
function tweetCell(doc, id, { ad = false, quoteOf = null } = {}) {
  const art = h(
    doc,
    'article',
    { 'data-testid': 'tweet' },
    h(doc, 'div', { 'data-testid': 'User-Name' }, h(doc, 'span', {}, 'Ad')),
    h(doc, 'a', { href: `/someone/status/${id}` }, h(doc, 'time', {})),
    h(doc, 'div', { 'data-testid': 'tweetText' }, h(doc, 'span', {}, 'Reklam metni değil')),
    quoteOf ? h(doc, 'div', {}, h(doc, 'a', { href: `/other/status/${quoteOf}` }, h(doc, 'time', {}))) : '',
    ad ? h(doc, 'div', {}, h(doc, 'span', {}, 'Reklam')) : ''
  );
  const cell = h(doc, 'div', { 'data-testid': 'cellInnerDiv' }, h(doc, 'div', {}, art));
  doc.body.append(cell);
  return { cell, art };
}

const hidden = (el) => el.style.getPropertyValue('display') === 'none';
const placeholder = (art) => {
  const p = art.previousElementSibling;
  return p && p.classList.contains('quiet-timeline-ph') ? p : null;
};
const ids = (json) => json.data.home.home_timeline_urt.instructions[0].entries.map((e) => e.entryId);

async function loadHome(ctx, init) {
  const json = await (await ctx.env.fetch(HOME_URL, init)).json();
  await wait(150); // zamanlanmış DOM taraması
  return json;
}

// ------------------------------------------------------------ API katmanı

test('sayfaya global sızdırmaz', () => {
  const { env } = makeEnv();
  for (const k of ['QuietTimelineFilter', 'QuietTimelineMute', 'module', 'state']) assert.equal(env[k], undefined, k);
});

test('fetch: reklam kalkar, mavi tikli tweet JSON\'da kalır, Response korunur', async () => {
  const { env } = makeEnv();
  const res = await env.fetch(HOME_URL);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/json');
  assert.equal(res.headers.get('content-length'), null);
  const json = await res.json();
  assert.ok(!ids(json).includes(PROMO));
  assert.ok(ids(json).includes('tweet-1002'));
  assert.ok(ids(json).includes('tweet-1012'));
});

test('fetch: Request nesnesi ve URL nesnesi ile çağrı', async () => {
  const { env } = makeEnv();
  const a = await (await env.fetch(new Request(HOME_URL))).json();
  const b = await (await env.fetch(new URL(HOME_URL))).json();
  assert.ok(!ids(a).includes(PROMO));
  assert.ok(!ids(b).includes(PROMO));
});

test('fetch: hedef dışı uç noktalara dokunulmaz', async () => {
  const { env } = makeEnv();
  assert.equal(await (await env.fetch(DETAIL_URL)).text(), HOME);
});

test('fetch: bozuk JSON orijinal haliyle geçer', async () => {
  const { env } = makeEnv();
  const text = await (await env.fetch('https://x.com/i/api/graphql/abc/HomeTimeline/BrokenJson')).text();
  assert.equal(text, '{bozuk json');
});

test('XHR responseType="" — responseText ve response', () => {
  const { env } = makeEnv();
  const x = new env.XMLHttpRequest();
  x.open('GET', HOME_URL);
  x.send();
  const a = JSON.parse(x.responseText);
  assert.ok(!ids(a).includes(PROMO));
  assert.equal(x.responseText, x.response);
});

test('XHR responseType="text"', () => {
  const { env } = makeEnv();
  const x = new env.XMLHttpRequest();
  x.open('GET', HOME_URL);
  x.responseType = 'text';
  x.send();
  assert.ok(!ids(JSON.parse(x.response)).includes(PROMO));
});

test('XHR responseType="json" — aynı filtrelenmiş nesne döner', () => {
  const { env } = makeEnv();
  const x = new env.XMLHttpRequest();
  x.open('GET', HOME_URL);
  x.responseType = 'json';
  x.send();
  const r = x.response;
  assert.ok(!ids(r).includes(PROMO));
  assert.equal(x.response, r);
  assert.throws(() => x.responseText, /InvalidStateError/, 'responseText davranışı korunmalı');
});

test('XHR: hedef dışı ve yeniden kullanılan nesne', () => {
  const { env } = makeEnv();
  const x = new env.XMLHttpRequest();
  x.open('GET', HOME_URL);
  x.send();
  assert.ok(x.responseText.length < HOME.length);
  x.open('GET', DETAIL_URL);
  x.send();
  assert.equal(x.responseText, HOME);
});

test('XHR: bozuk JSON orijinal haliyle geçer', () => {
  const { env } = makeEnv();
  const x = new env.XMLHttpRequest();
  x.open('GET', 'https://x.com/i/api/graphql/abc/HomeTimeline/BrokenJson');
  x.send();
  assert.equal(x.responseText, '{bozuk json');
});

// ------------------------------------------------------------ düğme şeridi arayüzü

const buttons = (ph) => ph.querySelectorAll('button').map((b) => b.textContent);
const mode = (art) => placeholder(art) && placeholder(art).getAttribute('data-qt-mode');

test('anasayfa: mavi tikli tweet açık gelir, üstünde düğme şeridi var; reklam gizli', async () => {
  const ctx = makeEnv();
  const blue = tweetCell(ctx.doc, '1002');
  const normal = tweetCell(ctx.doc, '1001');
  const quote = tweetCell(ctx.doc, '1009', { quoteOf: '1002' });
  const ad = tweetCell(ctx.doc, '5555', { ad: true });
  await loadHome(ctx);

  const bar = placeholder(blue.art);
  assert.ok(bar, 'şerit oluşmalı');
  assert.equal(mode(blue.art), 'revealed');
  assert.ok(!hidden(blue.art) && !hidden(blue.cell), 'tweet açık');
  assert.match(bar.textContent, /Takip etmediğin mavi tikli hesap · Yabancı Mavi @yabanci_mavi/);
  assert.deepEqual(buttons(bar), ['Gizle', 'Sessize al', 'Filtrelemeyi bırak']);

  bar.click(); // şeride tıklamak bir şey değiştirmez
  assert.ok(!hidden(blue.art) && placeholder(blue.art) === bar);

  assert.ok(!placeholder(normal.art) && !hidden(normal.art), 'normal tweette şerit yok');
  assert.ok(!placeholder(quote.art) && !hidden(quote.art), 'alıntı kutusu kararı etkilemez');
  assert.ok(!hidden(normal.cell), '"Ad" görünen adı reklam sayılmaz');
  assert.ok(hidden(ad.cell), 'reklam hücresi gizli');
});

test('Gizle kapatır, Göster veya kutuya tıklama tekrar açar', async () => {
  const ctx = makeEnv();
  const a = tweetCell(ctx.doc, '1002');
  await loadHome(ctx);

  placeholder(a.art).querySelector('button.qt-hide').click();
  assert.ok(hidden(a.art), 'tweet kapalı');
  assert.equal(mode(a.art), 'collapse');
  assert.deepEqual(buttons(placeholder(a.art)), ['Göster', 'Sessize al', 'Filtrelemeyi bırak']);

  placeholder(a.art).querySelector('button.qt-show').click();
  assert.ok(!hidden(a.art));
  assert.equal(mode(a.art), 'revealed');

  placeholder(a.art).querySelector('button.qt-hide').click();
  placeholder(a.art).click(); // kapalı kutuya tıklama da açar
  assert.ok(!hidden(a.art));
  assert.equal(mode(a.art), 'revealed');
});

test('Gizle yalnız o tweeti kapatır ve yeni yüklemede kapalı kalır', async () => {
  const ctx = makeEnv();
  const a = tweetCell(ctx.doc, '1002');
  const b = tweetCell(ctx.doc, '1010'); // aynı hesap, başka tweet
  await loadHome(ctx);
  placeholder(a.art).querySelector('button.qt-hide').click();
  assert.equal(mode(a.art), 'collapse');
  assert.equal(mode(b.art), 'revealed');
  await loadHome(ctx);
  assert.equal(mode(a.art), 'collapse');
});

test('İngilizce arayüz', async () => {
  const ctx = makeEnv({ lang: 'en' });
  const blue = tweetCell(ctx.doc, '1002');
  await loadHome(ctx);
  assert.deepEqual(buttons(placeholder(blue.art)), ['Hide', 'Mute', 'Stop filtering']);
  placeholder(blue.art).querySelector('button.qt-hide').click();
  assert.deepEqual(buttons(placeholder(blue.art)), ['Show', 'Mute', 'Stop filtering']);
});

test('Sessize al: X\'e doğru istek gider, hesabın tüm tweetleri kaybolur', async () => {
  const ctx = makeEnv();
  const a = tweetCell(ctx.doc, '1002');
  const b = tweetCell(ctx.doc, '1010'); // aynı hesap (202)
  const other = tweetCell(ctx.doc, '1017'); // başka hesap (204)
  await loadHome(ctx, { headers: { Authorization: 'Bearer SAYFA_TOKENI' } });

  placeholder(b.art).querySelector('button.qt-hide').click(); // biri kapalı olsa da
  placeholder(a.art).querySelector('button.qt-mute').click();
  await wait(20);

  const call = ctx.calls.find((c) => c.url === MUTE_URL);
  assert.ok(call, 'sessize alma isteği gönderilmeli');
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.credentials, 'include');
  assert.equal(call.init.body, 'user_id=202');
  assert.equal(call.init.headers.authorization, 'Bearer SAYFA_TOKENI');
  assert.equal(call.init.headers['x-csrf-token'], 'abc123def');
  assert.equal(call.init.headers['x-twitter-auth-type'], 'OAuth2Session');
  assert.equal(call.init.headers['x-twitter-client-language'], 'tr');

  assert.ok(hidden(a.cell) && hidden(b.cell), 'sessize alınan hesabın hücreleri gizli');
  assert.ok(!placeholder(a.art) && !placeholder(b.art), 'şerit/kutu kalkar');
  assert.equal(mode(other.art), 'revealed', 'başka hesap etkilenmez');

  const json = await loadHome(ctx);
  assert.ok(!ids(json).includes('tweet-1002'), 'sonraki yüklemelerde de gelmez');
  assert.equal(ctx.calls.filter((c) => c.url === MUTE_URL).length, 1, 'yalnız tıklamada istek atılır');
});

test('Sessize al başarısız olursa tweet yerinde kalır ve hata yazılır', async () => {
  const ctx = makeEnv({ muteStatus: 403 });
  const a = tweetCell(ctx.doc, '1002');
  await loadHome(ctx);
  const btn = placeholder(a.art).querySelector('button.qt-mute');
  btn.click();
  assert.equal(btn.textContent, 'Sessize alınıyor…');
  assert.equal(btn.disabled, true);
  await wait(20);
  assert.equal(btn.textContent, 'Sessize alınamadı, tekrar dene');
  assert.equal(btn.disabled, false);
  assert.ok(placeholder(a.art) && !hidden(a.art) && !hidden(a.cell));
});

test('Filtrelemeyi bırak kapalı kutudan da çalışır', async () => {
  const ctx = makeEnv();
  const a = tweetCell(ctx.doc, '1017'); // 204
  await loadHome(ctx);
  placeholder(a.art).querySelector('button.qt-hide').click();
  placeholder(a.art).querySelector('button.qt-allow').click();
  assert.ok(!hidden(a.art) && !placeholder(a.art));
  assert.equal(ctx.storage.getItem('quiet-timeline:allow'), '["204"]');
});

test('Sessize al: ct0 çerezi yoksa istek gönderilmez', async () => {
  const ctx = makeEnv({ cookie: `twid=u%3D${SELF}` });
  const a = tweetCell(ctx.doc, '1002');
  await loadHome(ctx);
  placeholder(a.art).querySelector('button.qt-mute').click();
  await wait(20);
  assert.equal(ctx.calls.filter((c) => c.url === MUTE_URL).length, 0);
  assert.ok(placeholder(a.art));
});

test('Filtrelemeyi bırak: hesap kalıcı olarak açılır', async () => {
  const storage = fakeStorage();
  const ctx = makeEnv({ storage });
  const a = tweetCell(ctx.doc, '1002');
  const b = tweetCell(ctx.doc, '1020'); // aynı hesap
  await loadHome(ctx);

  placeholder(a.art).querySelector('button.qt-allow').click();
  assert.ok(!placeholder(a.art) && !hidden(a.art));
  assert.ok(!placeholder(b.art) && !hidden(b.art));
  assert.equal(storage.getItem('quiet-timeline:allow'), '["202"]');

  // Sayfa yeniden açıldığında da filtrelenmez.
  const again = makeEnv({ storage });
  const c = tweetCell(again.doc, '1002');
  const d = tweetCell(again.doc, '1017');
  await loadHome(again);
  assert.ok(!placeholder(c.art), 'izin verilen hesap açık');
  assert.ok(placeholder(d.art), 'diğer hesaplar hâlâ kapalı');
});

test('bozuk localStorage verisi yok sayılır', async () => {
  const ctx = makeEnv({ storage: fakeStorage({ 'quiet-timeline:allow': '{bozuk' }) });
  const a = tweetCell(ctx.doc, '1002');
  await loadHome(ctx);
  assert.ok(placeholder(a.art));
});

test('sanal liste hücreyi başka tweete verirse yer tutucu kalkar', async () => {
  const ctx = makeEnv();
  const a = tweetCell(ctx.doc, '1002');
  await loadHome(ctx);
  assert.ok(placeholder(a.art));
  a.art.querySelector('a').setAttribute('href', '/someone/status/1001');
  await loadHome(ctx);
  assert.ok(!placeholder(a.art) && !hidden(a.art));
});

test('anasayfa dışında DOM\'a dokunulmaz', async () => {
  const ctx = makeEnv({ pathname: '/someone/status/1' });
  const a = tweetCell(ctx.doc, '1002');
  const ad = tweetCell(ctx.doc, '5555', { ad: true });
  await loadHome(ctx);
  assert.ok(!placeholder(a.art) && !hidden(a.art));
  assert.ok(!hidden(ad.cell));
});

// ------------------------------------------------------------ kimlik

test('kimlik: çerez yoksa __INITIAL_STATE__ kullanılır', async () => {
  const ctx = makeEnv({ cookie: '', initialState: { session: { user_id: SELF } } });
  const a = tweetCell(ctx.doc, '1002');
  const own = tweetCell(ctx.doc, '1012');
  await loadHome(ctx);
  assert.ok(placeholder(a.art));
  assert.ok(!placeholder(own.art), 'kendi tweetim açık');
});

test('kimlik bulunamazsa hiçbir tweet kapatılmaz, reklamlar yine kalkar', async () => {
  const ctx = makeEnv({ cookie: '' });
  const a = tweetCell(ctx.doc, '1002');
  const json = await loadHome(ctx);
  assert.ok(!placeholder(a.art));
  assert.ok(!ids(json).includes(PROMO));
});

test('tırnaklı twid çerezi de okunur', async () => {
  const ctx = makeEnv({ cookie: `twid="u=${SELF}"` });
  const a = tweetCell(ctx.doc, '1002');
  await loadHome(ctx);
  assert.ok(placeholder(a.art));
});

// ------------------------------------------------------------ kalıcı liste (köprü)

test('köprü: Filtrelemeyi bırak eklenti deposuna da yazılır', async () => {
  const chrome = fakeChrome();
  const ctx = makeEnv({ chrome });
  const a = tweetCell(ctx.doc, '1002'); // 202
  await loadHome(ctx);
  placeholder(a.art).querySelector('button.qt-allow').click();
  await wait(20);
  assert.equal(chrome.data['allow:202'], 1);
});

test('köprü: x.com localStorage silinse de hesap filtrelenmez', async () => {
  const chrome = fakeChrome({ 'allow:202': 1 });
  const storage = fakeStorage(); // X ya da tarayıcı temizlemiş
  const ctx = makeEnv({ chrome, storage });
  const a = tweetCell(ctx.doc, '1002');
  const b = tweetCell(ctx.doc, '1017'); // 204
  await wait(20);
  await loadHome(ctx);
  assert.ok(!placeholder(a.art), 'izin verilen hesap açık');
  assert.ok(placeholder(b.art), 'diğer hesaplar işaretli');
  assert.equal(storage.getItem('quiet-timeline:allow'), '["202"]', 'yerel önbellek onarıldı');
});

test('köprü: liste geç gelse de şerit kalkar', async () => {
  const chrome = fakeChrome({ 'allow:202': 1 });
  const ctx = makeEnv({ chrome });
  const a = tweetCell(ctx.doc, '1002');
  await loadHome(ctx); // köprü cevabından önce de olabilir
  await wait(150);
  assert.ok(!placeholder(a.art) && !hidden(a.art));
});

test('köprü: eski sürümün localStorage listesi depoya taşınır', async () => {
  const chrome = fakeChrome();
  makeEnv({ chrome, storage: fakeStorage({ 'quiet-timeline:allow': '["202","204"]' }) });
  await wait(20);
  assert.equal(chrome.data['allow:202'], 1);
  assert.equal(chrome.data['allow:204'], 1);
});

test('köprü: başka sekmede (twitter.com dahil) bırakılan hesap bu sekmede de açılır', async () => {
  const chrome = fakeChrome();
  const tab1 = makeEnv({ chrome });
  const tab2 = makeEnv({ chrome, storage: fakeStorage() });
  const a = tweetCell(tab1.doc, '1002');
  const b = tweetCell(tab2.doc, '1020'); // aynı hesap (202)
  await loadHome(tab1);
  await loadHome(tab2);
  assert.ok(placeholder(b.art));
  placeholder(a.art).querySelector('button.qt-allow').click();
  await wait(150);
  assert.ok(!placeholder(b.art) && !hidden(b.art));
});

test('köprü: sayfadan gelen geçersiz kimlikler depoya yazılmaz', async () => {
  const chrome = fakeChrome();
  const ctx = makeEnv({ chrome });
  ctx.env.postMessage({ source: 'quiet-timeline:page', allowIds: ['12', 'abc', 5, '1'.repeat(40)] });
  await wait(20);
  assert.deepEqual(Object.keys(chrome.data), ['allow:12']);
});
