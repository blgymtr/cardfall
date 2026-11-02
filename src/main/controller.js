'use strict';
// Uygulama mantığı: kasa + Steam oturumu + motor. Electron'a bağımlı değil (test edilebilir).

const path = require('path');
const { EventEmitter } = require('events');
const QRCode = require('qrcode');
const { Store } = require('./store');
const { Vault, checkPassphrase } = require('./vault');
const { Engine } = require('./engine');
const { PriceService } = require('./prices');
const I18N = require('../renderer/i18n');

class Controller extends EventEmitter {
  /**
   * @param {{dir: string, safe: any, demo?: boolean, version?: string}} o
   */
  constructor({ dir, safe, demo = false, version = '', locale = 'en' }) {
    super();
    this.locale = locale;
    this.dir = dir;
    this.demo = demo;
    this.version = version;
    this.store = new Store(dir);
    this.vault = new Vault({ dir, safe });

    if (demo) {
      const { DemoBackend, DemoPrices } = require('./demo');
      this.backend = new DemoBackend();
      this.prices = new DemoPrices({ store: this.store, getCookies: () => null });
    } else {
      const { SteamBackend } = require('./steam');
      this.backend = new SteamBackend();
      this.prices = new PriceService({ store: this.store, getCookies: () => this.backend.getCookies() });
    }
    this.engine = new Engine({ backend: this.backend, prices: this.prices, store: this.store });

    this.uiLocked = true;
    this._phase = 'login';       // login | connecting | ready
    this.net = 'online';
    this.token = null;
    this.account = { name: '' };
    this.qr = { state: 'idle', image: null, error: null };
    this.notice = null;
    this.connectError = null;
    this.firstLogon = true;

    this._wire();
    this.engine.on('change', () => this.emitState());
  }

  // ---- durum ---------------------------------------------------------------------
  phase() {
    if (!this.vault.exists()) return 'setup';
    if (this.uiLocked) return 'locked';
    return this._phase;
  }

  emitState() { this.emit('state'); }

  lang() { return I18N.resolve(this.store.settings.language, this.locale); }
  t(key, params) { return I18N.t(this.lang(), key, params); }

  setLanguage(language) {
    this.store.setSettings({ language });
    this.emitState();
  }

  publicState() {
    const phase = this.phase();
    const s = this.store.settings;
    const out = {
      phase,
      version: this.version,
      demo: this.demo,
      theme: s.theme,
      lang: this.lang(),
      lock: this.vault.lockStatus(),
      notice: this.notice,
      sessionAlive: this.vault.hasKey() && this._phase !== 'login',
      farming: this.engine.run === 'running',
    };
    if (phase === 'login') out.qr = this.qr;
    if (phase === 'connecting') out.connectError = this.connectError;
    if (phase === 'ready' || phase === 'connecting') out.account = this.account;
    if (phase === 'ready') {
      out.settings = { ...s };
      out.net = this.net;
      out.engine = this.engine.snapshot();
    }
    return out;
  }

  /** Kilitliyken bile güvenli olan kısa özet (tepsi ipucu için). */
  summary() {
    const e = this.engine;
    return { run: e.run, active: e.isActive(), idling: e.idling.length, phase: this.phase() };
  }

