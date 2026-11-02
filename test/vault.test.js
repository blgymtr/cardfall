'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Vault, checkPassphrase, failDelayMs, KDF } = require('../src/main/vault');

// DPAPI yerine sınama için tersinir sahte sarmalayıcı
const safe = { isAvailable: () => true, encrypt: (s) => Buffer.from('X' + s), decrypt: (b) => b.toString().slice(1) };
const mk = (now) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-vault-')); return { dir, v: new Vault({ dir, safe, now }) }; };

test('parola kuralları', () => {
  assert.ok(checkPassphrase('kısa'));
  assert.ok(checkPassphrase('Abcdefgh1'));            // 9 karakter
  assert.ok(checkPassphrase('1234567890'));
  assert.ok(checkPassphrase('aaaaaaaaaa'));
  assert.ok(checkPassphrase('abababababab'));
  assert.ok(checkPassphrase('sadeceharfler'));         // tek tür karakter ve < 16
  assert.ok(checkPassphrase('MyPassword123'));
  assert.ok(checkPassphrase('benimcardfall1'));
  assert.strictEqual(checkPassphrase('Tamam12345'), null);
  assert.strictEqual(checkPassphrase('uzun bir cumle sifre ok'), null);
  assert.strictEqual(checkPassphrase('x'.repeat(129)), 'pw.long');
});

test('sırlar parolasız okunamaz, parolayla geri gelir', async () => {
  const { dir, v } = mk();
  await v.create('Doğru-Parola-1');
  await v.saveSecrets({ refreshToken: 'SECRET-TOKEN-VALUE' });
  const disk = fs.readFileSync(path.join(dir, 'vault.bin')).toString();
  assert.ok(!disk.includes('SECRET-TOKEN-VALUE'), 'token diskte düz metin olmamalı');

  const v2 = new Vault({ dir, safe });
  assert.strictEqual((await v2.unlock('yanlış parola')).ok, false);
  const ok = await v2.unlock('Doğru-Parola-1');
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.secrets.refreshToken, 'SECRET-TOKEN-VALUE');
});

test('yanlış denemeler beklemeye alınır ve 10. hatada kasa silinir', async () => {
  let t = 1_000_000;
  const { dir, v } = mk(() => t);
  await v.create('Doğru-Parola-1');
  const v2 = new Vault({ dir, safe, now: () => t });
  const codes = [];
  for (let i = 0; i < 10; i++) {
    const r = await v2.unlock('yanlış-' + i);
    codes.push(r.code);
    t += 24 * 3600 * 1000; // beklemeyi geç
  }
  assert.deepStrictEqual(codes.slice(0, 9), Array(9).fill('WRONG'));
  assert.strictEqual(codes[9], 'WIPED');
  assert.strictEqual(v2.exists(), false);
});

test('bekleme süresi dolmadan doğru parola da reddedilir', async () => {
  let t = 5_000_000;
  const { dir, v } = mk(() => t);
  await v.create('Doğru-Parola-1');
  const v2 = new Vault({ dir, safe, now: () => t });
  for (let i = 0; i < 3; i++) await v2.unlock('x' + i);
  const r = await v2.unlock('Doğru-Parola-1');
  assert.strictEqual(r.code, 'LOCKED');
  assert.ok(r.waitMs > 0);
  t += failDelayMs(3) + 1;
  assert.strictEqual((await v2.unlock('Doğru-Parola-1')).ok, true);
});

test('gecikme 2. hatadan itibaren başlar ve üstel artar', () => {
  assert.strictEqual(failDelayMs(1), 0);
  assert.strictEqual(failDelayMs(2), 15_000);
  assert.strictEqual(failDelayMs(3), 30_000);
  assert.strictEqual(failDelayMs(4), 60_000);
  assert.strictEqual(failDelayMs(20), 30 * 60_000);
});

test('deneme sayacı kasa dosyasında durur; ayrı dosya silmek işe yaramaz', async () => {
  const t = 9_000_000;
  const { dir, v } = mk(() => t);
  await v.create('Doğru-Parola-1');
  await v.unlock('yanlış-1');
  await v.unlock('yanlış-2');
  fs.writeFileSync(path.join(dir, 'lock.json'), JSON.stringify({ fails: 0, until: 0 }));
  fs.rmSync(path.join(dir, 'lock.json'), { force: true });
  const fresh = new Vault({ dir, safe, now: () => t });   // yeni örnek, aynı sayaç
  assert.strictEqual(fresh.lockStatus().fails, 2);
  assert.ok(fresh.lockStatus().waitMs > 0);
});

test('kilit anahtarı bellekten silinir', async () => {
  const { v } = mk();
  await v.create('Doğru-Parola-1');
  assert.strictEqual(v.hasKey(), true);
  const key = v.key;
  v.forgetKey();
  assert.strictEqual(v.hasKey(), false);
  assert.ok(key.every((b) => b === 0), 'anahtar baytları sıfırlanmalı');
  await assert.rejects(() => v.saveSecrets({ a: 1 }));
});

test('parola değiştirilir, eskisi geçersiz olur', async () => {
  const { dir, v } = mk();
  await v.create('Eski-Parola-1');
  await v.saveSecrets({ refreshToken: 'abc' });
  assert.strictEqual((await v.changePassphrase('Eski-Parola-1', 'Yeni-Parola-2')).ok, true);
  const v2 = new Vault({ dir, safe });
  assert.strictEqual((await v2.unlock('Eski-Parola-1')).ok, false);
  const r = await v2.unlock('Yeni-Parola-2');
  assert.strictEqual(r.secrets.refreshToken, 'abc');
});

test('zayıf yeni parola ile değişiklik reddedilir', async () => {
  const { v } = mk();
  await v.create('Eski-Parola-1');
  const r = await v.changePassphrase('Eski-Parola-1', '12345678');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'WEAK');
});

test('eski, zayıf KDF ile yazılmış kasa doğru parolayla açılınca yükseltilir', async () => {
  const { dir, v } = mk();
  const pass = 'Eski-Kasa-Parola-7';
  const salt = crypto.randomBytes(16);
  const weak = { N: 16384, r: 8, p: 1 };
  const k = crypto.scryptSync(Buffer.from(pass), salt, 64, { ...weak, maxmem: 256 * 1024 * 1024 });
  v.key = Buffer.from(k.subarray(0, 32));
  v.verifier = Buffer.from(k.subarray(32, 64));
  v._write({ v: 1, kdf: { ...weak, salt: salt.toString('base64') }, verifier: v.verifier.toString('base64'), ...v._seal({ refreshToken: 'old-token' }) });
  v.forgetKey();
  assert.strictEqual(v._read().kdf.N, 16384);

  const r = await v.unlock(pass);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.secrets.refreshToken, 'old-token');
  assert.strictEqual(v._read().kdf.N, KDF.N);
  // yükseltilmiş kasa yeniden açılabilir
  const v2 = new Vault({ dir, safe });
  assert.strictEqual((await v2.unlock(pass)).secrets.refreshToken, 'old-token');
});
