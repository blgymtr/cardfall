'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Vault, checkPassphrase, failDelayMs } = require('../src/main/vault');

// DPAPI yerine sınama için tersinir sahte sarmalayıcı
const safe = { isAvailable: () => true, encrypt: (s) => Buffer.from('X' + s), decrypt: (b) => b.toString().slice(1) };
const mk = (now) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-vault-')); return { dir, v: new Vault({ dir, safe, now }) }; };

test('parola kuralları', () => {
  assert.ok(checkPassphrase('kısa'));
  assert.ok(checkPassphrase('12345678'));
  assert.ok(checkPassphrase('aaaaaaaaaa'));
  assert.ok(checkPassphrase('sadeceharf'));
  assert.strictEqual(checkPassphrase('Tamam123'), null);
  assert.strictEqual(checkPassphrase('uzun bir cümle parola'), null);
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
