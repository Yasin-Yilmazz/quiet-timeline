'use strict';

/*
 * Quiet Timeline — saf filtre modülü.
 *
 * Girdi: HomeTimeline / HomeLatestTimeline GraphQL cevabı (parse edilmiş JSON).
 * Çıktı: reklamları ve takip edilmeyen ücretli mavi tikli hesapların
 * tweetlerini çıkarılmış JSON. Girdi nesnesi asla değiştirilmez.
 *
 * İlke: emin olmadığımız her durumda tweeti GÖSTER (fail-open).
 */

const TARGET_URL_RE = /\/graphql\/[^/?#]+\/(HomeTimeline|HomeLatestTimeline)(?:[?#]|$)/;

const REASON = {
  PROMOTED: 'promoted',
  BLUE: 'blue-unfollowed',
  QUOTE: 'quote-of-blue',
  MODULE_ROOT: 'module-root-removed',
  MODULE_EMPTY: 'module-empty',
};

function isObj(v) {
  return v !== null && typeof v === 'object';
}

function isTargetUrl(url) {
  return typeof url === 'string' && TARGET_URL_RE.test(url);
}

function operationName(url) {
  const m = typeof url === 'string' ? TARGET_URL_RE.exec(url) : null;
  return m ? m[1] : null;
}

function isPromotedEntryId(entryId) {
  return typeof entryId === 'string' && entryId.startsWith('promoted-');
}

function isCursorItem(itemContent, entryId) {
  if (isObj(itemContent)) {
    const t = itemContent.itemType || itemContent.__typename;
    if (t === 'TimelineTimelineCursor') return true;
  }
  return typeof entryId === 'string' && /(^|-)cursor-/.test(entryId);
}

// TweetWithVisibilityResults sarmalayıcısını açar.
function unwrapTweet(result) {
  let r = result;
  for (let i = 0; i < 3 && isObj(r); i++) {
    if (r.__typename === 'TweetWithVisibilityResults' && isObj(r.tweet)) {
      r = r.tweet;
    } else if (!r.__typename && !r.core && !r.legacy && isObj(r.tweet)) {
      r = r.tweet;
    } else {
      break;
    }
  }
  return isObj(r) ? r : null;
}

function getTweet(itemContent) {
  if (!isObj(itemContent)) return null;
  const tr = itemContent.tweet_results || itemContent.tweetResult;
  return isObj(tr) ? unwrapTweet(tr.result) : null;
}

// Tweetin DIŞ yazarı. retweeted_status_result / quoted_status_result'a bakılmaz.
function getAuthor(tweet) {
  if (!isObj(tweet)) return null;
  const core = isObj(tweet.core) ? tweet.core : null;
  const legacy = isObj(tweet.legacy) ? tweet.legacy : null;
  const candidates = [
    core && core.user_results,
    core && core.user_result,
    legacy && legacy.user_results,
    legacy && legacy.user_result,
  ];
  for (const c of candidates) {
    if (!isObj(c) || !isObj(c.result)) continue;
    const u = c.result;
    if (u.__typename && u.__typename !== 'User') return null; // UserUnavailable vb.
    return u;
  }
  return null;
}

function getUserId(user) {
  if (typeof user.rest_id === 'string' && user.rest_id) return user.rest_id;
  if (isObj(user.legacy) && typeof user.legacy.id_str === 'string' && user.legacy.id_str) {
    return user.legacy.id_str;
  }
  return null;
}

function hasVerifiedType(user) {
  const values = [
    isObj(user.legacy) ? user.legacy.verified_type : undefined,
    isObj(user.verification) ? user.verification.verified_type : undefined,
    user.verified_type,
  ];
  return values.some((v) => typeof v === 'string' && v.length > 0);
}

// 'yes' | 'no' | 'unknown'. Kaynaklardan biri true derse takip ediliyor say.
function followState(user) {
  const values = [
    isObj(user.legacy) ? user.legacy.following : undefined,
    isObj(user.relationship_perspectives) ? user.relationship_perspectives.following : undefined,
  ];
  if (values.includes(true)) return 'yes';
  if (values.includes(false)) return 'no';
  return 'unknown';
}

// Alıntılanan tweet (sarmalayıcı açılmış halde).
function getQuoted(tweet) {
  const q = tweet.quoted_status_result || (isObj(tweet.legacy) ? tweet.legacy.quoted_status_result : undefined);
  return isObj(q) ? unwrapTweet(q.result) : null;
}

// Ben değilim, ücretli mavi tik (altın/gri değil) ve açıkça takip etmiyorum.
function isUnfollowedBlue(user, ctx) {
  const id = getUserId(user);
  if (!id || id === ctx.selfId) return false;
  return user.is_blue_verified === true && !hasVerifiedType(user) && followState(user) === 'no';
}

// Tek bir tweet içeriğini değerlendirir. Kaldırılacaksa neden, değilse null döner.
function evaluateItem(itemContent, entryId, ctx) {
  if (isPromotedEntryId(entryId)) return REASON.PROMOTED;
  if (!isObj(itemContent)) return null;
  if (itemContent.promotedMetadata) return REASON.PROMOTED;

  const type = itemContent.itemType || itemContent.__typename;
  if (type && type !== 'TimelineTweet') return null;

  const tweet = getTweet(itemContent);
  if (!tweet) return null;
  if (tweet.promotedMetadata) return REASON.PROMOTED;

  const user = getAuthor(tweet);
  if (!user) return null;

  // Kendimi tanıyamıyorsam kimseyi gizleme: kendi tweetim asla gizlenmemeli.
  const id = getUserId(user);
  if (!ctx.selfId || !id || id === ctx.selfId) return null;

  if (isUnfollowedBlue(user, ctx)) return REASON.BLUE;

  // Takip etmediğim biri, takip etmediğim mavi tikliyi alıntılıyorsa.
  // Alıntılayanı takip ediyorsam (veya takip bilgisi yoksa) tweet kalır.
  if (followState(user) === 'no') {
    const quoted = getQuoted(tweet);
    const qUser = quoted && getAuthor(quoted);
    if (qUser && isUnfollowedBlue(qUser, ctx)) return REASON.QUOTE;
  }
  return null;
}

// Bir timeline girdisini değerlendirir.
// { remove: true } | { remove: false, entry } (entry değişmiş olabilir)
function evaluateEntry(entry, ctx) {
  if (!isObj(entry)) return { remove: false, entry };
  const entryId = entry.entryId;
  if (isPromotedEntryId(entryId)) {
    ctx.record(entryId, REASON.PROMOTED);
    return { remove: true };
  }

  const content = entry.content;
  if (!isObj(content)) return { remove: false, entry };
  const type = content.entryType || content.__typename;

  if (type === 'TimelineTimelineModule' || (!type && Array.isArray(content.items))) {
    return evaluateModule(entry, content, ctx);
  }

  if (type === 'TimelineTimelineItem' || isObj(content.itemContent)) {
    const reason = evaluateItem(content.itemContent, entryId, ctx);
    if (reason) {
      ctx.record(entryId, reason);
      return { remove: true };
    }
  }
  return { remove: false, entry };
}

function evaluateModule(entry, content, ctx) {
  const items = content.items;
  if (!Array.isArray(items) || items.length === 0) return { remove: false, entry };

  const kept = [];
  const removedHere = [];
  let firstRemoved = false;
  items.forEach((it, i) => {
    const itemContent = isObj(it) && isObj(it.item) ? it.item.itemContent : undefined;
    const itemId = isObj(it) ? it.entryId : undefined;
    const reason = evaluateItem(itemContent, itemId, ctx);
    if (reason) {
      removedHere.push([itemId, reason]);
      if (i === 0) firstRemoved = true;
    } else {
      kept.push(it);
    }
  });

  if (removedHere.length === 0) return { remove: false, entry };

  const hasContent = kept.some((it) => {
    const ic = isObj(it) && isObj(it.item) ? it.item.itemContent : undefined;
    return !isCursorItem(ic, isObj(it) ? it.entryId : undefined);
  });

  if (firstRemoved || !hasContent) {
    ctx.record(entry.entryId, firstRemoved ? REASON.MODULE_ROOT : REASON.MODULE_EMPTY, removedHere);
    ctx.removedModules.add(entry.entryId);
    return { remove: true };
  }

  for (const [itemId, reason] of removedHere) ctx.record(itemId, reason, null, entry.entryId);
  return {
    remove: false,
    entry: Object.assign({}, entry, { content: Object.assign({}, content, { items: kept }) }),
  };
}

function filterInstructions(instructions, ctx) {
  const out = [];
  for (const ins of instructions) {
    if (!isObj(ins)) {
      out.push(ins);
      continue;
    }
    switch (ins.type) {
      case 'TimelineAddEntries': {
        if (!Array.isArray(ins.entries)) {
          out.push(ins);
          break;
        }
        const entries = [];
        for (const e of ins.entries) {
          const r = evaluateEntry(e, ctx);
          if (!r.remove) entries.push(r.entry);
        }
        out.push(Object.assign({}, ins, { entries }));
        break;
      }
      case 'TimelinePinEntry': {
        const r = evaluateEntry(ins.entry, ctx);
        if (!r.remove) out.push(r.entry === ins.entry ? ins : Object.assign({}, ins, { entry: r.entry }));
        break;
      }
      case 'TimelineAddToModule': {
        if (ctx.removedModules.has(ins.moduleEntryId)) {
          ctx.record(ins.moduleEntryId, REASON.MODULE_ROOT);
          break;
        }
        if (!Array.isArray(ins.moduleItems)) {
          out.push(ins);
          break;
        }
        const kept = [];
        let removedAny = false;
        for (const it of ins.moduleItems) {
          const itemContent = isObj(it) && isObj(it.item) ? it.item.itemContent : undefined;
          const itemId = isObj(it) ? it.entryId : undefined;
          const reason = evaluateItem(itemContent, itemId, ctx);
          if (reason) {
            removedAny = true;
            ctx.record(itemId, reason, null, ins.moduleEntryId);
          } else {
            kept.push(it);
          }
        }
        const hasContent = kept.some((it) => {
          const ic = isObj(it) && isObj(it.item) ? it.item.itemContent : undefined;
          return !isCursorItem(ic, isObj(it) ? it.entryId : undefined);
        });
        if (!removedAny) out.push(ins);
        else if (hasContent) out.push(Object.assign({}, ins, { moduleItems: kept }));
        break;
      }
      default:
        out.push(ins);
    }
  }
  return out;
}

// JSON içinde `instructions` dizisi taşıyan nesneleri bulur (bilinen yol + sınırlı arama).
function findInstructionHolders(root) {
  const found = [];
  const known =
    isObj(root.data) && isObj(root.data.home) && isObj(root.data.home.home_timeline_urt)
      ? root.data.home.home_timeline_urt
      : null;
  if (known && Array.isArray(known.instructions)) {
    found.push(known);
    return found;
  }
  const walk = (node, depth) => {
    if (!isObj(node) || depth > 6) return;
    if (Array.isArray(node.instructions) && node.instructions.some((i) => isObj(i) && typeof i.type === 'string')) {
      found.push(node);
      return;
    }
    for (const k of Object.keys(node)) {
      if (k === 'instructions') continue;
      const v = node[k];
      if (isObj(v) && !Array.isArray(v)) walk(v, depth + 1);
    }
  };
  walk(root.data, 0);
  return found;
}

function clone(json) {
  if (typeof structuredClone === 'function') return structuredClone(json);
  return JSON.parse(JSON.stringify(json));
}

function normalizeSelfId(id) {
  if (typeof id === 'number' && Number.isSafeInteger(id)) id = String(id);
  return typeof id === 'string' && /^\d+$/.test(id) ? id : null;
}

/**
 * @param {object} json      timeline cevabı
 * @param {{selfId?: string|null}} [options]
 * @returns {{json: object, removed: Array<{entryId: string, reason: string, module?: string, items?: Array}>, changed: boolean}}
 */
function filterTimelineDetailed(json, options) {
  const removed = [];
  if (!isObj(json) || !isObj(json.data)) return { json, removed, changed: false };
  try {
    const holders = findInstructionHolders(json);
    if (holders.length === 0) return { json, removed, changed: false };

    const ctx = {
      selfId: normalizeSelfId(options && options.selfId),
      removedModules: new Set(),
      record(entryId, reason, items, module) {
        const r = { entryId: entryId == null ? null : String(entryId), reason };
        if (module) r.module = module;
        if (items) r.items = items.map(([id, why]) => ({ entryId: id, reason: why }));
        removed.push(r);
      },
    };

    // Önce kuru çalışma: değişiklik yoksa kopyalama maliyetine girme.
    const results = holders.map((h) => filterInstructions(h.instructions, ctx));
    if (removed.length === 0) return { json, removed, changed: false };

    const out = clone(json);
    const outHolders = findInstructionHolders(out);
    if (outHolders.length !== results.length) return { json, removed: [], changed: false };
    outHolders.forEach((h, i) => {
      h.instructions = clone(results[i]);
    });
    return { json: out, removed, changed: true };
  } catch (e) {
    return { json, removed: [], changed: false, error: e };
  }
}

function filterTimeline(json, options) {
  return filterTimelineDetailed(json, options).json;
}

module.exports = {
  REASON,
  isTargetUrl,
  operationName,
  filterTimeline,
  filterTimelineDetailed,
  // testler için
  _internal: { evaluateItem, unwrapTweet, getAuthor, followState, hasVerifiedType },
};
