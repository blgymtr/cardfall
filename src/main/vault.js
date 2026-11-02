'use strict';
// Kasa: Steam yenileme anahtarı (refresh token) diskte ASLA düz metin durmaz.
//  1) Parolandan scrypt (N=2^17, 128 MB bellek) ile 64 baytlık anahtar türetilir:
//     ilk 32 bayt AES-256-GCM şifreleme anahtarı, son 32 bayt parola doğrulayıcı.
//  2) Şifreli paket ayrıca Windows DPAPI (Electron safeStorage) ile sarılır;
//     yani dosya başka bir Windows kullanıcısında/bilgisayarında açılamaz.
//  3) Yanlış parola denemeleri üstel olarak yavaşlatılır, 10. hatada kasa silinir.
//     Deneme sayacı kasa dosyasının içindedir; ayrı bir dosyayı silerek sıfırlanamaz.
//  4) Eski, daha zayıf KDF ile yazılmış kasalar doğru parolayla açıldığında otomatik yükseltilir.
//  5) Şifreleme anahtarı yalnızca kasa açıkken bellektedir; arayüz kilitlenince sıfırlanır.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { shredFile } = require('./shred');

const KDF = { N: 131072, r: 8, p: 1 };
const MAXMEM = 512 * 1024 * 1024;
const AAD = Buffer.from('cardfall-vault-v1');
const MAX_FAILS = 10;
const MIN_LEN = 10;

const COMMON = new Set([
  '12345678', '123456789', '1234567890', '12345678910', 'password', 'password1', 'password12', 'qwertyui', 'qwertyuiop', 'qwerty123', 'qwerty1234',
  '11111111', '00000000', 'iloveyou', 'abcd1234', 'abcd123456', '87654321', 'asdfghjk', 'asdfghjkl', 'letmein123', 'welcome123', 'admin12345',
  'steam12345', 'steampassword', 'changeme123', 'trustno1234',
]);

/** @returns {string|null} çeviri anahtarı (hata) ya da null */
function checkPassphrase(p) {
  if (typeof p !== 'string') return 'pw.invalid';
  if (p.length < MIN_LEN) return 'pw.short';
  if (p.length > 128) return 'pw.long';
  const low = p.toLowerCase();
  if (COMMON.has(low) || low.includes('password') || low.includes('cardfall')) return 'pw.common';
  if (/^(0123456789|1234567890|abcdefghij|qwertyuiop|asdfghjkl|zxcvbnm)/i.test(p) && p.length < 16) return 'pw.common';
  if (/^(.)\1+$/.test(p)) return 'pw.same';
  if (/^(.{1,3})\1+$/.test(p)) return 'pw.same';
  const classes = [/[a-zçğıöşü]/, /[A-ZÇĞİÖŞÜ]/, /\d/, /[^A-Za-z0-9çğıöşüÇĞİÖŞÜ]/].filter((r) => r.test(p)).length;
  if (p.length < 16 && classes < 2) return 'pw.weak';
  return null;
}

