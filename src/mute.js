'use strict';

/*
 * Quiet Timeline — sessize alma isteği.
 *
 * Yalnızca kullanıcı "Sessize al" düğmesine bastığında, X'in kendi web
 * istemcisinin kullandığı uç noktaya, kullanıcının mevcut oturumuyla
 * (aynı köken, çerezler) tek bir istek gönderilir. Başka hiçbir yere istek yok.
 */

// X web istemcisinin herkese açık bearer token'ı. Sayfanın kendi isteklerinden
// yakalanan değer varsa o kullanılır; bu yalnızca yedektir.
const FALLBACK_BEARER =
  'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

const ALLOWED_ORIGINS = ['https://x.com', 'https://twitter.com'];

function readCookie(cookieString, name) {
  if (typeof cookieString !== 'string') return null;
  const m = new RegExp('(?:^|;\\s*)' + name + '=([^;]*)').exec(cookieString);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch (_) {
    return m[1];
  }
}

/**
 * @param {{userId: string, origin: string, csrfToken: string|null, bearer?: string|null, lang?: string}} p
 * @returns {{url: string, init: RequestInit}|null}  geçersiz girdide null
 */
function buildMuteRequest(p) {
  if (!p || typeof p.userId !== 'string' || !/^\d+$/.test(p.userId)) return null;
  if (!ALLOWED_ORIGINS.includes(p.origin)) return null;
  if (typeof p.csrfToken !== 'string' || !/^[0-9a-zA-Z]+$/.test(p.csrfToken)) return null;
  const bearer = typeof p.bearer === 'string' && /^Bearer \S+$/.test(p.bearer) ? p.bearer : FALLBACK_BEARER;
  const headers = {
    authorization: bearer,
    'content-type': 'application/x-www-form-urlencoded',
    'x-csrf-token': p.csrfToken,
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
  };
  if (typeof p.lang === 'string' && /^[a-zA-Z-]{2,10}$/.test(p.lang)) headers['x-twitter-client-language'] = p.lang;
  return {
    url: p.origin + '/i/api/1.1/mutes/users/create.json',
    init: {
      method: 'POST',
      credentials: 'include',
      headers,
      body: 'user_id=' + encodeURIComponent(p.userId),
    },
  };
}

module.exports = { buildMuteRequest, readCookie, FALLBACK_BEARER };
