'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');

const { chromeManifest, firefoxManifest } = require('../scripts/build');
const { drawIcon, createZip, crc32 } = require('../scripts/lib');

for (const [name, m] of [['chrome', chromeManifest()], ['firefox', firefoxManifest()]]) {
  test(`${name} manifest: MV3, MAIN world, document_start, izin yok`, () => {
    assert.equal(m.manifest_version, 3);
    assert.equal(m.name, 'Quiet Timeline');
    assert.ok(!/twitter|\bX\b/i.test(m.name));
    assert.ok(m.description.length <= 132, 'Chrome açıklama sınırı 132 karakter');
    assert.equal(m.permissions, undefined);
    assert.equal(m.host_permissions, undefined);
    assert.equal(m.background, undefined);
    assert.equal(m.content_scripts.length, 1);
    const cs = m.content_scripts[0];
    assert.deepEqual(cs.matches, ['https://x.com/*', 'https://twitter.com/*']);
    assert.equal(cs.world, 'MAIN');
    assert.equal(cs.run_at, 'document_start');
    assert.deepEqual(Object.keys(m.icons), ['16', '32', '48', '128']);
  });
}

test('firefox manifest: gecko ayarları', () => {
  const g = firefoxManifest().browser_specific_settings.gecko;
  assert.match(g.id, /@/);
  assert.ok(parseFloat(g.strict_min_version) >= 128);
  assert.deepEqual(g.data_collection_permissions, { required: ['none'] });
  assert.equal(chromeManifest().browser_specific_settings, undefined);
});

test('ikonlar geçerli PNG ve doğru boyutta', () => {
  for (const s of [16, 32, 48, 128]) {
    const png = drawIcon(s);
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(png.readUInt32BE(16), s);
    assert.equal(png.readUInt32BE(20), s);
  }
});

test('zip: yerel başlıklar okunabilir ve CRC doğru', () => {
  const files = [
    { name: 'manifest.json', data: Buffer.from('{"a":1}'.repeat(50)) },
    { name: 'icons/x.bin', data: Buffer.from([1, 2, 3]) },
  ];
  const zip = createZip(files);
  let off = 0;
  for (const f of files) {
    assert.equal(zip.readUInt32LE(off), 0x04034b50);
    const method = zip.readUInt16LE(off + 8);
    const csize = zip.readUInt32LE(off + 18);
    const nlen = zip.readUInt16LE(off + 26);
    assert.equal(zip.toString('utf8', off + 30, off + 30 + nlen), f.name);
    const body = zip.subarray(off + 30 + nlen, off + 30 + nlen + csize);
    const data = method === 8 ? zlib.inflateRawSync(body) : body;
    assert.ok(data.equals(f.data));
    assert.equal(zip.readUInt32LE(off + 14), crc32(f.data));
    off += 30 + nlen + csize;
  }
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
});
