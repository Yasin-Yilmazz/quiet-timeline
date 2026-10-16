'use strict';

// Derlenmiş content.js'i sahte bir tarayıcı ortamında (vm) çalıştırıp
// fetch / XHR yamalarını uçtan uca doğrular.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { bundleContentScript } = require('../scripts/build');

const FIX = path.join(__dirname, 'fixtures');
const HOME = fs.readFileSync(path.join(FIX, 'home-timeline.json'), 'utf8');
const { selfId: SELF } = JSON.parse(fs.readFileSync(path.join(FIX, 'self.json'), 'utf8'));

const HOME_URL = 'https://x.com/i/api/graphql/abc/HomeTimeline?variables=%7B%7D';
const DETAIL_URL = 'https://x.com/i/api/graphql/abc/TweetDetail?variables=%7B%7D';

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

function makeEnv({ cookie = `twid=u%3D${SELF}; lang=tr`, initialState } = {}) {
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
    location: { pathname: '/home' },
    document: { cookie, documentElement: null, addEventListener() {} },
    fetch: async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      return new Response(server(url), { status: 200, headers: { 'content-type': 'application/json', 'content-length': '999' } });
    },
  };
  if (initialState) sandbox.__INITIAL_STATE__ = initialState;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(bundleContentScript(), sandbox, { filename: 'content.js' });
  return sandbox;
}

const ids = (json) => json.data.home.home_timeline_urt.instructions[0].entries.map((e) => e.entryId);

test('sayfaya global sızdırmaz', () => {
  const env = makeEnv();
  assert.equal(env.QuietTimelineFilter, undefined);
  assert.equal(env.module, undefined);
});

test('fetch: HomeTimeline filtrelenir, Response özellikleri korunur', async () => {
  const env = makeEnv();
  const res = await env.fetch(HOME_URL);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/json');
  assert.equal(res.headers.get('content-length'), null);
  const json = await res.json();
  assert.ok(!ids(json).includes('tweet-1002'));
  assert.ok(!ids(json).includes('promoted-tweet-1006-a1b2c3'));
  assert.ok(ids(json).includes('tweet-1001'));
  assert.ok(ids(json).includes('tweet-1012'), 'kendi tweetim kalmalı');
});

test('fetch: Request nesnesi ve URL nesnesi ile çağrı', async () => {
  const env = makeEnv();
  const a = await (await env.fetch(new Request(HOME_URL))).json();
  const b = await (await env.fetch(new URL(HOME_URL))).json();
  assert.ok(!ids(a).includes('tweet-1002'));
  assert.ok(!ids(b).includes('tweet-1002'));
});

test('fetch: hedef dışı uç noktalara dokunulmaz', async () => {
  const env = makeEnv();
  const text = await (await env.fetch(DETAIL_URL)).text();
  assert.equal(text, HOME);
});

test('fetch: bozuk JSON orijinal haliyle geçer', async () => {
  const env = makeEnv();
  const text = await (await env.fetch('https://x.com/i/api/graphql/abc/HomeTimeline/BrokenJson')).text();
  assert.equal(text, '{bozuk json');
});

test('XHR responseType="" — responseText ve response', () => {
  const env = makeEnv();
  const x = new env.XMLHttpRequest();
  x.open('GET', HOME_URL);
  x.send();
  const a = JSON.parse(x.responseText);
  const b = JSON.parse(x.response);
  assert.ok(!ids(a).includes('tweet-1002'));
  assert.equal(x.responseText, x.response);
  assert.deepEqual(ids(a), ids(b));
});

test('XHR responseType="text"', () => {
  const env = makeEnv();
  const x = new env.XMLHttpRequest();
  x.open('GET', HOME_URL);
  x.responseType = 'text';
  x.send();
  assert.ok(!ids(JSON.parse(x.response)).includes('tweet-1002'));
});

test('XHR responseType="json" — aynı filtrelenmiş nesne döner', () => {
  const env = makeEnv();
  const x = new env.XMLHttpRequest();
  x.open('GET', HOME_URL);
  x.responseType = 'json';
  x.send();
  const r = x.response;
  assert.ok(!ids(r).includes('tweet-1002'));
  assert.equal(x.response, r);
  assert.throws(() => x.responseText, /InvalidStateError/, 'responseText davranışı korunmalı');
});

test('XHR: hedef dışı ve yeniden kullanılan nesne', () => {
  const env = makeEnv();
  const x = new env.XMLHttpRequest();
  x.open('GET', HOME_URL);
  x.send();
  assert.ok(x.responseText.length < HOME.length);
  x.open('GET', DETAIL_URL); // aynı nesneyle hedef dışı istek
  x.send();
  assert.equal(x.responseText, HOME);
});

test('XHR: bozuk JSON orijinal haliyle geçer', () => {
  const env = makeEnv();
  const x = new env.XMLHttpRequest();
  x.open('GET', 'https://x.com/i/api/graphql/abc/HomeTimeline/BrokenJson');
  x.send();
  assert.equal(x.responseText, '{bozuk json');
});

test('kimlik: çerez yoksa __INITIAL_STATE__ kullanılır', async () => {
  const env = makeEnv({ cookie: '', initialState: { session: { user_id: SELF } } });
  const json = await (await env.fetch(HOME_URL)).json();
  assert.ok(!ids(json).includes('tweet-1002'));
  assert.ok(ids(json).includes('tweet-1012'));
});

test('kimlik bulunamazsa yalnız reklamlar kaldırılır', async () => {
  const env = makeEnv({ cookie: '' });
  const json = await (await env.fetch(HOME_URL)).json();
  assert.ok(ids(json).includes('tweet-1002'));
  assert.ok(!ids(json).includes('promoted-tweet-1006-a1b2c3'));
});

test('tırnaklı twid çerezi de okunur', async () => {
  const env = makeEnv({ cookie: `twid="u=${SELF}"` });
  const json = await (await env.fetch(HOME_URL)).json();
  assert.ok(!ids(json).includes('tweet-1002'));
});
