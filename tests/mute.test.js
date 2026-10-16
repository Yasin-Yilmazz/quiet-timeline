'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMuteRequest, readCookie, FALLBACK_BEARER } = require('../src/mute');

const base = { userId: '202', origin: 'https://x.com', csrfToken: 'abc123', bearer: 'Bearer TOKEN', lang: 'tr' };

test('sessize alma isteği X\'in kendi uç noktasına gider', () => {
  const r = buildMuteRequest(base);
  assert.equal(r.url, 'https://x.com/i/api/1.1/mutes/users/create.json');
  assert.equal(r.init.method, 'POST');
  assert.equal(r.init.credentials, 'include');
  assert.equal(r.init.body, 'user_id=202');
  assert.deepEqual(r.init.headers, {
    authorization: 'Bearer TOKEN',
    'content-type': 'application/x-www-form-urlencoded',
    'x-csrf-token': 'abc123',
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-client-language': 'tr',
  });
});

test('twitter.com kökeni de desteklenir', () => {
  assert.equal(buildMuteRequest({ ...base, origin: 'https://twitter.com' }).url, 'https://twitter.com/i/api/1.1/mutes/users/create.json');
});

test('yakalanmış token yoksa yedek bearer kullanılır', () => {
  for (const bearer of [null, undefined, '', 'Basic x', 'Bearer ']) {
    assert.equal(buildMuteRequest({ ...base, bearer }).init.headers.authorization, FALLBACK_BEARER);
  }
});

test('geçersiz girdide istek oluşturulmaz', () => {
  assert.equal(buildMuteRequest(null), null);
  assert.equal(buildMuteRequest({ ...base, userId: '20a' }), null);
  assert.equal(buildMuteRequest({ ...base, userId: 202 }), null);
  assert.equal(buildMuteRequest({ ...base, origin: 'https://evil.example' }), null);
  assert.equal(buildMuteRequest({ ...base, origin: 'http://x.com' }), null);
  assert.equal(buildMuteRequest({ ...base, csrfToken: null }), null);
  assert.equal(buildMuteRequest({ ...base, csrfToken: 'a b' }), null);
});

test('dil başlığı yalnız geçerliyse eklenir', () => {
  assert.equal(buildMuteRequest({ ...base, lang: '' }).init.headers['x-twitter-client-language'], undefined);
  assert.equal(buildMuteRequest({ ...base, lang: 'tr\r\nx: y' }).init.headers['x-twitter-client-language'], undefined);
});

test('readCookie', () => {
  const c = 'guest_id=v1%3A1; ct0=abc123; twid=u%3D42';
  assert.equal(readCookie(c, 'ct0'), 'abc123');
  assert.equal(readCookie(c, 'twid'), 'u=42');
  assert.equal(readCookie(c, 'yok'), null);
  assert.equal(readCookie('xct0=1', 'ct0'), null);
  assert.equal(readCookie(undefined, 'ct0'), null);
  assert.equal(readCookie('a=%E0%A4%A', 'a'), '%E0%A4%A');
});
