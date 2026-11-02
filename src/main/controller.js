'use strict';
// Uygulama mantığı: kasa + Steam oturumu + motor. Electron'a bağımlı değil (test edilebilir).

const path = require('path');
const { EventEmitter } = require('events');
const QRCode = require('qrcode');
const { Store } = require('./store');
const { Vault, checkPassphrase } = require('./vault');
const { Engine } = require('./engine');
const { PriceService } = require('./prices');
const { AppInfo } = require('./appinfo');
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
    this.startedAt = Date.now();
    this.store = new Store(dir, safe);
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
    this.appinfo = new AppInfo({ store: this.store, offline: demo });
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
    this.signedInAt = null;
    this.connectedAt = null;
    this._pendingSecrets = null;  // kasa kilitliyken gelen yeni anahtar; kilit açılınca yazılır

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
      appStartedAt: this.startedAt,
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
      await this._persist({ refreshToken, accountName: accountName || '' });
      this._connect();
    });
    b.on('account', (name) => { if (name) { this.account = { name }; this.emitState(); } });
    b.on('refreshToken', async (t) => {
      this.token = t;
      await this._persist({ refreshToken: t, accountName: this.account.name });
    });
    b.on('loggedOn', () => {
      this.net = 'online';
      this.connectedAt = Date.now();
      if (!this.signedInAt) this.signedInAt = this.connectedAt;
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
        await this._persist({});
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

  /** Kasa açıksa hemen yazar; kilitliyse (anahtar bellekte yok) kilit açılınca yazmak üzere bekletir. */
  async _persist(secrets) {
    if (!this.vault.exists()) return;
    if (!this.vault.hasKey()) { this._pendingSecrets = secrets; return; }
    try { await this.vault.saveSecrets(secrets); } catch { /* kasa yazılamazsa oturum yine de çalışır */ }
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
    // Kilitliyken şifreleme anahtarı bellekten silinir; her kilit açışta parola yeniden türetilir.
    const r = await this.vault.unlock(pass);
    if (r.ok) {
      this.uiLocked = false;
      this.notice = null;
      const pending = this._pendingSecrets;
      this._pendingSecrets = null;
      if (pending) {
        try { await this.vault.saveSecrets(pending); } catch { /* yok say */ }
      }
      const live = (this._phase === 'ready' || this._phase === 'connecting') && this.token;
      if (!live) {
        const secrets = pending || r.secrets;
        this.token = secrets.refreshToken || null;
        if (secrets.accountName) this.account = { name: secrets.accountName };
        if (this.token) this._connect(); else this.startLogin();
      } else {
        this.emitState();
      }
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
    this.vault.forgetKey();
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
    this.signedInAt = null;
    this.connectedAt = null;
    this.account = { name: '' };
    this._persist({});
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
    this.signedInAt = null;
    this.connectedAt = null;
    this.engine.reset();
    this.uiLocked = false;
    this._phase = 'login';
    this.notice = 'notice.wiped';
    this.emitState();
  }

  // ---- veri ve gizlilik ---------------------------------------------------------------
  clearLog() { this.engine.logs = []; this.emitState(); }

  clearHistory() { this.store.clearHistory(); this.emitState(); }

  clearCache() {
    this.prices.clear();
    const bytes = this.store.clearCache();
    this.emitState();
    return bytes;
  }

  dataInfo() { return this.store.dataInfo(); }

  /** Oturumu kapatır ve hesaba bağlı tüm yerel veriyi kalıcı siler (parola ve ayarlar kalır). */
  logoutFull() {
    this.logout();
    this.prices.clear();
    this.store.accountWipe();
    this.engine.dropped = 0;
    this.engine.droppedValue = 0;
    this.notice = 'notice.loggedOutFull';
    this.emitState();
  }

  /** Güncel oturumun gizli olmayan özeti. */
  sessionInfo() {
    const e = this.engine;
    const id = this.backend.steamid ? String(this.backend.steamid) : '';
    const s = this.store.settings;
    return {
      account: this.account.name || '',
      steamid: id.length > 8 ? id.slice(0, 4) + '…' + id.slice(-4) : id,
      net: this.net,
      phase: this._phase,
      signedInAt: this.signedInAt,
      connectedAt: this.connectedAt,
      appStartedAt: this.startedAt,
      run: e.run,
      blocked: !!this.backend.blocked,
      idling: e.idling.length,
      activeMs: e.activeMs + (e.segStart ? Date.now() - e.segStart : 0),
      tokenStored: !!this.token && this.vault.exists(),
      kdf: this.vault.kdfInfo(),
      failedAttempts: this.vault.lockStatus().fails,
      lockMinutes: s.lockMinutes,
      lockOnMinimize: s.lockOnMinimize,
      hideFromCapture: s.hideFromCapture,
      launchAtLogin: s.launchAtLogin,
      dataDir: this.dir,
      demo: this.demo,
    };
  }

  /** Oyun bilgisi (mağaza): ad, açıklama, tür, geliştirici, çıkış tarihi. */
  async gameInfo(appid) {
    const info = await this.appinfo.load(appid, this.lang());
    if (!info || info.missing) return null;
    return { name: info.name, desc: (info.desc && info.desc[this.lang()]) || '', genres: info.genres || [], devs: info.devs || [], release: info.release || '' };
  }

  /** Ayrıntılı istatistikler (istatistik penceresi için). */
  statistics() { return this.engine.summary(); }

  resetStatistics() {
    this.store.resetStats();
    this.engine.dropped = 0;
    this.engine.droppedValue = 0;
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
