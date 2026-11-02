'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store, sanitizeSettings, DEFAULT_SETTINGS, HISTORY_MAX } = require('../src/main/store');

const seal = { isAvailable: () => true, encrypt: (s) => Buffer.from('SEALED:' + Buffer.from(s).toString('hex')), decrypt: (b) => Buffer.from(b.toString().slice(7), 'hex').toString() };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cf-store-'));

test('ayarlar, istatistik ve geçmiş diskte düz metin durmaz ve geri okunur', () => {
  const dir = tmp();
  const a = new Store(dir, seal);
  a.setSettings({ blacklist: [123456789] });
  a.gameStat(42, 'Gizli Oyun Adı').cards = 3;
  a.stats.dropped = 3;
  a.addHistory({ t: Date.now(), appid: 42, name: 'Gizli Oyun Adı', n: 3, v: null });
  a.flush();
  for (const f of ['settings.json', 'stats.json', 'history.json']) {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(raw.includes('__sealed'), f + ' şifreli olmalı');
    assert.ok(!raw.includes('Gizli Oyun'), f + ' düz metin içermemeli');
  }
  const b = new Store(dir, seal);
  assert.deepStrictEqual(b.settings.blacklist, [123456789]);
  assert.strictEqual(b.stats.games[42].cards, 3);
  assert.strictEqual(b.history.length, 1);
});

test('eski düz metin dosyalar okunur ve şifreli biçime çevrilir', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ theme: 'dark', lockMinutes: 7 }));
  fs.writeFileSync(path.join(dir, 'stats.json'), JSON.stringify({ activeMs: 5000, dropped: 9, value: 1.5 }));
  const s = new Store(dir, seal);
  assert.strictEqual(s.settings.theme, 'dark');
  assert.strictEqual(s.settings.lockMinutes, 7);
  assert.strictEqual(s.stats.dropped, 9);
  assert.deepStrictEqual(s.stats.games, {});
  s.flush();
  assert.ok(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8').includes('__sealed'));
});

test('bozuk dosya uygulamayı bozmaz', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'settings.json'), '{kırık');
  fs.writeFileSync(path.join(dir, 'history.json'), '"yanlış tip"');
  const s = new Store(dir, seal);
  assert.deepStrictEqual(s.settings, DEFAULT_SETTINGS);
  assert.ok(Array.isArray(s.history));
});

test('geçmiş sınırlıdır', () => {
  const s = new Store(tmp(), null);
  for (let i = 0; i < HISTORY_MAX + 50; i++) s.addHistory({ t: i, appid: 1, name: 'x', n: 1, v: null });
  assert.strictEqual(s.history.length, HISTORY_MAX);
  assert.strictEqual(s.history[0].t, 50);
});

test('ayar doğrulama uç değerleri sınırlar', () => {
  const s = sanitizeSettings({ refreshMinutes: 9999, lockMinutes: -5, stuckMinutes: 99999, concurrency: 400, theme: 'neon', language: 'xx', launchAtLogin: 'evet', hideFromCapture: true, blacklist: [1, 'a', -3, 1, 7] });
  assert.strictEqual(s.refreshMinutes, 60);
  assert.strictEqual(s.lockMinutes, 0);
  assert.strictEqual(s.stuckMinutes, 1440);
  assert.strictEqual(s.concurrency, '32');
  assert.strictEqual(s.theme, 'system');
  assert.strictEqual(s.language, 'auto');
  assert.strictEqual(s.launchAtLogin, false);
  assert.strictEqual(s.hideFromCapture, true);
  assert.deepStrictEqual(s.blacklist, [1, 7]);
});
