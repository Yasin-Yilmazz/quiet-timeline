'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { filterTimeline, filterTimelineDetailed, decideDisplay, isTargetUrl, REASON } = require('../src/filter');

const FIX = path.join(__dirname, 'fixtures');
const load = (name) => JSON.parse(fs.readFileSync(path.join(FIX, name), 'utf8'));
const { selfId: SELF } = load('self.json');

function instructions(json) {
  return json.data.home.home_timeline_urt.instructions;
}
function entryIds(json) {
  const add = instructions(json).find((i) => i.type === 'TimelineAddEntries');
  return add.entries.map((e) => e.entryId);
}
function entry(json, id) {
  const add = instructions(json).find((i) => i.type === 'TimelineAddEntries');
  return add.entries.find((e) => e.entryId === id);
}

// ------------------------------------------------------------ Sana özel

const flaggedFirstIds = (flagged) => flagged.map((f) => f.tweetIds[0]);

test('Sana özel: reklamlar kalkar, takip edilmeyen mavi tikliler işaretlenir', async (t) => {
  const input = load('home-timeline.json');
  const { json: out, removed, flagged } = filterTimelineDetailed(input, { selfId: SELF });
  const ids = entryIds(out);
  const flaggedIds = flaggedFirstIds(flagged);

  const kept = (id, why) => t.test(`görünür: ${why}`, () => {
    assert.ok(ids.includes(id), `${id} kalmalıydı`);
    assert.ok(!flaggedIds.includes(id.replace('tweet-', '')), `${id} işaretlenmemeliydi`);
  });
  const collapsed = (id, userId, why) =>
    t.test(`kapalı gösterilir: ${why}`, () => {
      const tid = id.replace(/^.*tweet-/, '');
      const f = flagged.find((x) => x.tweetIds[0] === tid);
      assert.ok(f, `${id} işaretlenmeliydi`);
      assert.equal(f.userId, userId);
    });
  const gone = (id, why) =>
    t.test(`kaldırıldı: ${why}`, () => {
      assert.ok(!ids.includes(id), `${id} kaldırılmalıydı`);
      assert.equal(removed.find((r) => r.entryId === id).reason, REASON.PROMOTED);
    });

  await kept('tweet-1001', 'takip ettiğim mavi tikli');
  await collapsed('tweet-1002', '202', 'takip etmediğim mavi tikli');
  await kept('tweet-1003', 'altın tik (Business)');
  await kept('tweet-1004', 'gri tik (Government)');
  await kept('tweet-1005', 'tiksiz hesap');
  await gone('promoted-tweet-1006-a1b2c3', 'reklam (entryId promoted-)');
  await gone('tweet-1007', 'reklam (promotedMetadata, yazar takip edilen mavi olsa bile)');
  await kept('tweet-1008', 'takip ettiğimin mavi tikliyi RT etmesi');
  await kept('tweet-1009', 'takip ettiğimin mavi tikliyi alıntılaması');
  await collapsed('tweet-1010', '202', 'TweetWithVisibilityResults içindeki yabancı mavi');
  await kept('tweet-1011', 'TweetWithVisibilityResults içindeki takip ettiğim mavi');
  await kept('tweet-1012', 'kendi tweetim');
  await kept('tweet-1013', 'alanları eksik kullanıcı (fail-open)');
  await kept('tweet-1014', 'mavi ama takip alanı yok (fail-open)');
  await kept('tweet-1015', 'core alanı yok (fail-open)');
  await kept('tweet-1016', 'tombstone');
  await collapsed('tweet-1017', '204', 'eski şema: legacy.following=false + legacy.id_str');
  await collapsed('tweet-1018', '203', 'yalnız relationship_perspectives.following=false');
  await kept('tweet-1019', 'kaynaklardan biri following=true');
  await collapsed('tweet-1020', '202', 'alternatif yerleşim core.user_result');
  await kept('tweet-1021', 'UserUnavailable yazar');
  await kept('who-to-follow-3001', 'tweet olmayan modüller');
  await t.test('imleçler korunur', () => {
    assert.equal(ids.filter((id) => id.startsWith('cursor-')).length, 2);
  });

  await t.test('konuşma modülleri olduğu gibi kalır, mavi tikli öğeler işaretlenir', () => {
    assert.deepEqual(
      entry(out, 'home-conversation-2001').content.items.map((i) => i.entryId),
      ['home-conversation-2001-tweet-2001', 'home-conversation-2001-tweet-2002', 'home-conversation-2001-tweet-2003']
    );
    assert.ok(entry(out, 'home-conversation-2101'));
    assert.ok(flaggedIds.includes('2002'));
    assert.ok(flaggedIds.includes('2101'));
  });

  await t.test('işaret kaydı: kullanıcı adı ve görünen ad', () => {
    const f = flagged.find((x) => x.tweetIds[0] === '1002');
    assert.equal(f.screenName, 'yabanci_mavi');
    assert.equal(f.name, 'Yabancı Mavi');
    const legacy = flagged.find((x) => x.tweetIds[0] === '1017');
    assert.equal(legacy.screenName, 'yabanci_mavi_eski');
  });

  await t.test('toplamlar: 2 reklam kaldırıldı, 7 tweet işaretlendi', () => {
    assert.equal(removed.length, 2);
    assert.deepEqual(flaggedIds, ['1002', '1010', '2002', '2101', '1017', '1018', '1020']);
  });
});

