'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');
const { Engine } = require('../src/main/engine');

function setup(games, settings = {}) {
  const calls = [];
  const backend = Object.assign(new EventEmitter(), {
    blocked: false,
    setGames: (ids) => calls.push(ids.slice()),
    games,
    fetchGames: async () => backend.games.map((g) => ({ ...g })),
  });
  const prices = Object.assign(new EventEmitter(), {
    template: { prefix: '$', suffix: '', dec: '.', decimals: 2, hasDecimals: true },
    get: (id) => (id === 1 ? { unit: 0.5 } : null),
    format: (v) => '$' + v.toFixed(2),
    netOf: (v) => v / 1.15,
    ensure() {},
    progress: () => ({ done: 0, total: 0 }),
    stop() {},
  });
  const store = {
    settings: { order: 'drops-desc', concurrency: 'smart', refreshMinutes: 5, blacklist: [], ...settings },
    stats: { activeMs: 0, dropped: 0, value: 0 },
    statsFile: { save() {} },
    setSettings(p) { Object.assign(this.settings, p); return this.settings; },
  };
  const e = new Engine({ backend, prices, store });
  return { e, backend, calls, store };
}
const G = (appid, drops, hours) => ({ appid, name: 'G' + appid, drops, hours });

test('akıllı mod: 2 saatin altındakiler birlikte çalışır', async () => {
  const { e, calls } = setup([G(1, 3, 0.5), G(2, 2, 1.2), G(3, 5, 10)]);
  await e.start();
  assert.deepStrictEqual([...e.idling].sort(), [1, 2]);
  assert.deepStrictEqual([...calls.at(-1)].sort(), [1, 2]);
  e.pause();
});

test('akıllı mod: hepsi 2 saati geçtiyse tek oyun, en çok kartlı', async () => {
  const { e } = setup([G(1, 3, 5), G(2, 7, 9), G(3, 1, 30)]);
  await e.start();
  assert.deepStrictEqual(e.idling, [2]);
  e.pause();
});

test('kart düşünce sayılır, bitince sıradaki oyuna geçilir', async () => {
  const { e, backend } = setup([G(1, 1, 5), G(2, 1, 6)]);
  await e.start();
  const first = e.idling[0];
  backend.games = backend.games.map((g) => (g.appid === first ? { ...g, drops: 0 } : g));
  await e.refresh();
  assert.strictEqual(e.dropped, 1);
  assert.notStrictEqual(e.idling[0], first);
  assert.strictEqual(e.snapshot().totals.drops, 1);
  e.pause();
});

test('değer yalnızca fiyatı bilinen oyunlardan hesaplanır', async () => {
  const { e, backend } = setup([G(1, 4, 5), G(2, 2, 6)]);
  await e.start();
  backend.games = backend.games.map((g) => (g.appid === 1 ? { ...g, drops: 2 } : g));
  await e.refresh();
  assert.strictEqual(e.droppedValue, 1); // 2 kart × 0,5
  e.pause();
});

test('pin, kara liste ve duraklatma', async () => {
  const { e, calls } = setup([G(1, 3, 5), G(2, 7, 9)]);
  await e.start();
  assert.deepStrictEqual(e.idling, [2]);
  e.pin(1);
  assert.deepStrictEqual(e.idling, [1]);
  e.unpin();
  e.setBlacklisted(2, true);
  assert.deepStrictEqual(e.idling, [1]);
  e.pause();
  assert.deepStrictEqual(calls.at(-1), []);
  assert.deepStrictEqual(e.idling, []);
});

test('sabit eşzamanlılık sayısı uygulanır', async () => {
  const games = Array.from({ length: 10 }, (_, i) => G(i + 1, 5 - (i % 3), 10));
  const { e } = setup(games, { concurrency: '3' });
  await e.start();
  assert.strictEqual(e.idling.length, 3);
  e.pause();
});

test('başka yerde oyun açıkken çalışma süresi işlemez', async () => {
  let t = 1000;
  const { e, backend } = setup([G(1, 2, 5)]);
  e.now = () => t;
  await e.start();
  t += 60_000;
  backend.blocked = true;
  e._accrue();
  const before = e.activeMs;
  assert.ok(before >= 60_000);
  t += 120_000;
  e._accrue();
  assert.strictEqual(e.activeMs, before);
  e.pause();
});
