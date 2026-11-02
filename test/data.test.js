'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { shredFile, shredDir, sizeOf } = require('../src/main/shred');
const { Store } = require('../src/main/store');
const { AppInfo, plain } = require('../src/main/appinfo');
const { looksLikeImage } = require('../src/main/security.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cf-data-'));

test('kalıcı silme: içerik üzerine yazılır ve dosya kalkar', () => {
  const dir = tmp();
  const f = path.join(dir, 'gizli.txt');
  const secret = 'TOP-SECRET-TOKEN-'.repeat(200);
  fs.writeFileSync(f, secret);
  // silmeden önce aynı inode'u açık tutup üzerine yazıldığını doğrula
  const fd = fs.openSync(f, 'r');
  const bytes = shredFile(f);
  assert.strictEqual(bytes, secret.length);
  assert.strictEqual(fs.existsSync(f), false);
  const after = Buffer.alloc(secret.length);
  fs.readSync(fd, after, 0, after.length, 0);
  fs.closeSync(fd);
  assert.ok(!after.toString('latin1').includes('TOP-SECRET'), 'eski içerik okunabilir kalmamalı');
  assert.deepStrictEqual(fs.readdirSync(dir), []);
});

test('kalıcı silme: klasör ve alt klasörleri temizler, olmayan yol hata vermez', () => {
  const dir = path.join(tmp(), 'cache');
  fs.mkdirSync(path.join(dir, 'a', 'b'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'x.img'), Buffer.alloc(2048, 7));
  fs.writeFileSync(path.join(dir, 'a', 'b', 'y.img'), Buffer.alloc(100, 9));
  assert.strictEqual(sizeOf(dir), 2148);
  assert.strictEqual(shredDir(dir), 2148);
  assert.strictEqual(fs.existsSync(dir), false);
  assert.strictEqual(shredDir(path.join(dir, 'yok')), 0);
  assert.strictEqual(shredFile(path.join(dir, 'yok.txt')), 0);
});

test('önbellek temizliği görsel, fiyat ve bilgi önbelleğini siler; istatistik kalır', () => {
  const dir = tmp();
  const s = new Store(dir, null);
  fs.mkdirSync(s.cacheDir, { recursive: true });
  fs.writeFileSync(path.join(s.cacheDir, '1_capsule.img'), Buffer.alloc(500, 1));
  s.priceFile.data.template = { prefix: '$' };
  s.priceFile.data.games[1] = { t: 1, unit: 1, count: 1 };
  s.priceFile.flush();
  s.infoFile.data[1] = { t: 1, name: 'x' };
  s.infoFile.flush();
  s.stats.dropped = 5;
  const freed = s.clearCache();
  assert.ok(freed >= 500);
  assert.strictEqual(fs.existsSync(s.cacheDir), false);
  assert.deepStrictEqual(s.priceFile.data.games, {});
  assert.deepStrictEqual(s.infoFile.data, {});
  assert.strictEqual(fs.existsSync(s.priceFile.file), false);
  assert.strictEqual(s.stats.dropped, 5);
});

test('geçmişi silmek toplam sayaçları korur', () => {
  const s = new Store(tmp(), null);
  s.stats.dropped = 7;
  s.addHistory({ t: 1, appid: 1, name: 'a', n: 7, v: null });
  s.clearHistory();
  assert.strictEqual(s.history.length, 0);
  assert.strictEqual(s.stats.dropped, 7);
});

test('hesaptan tam çıkış: istatistik, geçmiş, önbellek ve gizlenenler gider; ayarlar kalır', () => {
  const dir = tmp();
  const s = new Store(dir, null);
  s.setSettings({ theme: 'dark', blacklist: [10, 20] });
  s.stats.dropped = 3;
  s.gameStat(10, 'x').cards = 3;
  s.addHistory({ t: 1, appid: 10, name: 'x', n: 3, v: null });
  s.accountWipe();
  assert.strictEqual(s.stats.dropped, 0);
  assert.deepStrictEqual(s.stats.games, {});
  assert.strictEqual(s.history.length, 0);
  assert.deepStrictEqual(s.settings.blacklist, []);
  assert.strictEqual(s.settings.theme, 'dark');
});

test('tüm verileri silmek dosyaları kaldırır', () => {
  const dir = tmp();
  const s = new Store(dir, null);
  s.setSettings({ theme: 'light' });
  s.flush();
  fs.mkdirSync(s.cacheDir, { recursive: true });
  fs.writeFileSync(path.join(s.cacheDir, 'a.img'), 'x');
  s.wipeAll();
  assert.strictEqual(fs.existsSync(path.join(dir, 'settings.json')), false);
  assert.strictEqual(fs.existsSync(s.cacheDir), false);
  assert.strictEqual(s.settings.theme, 'system');
});

test('veri dökümü boyutları verir', () => {
  const s = new Store(tmp(), null);
  s.flush();
  const info = s.dataInfo();
  assert.ok(info.dir);
  assert.ok(info.files.some((f) => f.name === 'settings'));
  assert.ok(info.total >= 0);
});

test('mağaza bilgisi: HTML temizlenir, ağ yoksa önbellekten döner', async () => {
  assert.strictEqual(plain('<b>Merhaba</b> &quot;dünya&quot; &amp; ben', 100), 'Merhaba "dünya" & ben');
  assert.strictEqual(plain('x'.repeat(50), 10).length, 10);
  const store = new Store(tmp(), null);
  store.infoFile.data[5] = { t: Date.now(), name: 'Önbellekte', header: null, desc: { en: 'hello' }, genres: [], devs: [], release: '' };
  const offline = new AppInfo({ store, offline: true });
  assert.strictEqual((await offline.load(5, 'en')).name, 'Önbellekte');
  assert.strictEqual(await offline.load(999, 'en'), null);
  assert.strictEqual(await offline.load('abc', 'en'), null);
});

test('görsel doğrulama yalnızca JPEG/PNG kabul eder', () => {
  assert.strictEqual(looksLikeImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(20).fill(0)])), 'image/jpeg');
  assert.strictEqual(looksLikeImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Array(20).fill(0)])), 'image/png');
  assert.strictEqual(looksLikeImage(Buffer.from('<html>not an image at all</html>')), null);
  assert.strictEqual(looksLikeImage(Buffer.alloc(5)), null);
});