test('mavi tiklinin RT ettiği tweetin kimliği de işaretlenir (sayfa bağlantısı orijinali gösterir)', () => {
  const input = load('home-timeline.json');
  const e = entry(input, 'tweet-1002');
  e.content.itemContent.tweet_results.result.legacy.retweeted_status_result = {
    result: { __typename: 'TweetWithVisibilityResults', tweet: { __typename: 'Tweet', rest_id: '9999' } },
  };
  const { flagged } = filterTimelineDetailed(input, { selfId: SELF });
  assert.deepEqual(flagged.find((f) => f.tweetIds[0] === '1002').tweetIds, ['1002', '9999']);
});

test('filtresi bırakılan hesap (allowIds) işaretlenmez', () => {
  const { flagged, removed } = filterTimelineDetailed(load('home-timeline.json'), { selfId: SELF, allowIds: ['202'] });
  assert.deepEqual(flaggedFirstIds(flagged), ['1017', '1018']);
  assert.equal(removed.length, 2);
});

test('bu oturumda sessize alınan hesap (mutedIds) tamamen kaldırılır, modül kuralları geçerli', () => {
  const { json: out, removed, flagged } = filterTimelineDetailed(load('home-timeline.json'), {
    selfId: SELF,
    mutedIds: new Set(['202']),
  });
  const ids = entryIds(out);
  for (const id of ['tweet-1002', 'tweet-1010', 'tweet-1020', 'home-conversation-2101']) assert.ok(!ids.includes(id), id);
  assert.deepEqual(
    entry(out, 'home-conversation-2001').content.items.map((i) => i.entryId),
    ['home-conversation-2001-tweet-2001', 'home-conversation-2001-tweet-2003']
  );
  assert.equal(removed.find((r) => r.entryId === 'home-conversation-2101').reason, REASON.MODULE_ROOT);
  assert.equal(removed.find((r) => r.entryId === 'tweet-1002').reason, REASON.MUTED);
  assert.deepEqual(flaggedFirstIds(flagged), ['1017', '1018']);
});

// ------------------------------------------------------------ Takip edilenler

test('Takip edilenler: reklam kalkar, diğer talimatlar korunur ve işaretlenir', () => {
  const input = load('home-latest-timeline.json');
  const { json: out, flagged } = filterTimelineDetailed(input, { selfId: SELF });
  assert.deepEqual(
    instructions(out).map((i) => i.type),
    ['TimelineClearCache', 'TimelinePinEntry', 'TimelineAddEntries', 'TimelineAddToModule', 'TimelineAddToModule', 'TimelineAddToModule']
  );
  assert.ok(!entryIds(out).includes('promoted-tweet-4103-ff00'));
  assert.deepEqual(flaggedFirstIds(flagged), ['4001', '4202', '4301', '4203', '4205']);
});

test('Takip edilenler + sessize alınan: PinEntry, AddToModule ve silinen modül', () => {
  const input = load('home-latest-timeline.json');
  const out = filterTimeline(input, { selfId: SELF, mutedIds: ['202'] });
  const ins = instructions(out);

  assert.deepEqual(ins.map((i) => i.type), ['TimelineClearCache', 'TimelineAddEntries', 'TimelineAddToModule']);
  assert.deepEqual(entryIds(out), [
    'tweet-4101',
    'tweet-4102',
    'home-conversation-4201',
    entryIds(out).find((id) => id.startsWith('cursor-bottom-')),
  ]);
  assert.deepEqual(
    entry(out, 'home-conversation-4201').content.items.map((i) => i.entryId),
    ['home-conversation-4201-tweet-4201']
  );
  const atm = ins.find((i) => i.type === 'TimelineAddToModule');
  assert.equal(atm.moduleEntryId, 'home-conversation-4201');
  assert.deepEqual(atm.moduleItems.map((i) => i.entryId), ['home-conversation-4201-tweet-4204']);
});

// ------------------------------------------------------------ gösterim kararı