  // ---- Steam olayları -----------------------------------------------------------------
  _wire() {
    const b = this.backend;
    b.on('qr', async (url) => {
      try {
        const image = await QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: 'M', color: { dark: '#0b0d12', light: '#ffffff' } });
        this.qr = { state: 'waiting', image, error: null };
      } catch { this.qr = { state: 'error', image: null, error: 'qr.errImage' }; }
      this.emitState();
    });
    b.on('qrScanned', () => { this.qr = { ...this.qr, state: 'scanned' }; this.emitState(); });
    b.on('qrFail', (why) => {
      if (this._phase !== 'login') return;
      if (why === 'timeout') { this.qr = { state: 'expired', image: null, error: null }; this.emitState(); setTimeout(() => { if (this._phase === 'login' && !this.uiLocked) this.startLogin(); }, 600); }
      else { this.qr = { state: 'error', image: null, error: 'qr.errFail' }; this.emitState(); }
    });
    b.on('qrDone', async ({ refreshToken, accountName }) => {
      this.token = refreshToken;
      if (accountName) this.account = { name: accountName };
      try { await this.vault.saveSecrets({ refreshToken, accountName: accountName || '' }); } catch { /* kasa yazılamazsa oturum yine de çalışır */ }
      this._connect();
    });
    b.on('account', (name) => { if (name) { this.account = { name }; this.emitState(); } });
    b.on('refreshToken', async (t) => {
      this.token = t;
      try { await this.vault.saveSecrets({ refreshToken: t, accountName: this.account.name }); } catch { /* yok say */ }
    });
    b.on('loggedOn', () => {
      this.net = 'online';
      this.connectError = null;
      this._phase = 'ready';
      if (this.firstLogon) {
        this.firstLogon = false;
        this.engine.reset();
        if (this.store.settings.autoStart) this.engine.start(); else this.engine.refresh();
      } else {
        this.engine.onBackendChanged();
      }
      this.emitState();
    });
    b.on('disconnected', () => { this.net = 'offline'; this.engine._accrue(); this.engine.changed(); this.emitState(); });
    b.on('blocked', (blocked) => {
      this.engine._accrue();
      this.engine.log('warn', blocked ? 'log.blocked' : 'log.unblocked');
      if (!blocked) this.engine.onBackendChanged(); else this.engine.changed();
      this.emitState();
    });
    b.on('failed', async ({ tokenDead, message }) => {
      this.net = 'offline';
      if (tokenDead) {
        this.engine.pause();
        this.token = null;
        try { await this.vault.saveSecrets({}); } catch { /* yok say */ }
        this.notice = 'notice.expired';
        this.startLogin();
      } else {
        this.connectError = message;
        this.engine.log('error', 'log.connError', { reason: message });
        clearTimeout(this._retryT);
        this._retryT = setTimeout(() => { if (this.token) this.backend.logOn(this.token); }, 30000);
        this.emitState();
      }
    });
  }

  _connect() {
    this._phase = 'connecting';
    this.connectError = null;
    this.qr = { state: 'idle', image: null, error: null };
    this.emitState();
    this.backend.logOn(this.token);
  }

  startLogin() {
    this._phase = 'login';
    this.qr = { state: 'idle', image: null, error: null };
    this.emitState();
    this.backend.startQR();
  }

  // ---- kasa / kilit ------------------------------------------------------------------------
  async setup(pass) {
    if (this.vault.exists()) return { ok: false, messageKey: 'msg.vaultExists' };
    const err = checkPassphrase(pass);
    if (err) return { ok: false, messageKey: err };
    await this.vault.create(pass);
    this.uiLocked = false;
    this.notice = null;
    this.startLogin();
    return { ok: true };
  }

  async unlock(pass) {
    if (!this.vault.exists()) return { ok: false, code: 'NOVAULT' };
    const alive = this.vault.hasKey() && this._phase !== 'login';
    if (alive) {
      const v = await this.vault.verify(pass);
      if (v.ok) { this.uiLocked = false; this.emitState(); }
      return this._lockResult(v);
    }
    const r = await this.vault.unlock(pass);
    if (r.ok) {
      this.uiLocked = false;
      this.notice = null;
      this.token = r.secrets.refreshToken || null;
      if (r.secrets.accountName) this.account = { name: r.secrets.accountName };
      if (this.token) this._connect(); else this.startLogin();
      return { ok: true };
    }
    if (r.code === 'WIPED') {
      this.notice = 'notice.tooMany';
      this.emitState();
    }
    return this._lockResult(r);
  }

  _lockResult(r) {
    if (r.ok) return { ok: true };
    return { ok: false, code: r.code, waitMs: r.waitMs || 0, left: r.left ?? null };
  }

  lock() {
    if (!this.vault.exists() || this.uiLocked) return;
    this.uiLocked = true;
    this.emitState();
  }

  async changePassphrase(oldPass, newPass) {
    const r = await this.vault.changePassphrase(oldPass, newPass);
    return r.ok ? { ok: true } : { ok: false, code: r.code, messageKey: r.messageKey, waitMs: r.waitMs || 0, left: r.left ?? null };
  }

  logout() {
    this.engine.pause();
    this.backend.logOff();
    this.backend.cancelQR();
    clearTimeout(this._retryT);
    this.token = null;
    this.firstLogon = true;
    this.account = { name: '' };
    this.vault.saveSecrets({}).catch(() => {});
    this.notice = 'notice.loggedOut';
    this.engine.reset();
    this.startLogin();
  }

  wipeEverything() {
    this.engine.pause();
    this.backend.logOff();
    this.backend.cancelQR();
    clearTimeout(this._retryT);
    this.token = null;
    this.firstLogon = true;
    this.account = { name: '' };
    this.vault.wipe();
    this.store.wipeAll();
    this.engine.reset();
    this.uiLocked = false;
    this._phase = 'login';
    this.notice = 'notice.wiped';
    this.emitState();
  }

  setSettings(patch) {
    const s = this.store.setSettings(patch);
    this.engine.onSettingsChanged();
    this.emitState();
    return s;
  }

  shutdown() {
    clearTimeout(this._retryT);
    try { this.engine.pause(); } catch { /* yok say */ }
    this.prices.stop();
    try { this.backend.logOff(); } catch { /* yok say */ }
    this.store.flush();
    this.vault.forgetKey();
  }
}

module.exports = { Controller };
