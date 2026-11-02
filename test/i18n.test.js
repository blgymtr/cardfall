'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const I18N = require('../src/renderer/i18n');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('üç dilin de tüm anahtarları dolu', () => {
  for (const key of Object.keys(I18N.D.en)) {
    for (const l of I18N.LANGS) assert.ok(I18N.D[l][key] && I18N.D[l][key].length, `${l} eksik: ${key}`);
  }
});

test('her dilde aynı {parametreler} kullanılır', () => {
  const params = (s) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join(',');
  for (const key of Object.keys(I18N.D.en)) {
    const base = params(I18N.D.en[key]);
    for (const l of I18N.LANGS.filter((x) => x !== 'en')) assert.strictEqual(params(I18N.D[l][key]), base, `${l} parametre uyuşmuyor: ${key}`);
  }
});

test('kodda kullanılan her çeviri anahtarı sözlükte var', () => {
  const sources = ['src/renderer/app.js', 'src/main/main.js', 'src/main/controller.js', 'src/main/engine.js', 'src/main/vault.js'];
  const used = new Set();
  for (const f of sources) {
    const src = read(f);
    for (const m of src.matchAll(/['"`]((?:pw|msg|gate|forgot|login|qr|conn|notice|log|st|pill|hs|hero|btn|ov|s|toast|queue|ord|row|price|side|tot|dur|set|theme|lang|conc|min|lock|confirm|how|tray|notif|tb|sess|data|info)\.[A-Za-z0-9.-]+)['"`]/g)) { if (!m[1].endsWith('.json') && !m[1].endsWith('.js')) used.add(m[1]); }
  }
  const dynamic = ['theme.system', 'theme.dark', 'theme.light', 'how.1', 'how.2', 'how.3', 'how.4', 'how.5', 'how.6', 'how.7', 'ord.drops-desc', 'ord.value-desc', 'ord.hours-asc', 'ord.name'];
  for (const k of [...used, ...dynamic]) assert.ok(I18N.D.en[k] !== undefined, `sözlükte yok: ${k}`);
});

test('çoğul ve parametre yer tutucuları çalışır', () => {
  assert.strictEqual(I18N.t('en', 'queue.count', { n: 1 }), '1 game');
  assert.strictEqual(I18N.t('en', 'queue.count', { n: 5 }), '5 games');
  assert.strictEqual(I18N.t('de', 'queue.count', { n: 2 }), '2 Spiele');
  assert.strictEqual(I18N.t('fr', 'queue.count', { n: 1 }), '1 jeu');
  assert.strictEqual(I18N.t('es', 'queue.count', { n: 3 }), '3 juegos');
  assert.strictEqual(I18N.t('it', 'queue.count', { n: 1 }), '1 gioco');
  assert.strictEqual(I18N.t('tr', 'gate.wrong', { n: 3 }), 'Parola yanlış. Kalan deneme: 3');
  assert.strictEqual(I18N.t('xx', 'tb.lock'), 'Lock');
  assert.strictEqual(I18N.t('en', 'yok.boyle.anahtar'), 'yok.boyle.anahtar');
});

test('dil çözümleme: ayar > sistem dili > İngilizce', () => {
  assert.strictEqual(I18N.resolve('de', 'tr-TR'), 'de');
  assert.strictEqual(I18N.resolve('auto', 'tr-TR'), 'tr');
  assert.strictEqual(I18N.resolve('auto', 'de-AT'), 'de');
  assert.strictEqual(I18N.resolve('auto', 'it-IT'), 'it');
  assert.strictEqual(I18N.resolve('auto', 'fr-CA'), 'fr');
  assert.strictEqual(I18N.resolve('auto', 'es-MX'), 'es');
  assert.strictEqual(I18N.resolve('auto', 'pt-BR'), 'en');
  assert.strictEqual(I18N.resolve('auto', ''), 'en');
});