function derive(pass, salt, kdf = KDF) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(Buffer.from(pass.normalize('NFKC'), 'utf8'), salt, 64, { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: MAXMEM }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

function failDelayMs(fails) {
  if (fails < 2) return 0;
  return Math.min(30 * 60, 15 * 2 ** (fails - 2)) * 1000;
}

class Vault {
  /**
   * @param {{dir: string, safe: {isAvailable(): boolean, encrypt(s: string): Buffer, decrypt(b: Buffer): string}, now?: () => number}} o
   */
  constructor({ dir, safe, now = Date.now }) {
    this.dir = dir;
    this.safe = safe;
    this.now = now;
    this.file = path.join(dir, 'vault.bin');
    this.key = null;       // 32 baytlık şifreleme anahtarı (yalnızca bellekte, kasa açıkken)
    this.verifier = null;  // 32 baytlık doğrulayıcı
    this._busy = false;
    try { fs.rmSync(path.join(dir, 'lock.json'), { force: true }); } catch { /* eski sürümden kalma dosya */ }
  }

  exists() { return fs.existsSync(this.file); }
  hasKey() { return !!this.key; }

  // ---- dosya --------------------------------------------------------------
  _assertSafe() {
    if (!this.safe.isAvailable()) throw new Error('Windows encryption (DPAPI) is unavailable');
  }
  _write(payload) {
    this._assertSafe();
    const blob = this.safe.encrypt(JSON.stringify(payload));
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, blob, { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }
  _read() {
    this._assertSafe();
    return JSON.parse(this.safe.decrypt(fs.readFileSync(this.file)));
  }

  // ---- deneme sınırı (kasa dosyasının içinde) ---------------------------------
  _readLock() {
    try {
      const j = this._read();
      return { fails: Number(j.fails) || 0, until: Number(j.until) || 0 };
    } catch { return { fails: 0, until: 0 }; }
  }
  _writeLock(s) {
    if (!this.exists()) return;
    try {
      const j = this._read();
      j.fails = s.fails;
      j.until = s.until;
      this._write(j);
    } catch { /* kasa okunamıyorsa yok say */ }
  }
  lockStatus() {
    if (!this.exists()) return { fails: 0, waitMs: 0, left: MAX_FAILS };
    const s = this._readLock();
    return { fails: s.fails, waitMs: Math.max(0, s.until - this.now()), left: Math.max(0, MAX_FAILS - s.fails) };
  }

  // ---- şifreleme ------------------------------------------------------------
  _seal(secrets) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    c.setAAD(AAD);
    const ct = Buffer.concat([c.update(JSON.stringify(secrets || {}), 'utf8'), c.final()]);
    return { iv: iv.toString('base64'), ct: ct.toString('base64'), tag: c.getAuthTag().toString('base64') };
  }
  _open(p) {
    const d = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(p.iv, 'base64'));
    d.setAAD(AAD);
    d.setAuthTag(Buffer.from(p.tag, 'base64'));
    const pt = Buffer.concat([d.update(Buffer.from(p.ct, 'base64')), d.final()]);
    return JSON.parse(pt.toString('utf8'));
  }

  async _newKey(pass) {
    const salt = crypto.randomBytes(16);
    const k = await derive(pass, salt);
    this.forgetKey();
    this.key = Buffer.from(k.subarray(0, 32));
    this.verifier = Buffer.from(k.subarray(32, 64));
    k.fill(0);
    return salt;
  }

  // ---- genel API ----------------------------------------------------------
  async create(pass) {
    const err = checkPassphrase(pass);
    if (err) throw new Error(err);
    const salt = await this._newKey(pass);
    this._write({ v: 2, kdf: { ...KDF, salt: salt.toString('base64') }, verifier: this.verifier.toString('base64'), ...this._seal({}), fails: 0, until: 0 });
  }

  /** Parolayı denetler; sayaç işler. Başarılıysa anahtarı belleğe alır ve sırları döner. */
  async unlock(pass) {
    if (this._busy) return { ok: false, code: 'BUSY' };
    const st = this.lockStatus();
    if (st.waitMs > 0) return { ok: false, code: 'LOCKED', waitMs: st.waitMs, left: st.left };
    this._busy = true;
    try {
      if (typeof pass !== 'string' || pass.length > 128) return await this._fail();
      let payload;
      try { payload = this._read(); } catch { return { ok: false, code: 'CORRUPT' }; }
      const k = await derive(pass, Buffer.from(payload.kdf.salt, 'base64'), payload.kdf);
      const verifier = Buffer.from(payload.verifier, 'base64');
      const good = k.subarray(32, 64).length === verifier.length && crypto.timingSafeEqual(k.subarray(32, 64), verifier);
      if (!good) { k.fill(0); return await this._fail(); }
      this.forgetKey();
      this.key = Buffer.from(k.subarray(0, 32));
      this.verifier = Buffer.from(k.subarray(32, 64));
      k.fill(0);
      let secrets;
      try { secrets = this._open(payload); } catch { this.forgetKey(); return { ok: false, code: 'CORRUPT' }; }
      // eski/zayıf KDF ile yazılmış kasayı güncel parametrelere yükselt
      if (payload.kdf.N < KDF.N || payload.kdf.r < KDF.r || payload.kdf.p < KDF.p) {
        const salt = await this._newKey(pass);
        this._write({ v: 2, kdf: { ...KDF, salt: salt.toString('base64') }, verifier: this.verifier.toString('base64'), ...this._seal(secrets), fails: 0, until: 0 });
      } else {
        this._writeLock({ fails: 0, until: 0 });
      }
      return { ok: true, secrets };
    } finally {
      this._busy = false;
    }
  }

  async _fail() {
    const s = this._readLock();
    s.fails += 1;
    if (s.fails >= MAX_FAILS) {
      this.wipe();
      return { ok: false, code: 'WIPED' };
    }
    s.until = this.now() + failDelayMs(s.fails);
    this._writeLock(s);
    return { ok: false, code: 'WRONG', left: MAX_FAILS - s.fails, waitMs: Math.max(0, s.until - this.now()) };
  }

  /** Bellekteki anahtar varken parolayı yeniden doğrular (sayaç işler). */
  async verify(pass) {
    if (!this.key) return { ok: false, code: 'NOKEY' };
    if (this._busy) return { ok: false, code: 'BUSY' };
    const st = this.lockStatus();
    if (st.waitMs > 0) return { ok: false, code: 'LOCKED', waitMs: st.waitMs, left: st.left };
    this._busy = true;
    try {
      if (typeof pass !== 'string' || pass.length > 128) return await this._fail();
      const payload = this._read();
      const k = await derive(pass, Buffer.from(payload.kdf.salt, 'base64'), payload.kdf);
      const good = crypto.timingSafeEqual(k.subarray(32, 64), this.verifier);
      k.fill(0);
      if (!good) return await this._fail();
      this._writeLock({ fails: 0, until: 0 });
      return { ok: true };
    } finally {
      this._busy = false;
    }
  }

  async saveSecrets(secrets) {
    if (!this.key) throw new Error('Vault is locked');
    const payload = this._read();
    Object.assign(payload, this._seal(secrets));
    this._write(payload);
  }

  async changePassphrase(oldPass, newPass) {
    const err = checkPassphrase(newPass);
    if (err) return { ok: false, code: 'WEAK', messageKey: err };
    const v = await this.verify(oldPass);
    if (!v.ok) return v;
    const old = this._read();
    const secrets = this._open(old);
    const salt = await this._newKey(newPass);
    this._write({ v: 2, kdf: { ...KDF, salt: salt.toString('base64') }, verifier: this.verifier.toString('base64'), ...this._seal(secrets), fails: 0, until: 0 });
    return { ok: true };
  }

  forgetKey() {
    if (this.key) this.key.fill(0);
    if (this.verifier) this.verifier.fill(0);
    this.key = null;
    this.verifier = null;
  }

  wipe() {
    this.forgetKey();
    shredFile(this.file);
    shredFile(this.file + '.tmp');
  }

  /** Yalnızca şifre çözmeden okunabilen, gizli olmayan KDF bilgisi. */
  kdfInfo() {
    try { const k = this._read().kdf; return { N: k.N, r: k.r, p: k.p }; } catch { return null; }
  }
}

module.exports = { Vault, checkPassphrase, failDelayMs, MAX_FAILS, KDF, MIN_LEN };
