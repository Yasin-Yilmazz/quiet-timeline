'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { filterTimeline, filterTimelineDetailed, isTargetUrl, REASON } = require('../src/filter');

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

test('Sana özel: her kural için beklenen sonuç', async (t) => {
  const input = load('home-timeline.json');
  const { json: out, removed } = filterTimelineDetailed(input, { selfId: SELF });
  const ids = entryIds(out);
  const reasons = Object.fromEntries(removed.map((r) => [r.entryId, r.reason]));

  const kept = (id, why) => t.test(`görünür: ${why}`, () => assert.ok(ids.includes(id), `${id} kalmalıydı`));
  const gone = (id, reason, why) =>
    t.test(`kaldırıldı: ${why}`, () => {
      assert.ok(!ids.includes(id), `${id} kaldırılmalıydı`);
      assert.equal(reasons[id], reason);
    });

  await kept('tweet-1001', 'takip ettiğim mavi tikli');
  await gone('tweet-1002', REASON.BLUE, 'takip etmediğim mavi tikli');
  await kept('tweet-1003', 'altın tik (Business)');
  await kept('tweet-1004', 'gri tik (Government)');
  await kept('tweet-1005', 'tiksiz hesap');
  await gone('promoted-tweet-1006-a1b2c3', REASON.PROMOTED, 'reklam (entryId promoted-)');
  await gone('tweet-1007', REASON.PROMOTED, 'reklam (promotedMetadata, yazar takip edilen mavi olsa bile)');
  await kept('tweet-1008', 'takip ettiğimin mavi tikliyi RT etmesi');
  await kept('tweet-1009', 'takip ettiğimin mavi tikliyi alıntılaması');
  await gone('tweet-1010', REASON.BLUE, 'TweetWithVisibilityResults içindeki yabancı mavi');
  await kept('tweet-1011', 'TweetWithVisibilityResults içindeki takip ettiğim mavi');
  await kept('tweet-1012', 'kendi tweetim');
  await kept('tweet-1013', 'alanları eksik kullanıcı (fail-open)');
  await kept('tweet-1014', 'mavi ama takip alanı yok (fail-open)');
  await kept('tweet-1015', 'core alanı yok (fail-open)');
  await kept('tweet-1016', 'tombstone');
  await gone('tweet-1017', REASON.BLUE, 'eski şema: legacy.following=false + legacy.id_str');
  await gone('tweet-1018', REASON.BLUE, 'yalnız relationship_perspectives.following=false');
  await kept('tweet-1019', 'kaynaklardan biri following=true');
  await gone('tweet-1020', REASON.BLUE, 'alternatif yerleşim core.user_result');
  await kept('tweet-1021', 'UserUnavailable yazar');
  await gone('tweet-1022', REASON.QUOTE, 'takip etmediğimin yabancı maviyi alıntılaması');
  await kept('tweet-1023', 'takip etmediğimin takip ettiğim maviyi alıntılaması');
  await kept('tweet-1024', 'takip etmediğimin altın tiki alıntılaması');
  await gone('tweet-1025', REASON.QUOTE, 'alıntı TweetWithVisibilityResults içinde yabancı mavi');
  await kept('tweet-1026', 'takip etmediğimin beni alıntılaması');
  await kept('tweet-1027', 'alıntılayanın takip bilgisi yok (fail-open)');
  await gone('tweet-1028', REASON.BLUE, 'yabancı mavinin kendisi alıntı yapsa da dış yazar kuralı');
  await kept('who-to-follow-3001', 'tweet olmayan modüller');
  await t.test('imleçler korunur', () => {
    assert.equal(ids.filter((id) => id.startsWith('cursor-')).length, 2);
  });

  await t.test('RT: içteki retweeted_status_result dokunulmadan kalır', () => {
    const rt = entry(out, 'tweet-1008').content.itemContent.tweet_results.result;
    assert.ok(rt.legacy.retweeted_status_result.result.rest_id === '1108');
  });
  await t.test('Alıntı: quoted_status_result kutusu dokunulmadan kalır', () => {
    const q = entry(out, 'tweet-1009').content.itemContent.tweet_results.result;
    assert.equal(q.quoted_status_result.result.rest_id, '1109');
  });

  await t.test('konuşma modülü: yalnız mavi tikli yanıt çıkarılır', () => {
    const mod = entry(out, 'home-conversation-2001');
    assert.ok(mod, 'modül kalmalı');
    assert.deepEqual(
      mod.content.items.map((i) => i.entryId),
      ['home-conversation-2001-tweet-2001', 'home-conversation-2001-tweet-2003']
    );
    const r = removed.find((x) => x.entryId === 'home-conversation-2001-tweet-2002');
    assert.equal(r.reason, REASON.BLUE);
    assert.equal(r.module, 'home-conversation-2001');
  });
  await gone('home-conversation-2101', REASON.MODULE_ROOT, 'ilk öğesi çıkan konuşma modülü bütünüyle');

  await t.test('toplam kaldırma sayısı', () => {
    assert.equal(removed.length, 12);
  });
});

// ------------------------------------------------------------ Takip edilenler

test('Takip edilenler: PinEntry, AddEntries, AddToModule', () => {
  const input = load('home-latest-timeline.json');
  const out = filterTimeline(input, { selfId: SELF });
  const ins = instructions(out);

  assert.deepEqual(
    ins.map((i) => i.type),
    ['TimelineClearCache', 'TimelineAddEntries', 'TimelineAddToModule'],
    'yabancı mavi sabitleme, boşalan ve silinmiş modüle ekleme talimatları düşmeli'
  );

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

// ------------------------------------------------------------ güvenlik / dayanıklılık

test('kendi kimliğim bilinmiyorsa hiçbir mavi tikli gizlenmez, reklamlar yine gider', () => {
  const { removed } = filterTimelineDetailed(load('home-timeline.json'), { selfId: null });
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
  assert.ok(!ids.includes('tweet-1002'));
  assert.ok(ids.includes('tweet-1001'));
});

test('selfId sayı olarak da verilebilir; geçersiz değer yok sayılır', () => {
  const a = filterTimelineDetailed(load('home-timeline.json'), { selfId: 'abc' });
  assert.ok(a.removed.every((r) => r.reason === REASON.PROMOTED));
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
