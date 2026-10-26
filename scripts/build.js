'use strict';

// npm run build → dist/chrome, dist/firefox ve mağaza zip'leri.

const fs = require('node:fs');
const path = require('node:path');
const { drawIcon, createZip } = require('./lib');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const ICON_SIZES = [16, 32, 48, 128];
const MATCHES = ['https://x.com/*', 'https://twitter.com/*'];
const GECKO_ID = 'quiet-timeline@quiet-timeline.app';
const FIREFOX_MIN = '128.0'; // content_scripts "world": "MAIN" desteği

function baseManifest() {
  const icons = {};
  for (const s of ICON_SIZES) icons[s] = `icons/icon-${s}.png`;
  return {
    manifest_version: 3,
    name: 'Quiet Timeline',
    short_name: 'Quiet Timeline',
    version: pkg.version,
    description: pkg.description,
    icons,
    // Yalnızca "Filtrelemeyi bırak" listesi için; kurulumda uyarı göstermez.
    permissions: ['storage'],
    content_scripts: [
      {
        matches: MATCHES,
        js: ['content.js'],
        run_at: 'document_start',
        world: 'MAIN',
        all_frames: false,
      },
      {
        matches: MATCHES,
        js: ['bridge.js'],
        run_at: 'document_start',
        all_frames: false,
      },
    ],
  };
}

function chromeManifest() {
  return Object.assign(baseManifest(), { minimum_chrome_version: '111' });
}

function firefoxManifest() {
  return Object.assign(baseManifest(), {
    browser_specific_settings: {
      gecko: {
        id: GECKO_ID,
        strict_min_version: FIREFOX_MIN,
        data_collection_permissions: { required: ['none'] },
      },
    },
  });
}

// Her modül kendi `module` kapsamında çalışır; sayfaya global sızmaz.
const MODULES = [
  ['QuietTimelineFilter', 'src/filter.js'],
  ['QuietTimelineMute', 'src/mute.js'],
];

function bundleContentScript() {
  const parts = [
    `/*! Quiet Timeline v${pkg.version} — derlenmiş dosya, kaynak: src/filter.js + src/mute.js + src/inject.js */`,
    '(function () {',
  ];
  for (const [name, file] of MODULES) {
    parts.push(
      `const ${name} = (function () {`,
      'const module = { exports: {} };',
      '(function (module) {',
      fs.readFileSync(path.join(ROOT, file), 'utf8'),
      '})(module);',
      'return module.exports;',
      '})();'
    );
  }
  parts.push(fs.readFileSync(path.join(ROOT, 'src/inject.js'), 'utf8'), '})();', '');
  return parts.join('\n');
}

function bundleBridgeScript() {
  return [
    `/*! Quiet Timeline v${pkg.version} — derlenmiş dosya, kaynak: src/bridge.js */`,
    '(function () {',
    fs.readFileSync(path.join(ROOT, 'src/bridge.js'), 'utf8'),
    '})();',
    '',
  ].join('\n');
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p, base));
    else out.push({ name: path.relative(base, p).split(path.sep).join('/'), data: fs.readFileSync(p) });
  }
  return out;
}

function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  const content = bundleContentScript();
  const bridge = bundleBridgeScript();
  const icons = ICON_SIZES.map((s) => [s, drawIcon(s)]);

  // Depoda da görünür olsun (README / mağaza için).
  fs.mkdirSync(path.join(ROOT, 'icons'), { recursive: true });
  for (const [s, png] of icons) fs.writeFileSync(path.join(ROOT, 'icons', `icon-${s}.png`), png);

  const targets = { chrome: chromeManifest(), firefox: firefoxManifest() };
  for (const [name, manifest] of Object.entries(targets)) {
    const dir = path.join(DIST, name);
    fs.mkdirSync(path.join(dir, 'icons'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    fs.writeFileSync(path.join(dir, 'content.js'), content);
    fs.writeFileSync(path.join(dir, 'bridge.js'), bridge);
    for (const [s, png] of icons) fs.writeFileSync(path.join(dir, 'icons', `icon-${s}.png`), png);

    const zipPath = path.join(DIST, `quiet-timeline-${name}.zip`);
    fs.writeFileSync(zipPath, createZip(listFiles(dir)));
    console.log(`✓ dist/${name}/  →  dist/${path.basename(zipPath)}`);
  }

  // AMO "kaynak kodu" sorusu için kaynak arşivi.
  const sourceFiles = ['package.json', 'README.md', 'MAGAZA.md', 'LICENSE', 'src', 'scripts', 'tests']
    .filter((p) => fs.existsSync(path.join(ROOT, p)))
    .flatMap((p) => {
      const abs = path.join(ROOT, p);
      return fs.statSync(abs).isDirectory()
        ? listFiles(abs).map((f) => ({ name: `${p}/${f.name}`, data: f.data }))
        : [{ name: p, data: fs.readFileSync(abs) }];
    });
  fs.writeFileSync(path.join(DIST, 'quiet-timeline-source.zip'), createZip(sourceFiles));
  console.log('✓ dist/quiet-timeline-source.zip (AMO kaynak kodu için)');
}

if (require.main === module) build();

module.exports = { build, bundleContentScript, bundleBridgeScript, chromeManifest, firefoxManifest };