test('decideDisplay: sessize alınan > filtresi bırakılan > açılan > kapalı', () => {
  const st = (o = {}) => ({ mutedIds: new Set(o.muted || []), allowIds: new Set(o.allow || []), revealed: new Set(o.revealed || []) });
  const info = { userId: '202' };
  assert.equal(decideDisplay(undefined, '1', st()), 'show');
  assert.equal(decideDisplay(info, '1', st()), 'collapse');
  assert.equal(decideDisplay(info, '1', st({ revealed: ['1'] })), 'show');
  assert.equal(decideDisplay(info, '1', st({ allow: ['202'] })), 'show');
  assert.equal(decideDisplay(info, '1', st({ muted: ['202'], allow: ['202'], revealed: ['1'] })), 'hide');
});

// ------------------------------------------------------------ güvenlik / dayanıklılık

test('kendi kimliğim bilinmiyorsa hiçbir mavi tikli işaretlenmez, reklamlar yine gider', () => {
  const { removed, flagged } = filterTimelineDetailed(load('home-timeline.json'), { selfId: null, mutedIds: ['202'] });
  assert.equal(flagged.length, 0);
  assert.ok(removed.length > 0);
  assert.ok(removed.every((r) => r.reason === REASON.PROMOTED), JSON.stringify(removed));
});

test('girdi nesnesi değiştirilmez (saf fonksiyon)', () => {
  const input = load('home-timeline.json');
  const before = JSON.stringify(input);
  const out = filterTimeline(input, { selfId: SELF });
  assert.notEqual(out, input);
  assert.equal(JSON.stringify(input), before);
});

test('değişiklik yoksa aynı nesne döner', () => {
  const input = {
    data: { home: { home_timeline_urt: { instructions: [{ type: 'TimelineAddEntries', entries: [] }] } } },
  };
  const res = filterTimelineDetailed(input, { selfId: SELF });
  assert.equal(res.json, input);
  assert.equal(res.changed, false);
});

test('beklenmedik girdilerde hata fırlatmaz ve dokunmaz', () => {
  const weird = [
    null,
    undefined,
    42,
    'metin',
    [],
    {},
    { errors: [{ message: 'Rate limit' }] },
    { data: null },
    { data: { home: null } },
    { data: { home: { home_timeline_urt: { instructions: 'bozuk' } } } },
    { data: { home: { home_timeline_urt: { instructions: [null, 1, { type: 'TimelineAddEntries', entries: [null, { entryId: 5 }, { content: null }] }] } } } },
    { data: { home: { home_timeline_urt: { instructions: [{ type: 'TimelineAddToModule' }, { type: 'TimelinePinEntry' }] } } } },
  ];
  for (const w of weird) {
    assert.doesNotThrow(() => filterTimeline(w, { selfId: SELF }));
    assert.equal(filterTimeline(w, { selfId: SELF }), w);
  }
});

test('instructions bilinen yol dışında olsa da bulunur', () => {
  const src = load('home-timeline.json');
  const moved = { data: { home: { some_new_name_urt: src.data.home.home_timeline_urt } } };
  const out = filterTimeline(moved, { selfId: SELF });
  const ids = out.data.home.some_new_name_urt.instructions[0].entries.map((e) => e.entryId);
  assert.ok(!ids.includes('promoted-tweet-1006-a1b2c3'));
  assert.ok(ids.includes('tweet-1001'));
  assert.equal(filterTimelineDetailed(moved, { selfId: SELF }).flagged.length, 7);
});

test('geçersiz selfId ve kimlik listeleri yok sayılır', () => {
  const a = filterTimelineDetailed(load('home-timeline.json'), { selfId: 'abc' });
  assert.equal(a.flagged.length, 0);
  const b = filterTimelineDetailed(load('home-timeline.json'), { selfId: SELF, allowIds: 'bozuk', mutedIds: [null, 'x', 202] });
  assert.deepEqual(b.flagged.map((f) => f.tweetIds[0]), ['1017', '1018'], 'sayı olarak verilen 202 sessize alınmış sayılmalı');
  assert.equal(b.removed.find((r) => r.entryId === 'tweet-1002').reason, REASON.MUTED);
});

// ------------------------------------------------------------ kapsam

test('yalnız HomeTimeline ve HomeLatestTimeline hedeflenir', () => {
  const yes = [
    'https://x.com/i/api/graphql/abc123/HomeTimeline?variables=%7B%7D',
    'https://x.com/i/api/graphql/Xy-Z_9/HomeLatestTimeline',
    '/i/api/graphql/abc/HomeTimeline?features=1',
    'https://twitter.com/i/api/graphql/abc/HomeLatestTimeline#x',
  ];
  const no = [
    'https://x.com/i/api/graphql/abc/TweetDetail?variables=1',
    'https://x.com/i/api/graphql/abc/UserTweets',
    'https://x.com/i/api/graphql/abc/SearchTimeline',
    'https://x.com/i/api/graphql/abc/HomeTimelineFoo',
    'https://x.com/i/api/2/notifications/all.json',
    'https://x.com/home',
    '',
    null,
  ];
  for (const u of yes) assert.ok(isTargetUrl(u), u);
  for (const u of no) assert.ok(!isTargetUrl(u), String(u));
});
