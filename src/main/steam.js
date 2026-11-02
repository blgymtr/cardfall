'use strict';
// Gerçek Steam bağlantısı. Parola hiç sorulmaz: giriş, telefondaki Steam uygulamasıyla
// QR kod okutularak yapılır. Elde edilen yenileme anahtarı yalnızca kasaya yazılır.

const { EventEmitter } = require('events');
const SteamUser = require('steam-user');
const { LoginSession, EAuthTokenPlatformType } = require('steam-session');
const { fetchAllBadges } = require('./badges');
const http = require('./http');

const TOKEN_DEAD = new Set([5, 15, 26, 27, 63, 65, 66, 84]); // InvalidPassword, AccessDenied, Revoked, Expired, ...
const WEB_TTL = 6 * 3600 * 1000;

class SteamBackend extends EventEmitter {
  constructor() {
    super();
    this.demo = false;
    this.client = null;
    this.qr = null;
    this.cookieHeader = null;
    this.cookieAt = 0;
    this.steamid = null;
    this.accountName = '';
    this.blocked = false;
    this.loggedOn = false;
  }

  // ---- QR ile giriş ---------------------------------------------------------
  async startQR() {
    this.cancelQR();
    const session = new LoginSession(EAuthTokenPlatformType.SteamClient);
    session.loginTimeout = 120000;
    this.qr = session;
    session.on('remoteInteraction', () => { if (this.qr === session) this.emit('qrScanned'); });
    session.on('authenticated', () => {
      if (this.qr !== session) return;
      this.qr = null;
      this.emit('qrDone', { refreshToken: session.refreshToken, accountName: session.accountName });
    });
    session.on('timeout', () => { if (this.qr === session) { this.qr = null; this.emit('qrFail', 'timeout'); } });
    session.on('error', (err) => { if (this.qr === session) { this.qr = null; this.emit('qrFail', (err && err.message) || 'error'); } });
    try {
      const r = await session.startWithQR();
      if (this.qr === session) this.emit('qr', r.qrChallengeUrl);
    } catch (e) {
      if (this.qr === session) { this.qr = null; this.emit('qrFail', (e && e.message) || 'error'); }
    }
  }

  cancelQR() {
    const s = this.qr;
    this.qr = null;
    if (s) { try { s.cancelLoginAttempt(); } catch { /* yok say */ } }
  }

  // ---- Steam ağı -----------------------------------------------------------
  logOn(refreshToken) {
    this.logOff();
    const client = new SteamUser({ autoRelogin: true, dataDirectory: null, renewRefreshTokens: true });
    this.client = client;
    client.on('loggedOn', () => {
      this.loggedOn = true;
      this.steamid = client.steamID.getSteamID64();
      this.emit('loggedOn');
      // webSession genelde kendiliğinden gelir; gelmezse isteriz
      setTimeout(() => { if (this.client === client && !this.cookieHeader) { try { client.webLogOn(); } catch { /* yok say */ } } }, 8000);
    });
    client.on('accountInfo', (name) => { this.accountName = name || this.accountName; this.emit('account', this.accountName); });
    client.on('webSession', (_id, cookies) => {
      const parts = (cookies || []).map((c) => String(c).split(';')[0]).filter(Boolean);
      parts.push('Steam_Language=english');
      this.cookieHeader = parts.join('; ');
      this.cookieAt = Date.now();
      this.emit('web');
    });
    client.on('refreshToken', (t) => this.emit('refreshToken', t));
    client.on('playingState', (blocked) => {
      this.blocked = !!blocked;
      this.emit('blocked', this.blocked);
    });
    client.on('disconnected', () => { this.loggedOn = false; this.emit('disconnected'); });
    client.on('error', (err) => {
      this.loggedOn = false;
      const code = err && err.eresult;
      const dead = TOKEN_DEAD.has(code) || /refresh token|token.*(invalid|expired)/i.test((err && err.message) || '');
      this.emit('failed', { tokenDead: dead, message: (err && err.message) || 'Bağlantı hatası', eresult: code });
    });
    client.logOn({ refreshToken });
  }

  logOff() {
    const c = this.client;
    this.client = null;
    this.loggedOn = false;
    this.cookieHeader = null;
    this.blocked = false;
    if (c) {
      c.removeAllListeners();
      c.on('error', () => {});
      try { c.gamesPlayed([]); c.logOff(); } catch { /* yok say */ }
    }
  }

  setGames(appids) {
    if (!this.client || !this.loggedOn) return;
    try { this.client.gamesPlayed(appids.map(Number)); } catch { /* yok say */ }
  }

  // ---- Web oturumu ve rozetler -----------------------------------------------
  getCookies() { return this.cookieHeader; }

  _ensureWeb(force) {
    if (!force && this.cookieHeader && Date.now() - this.cookieAt < WEB_TTL) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (!this.client || !this.loggedOn) return reject(new http.HttpError('OFFLINE', 'Steam bağlantısı yok'));
      const t = setTimeout(() => { this.off('web', ok); reject(new http.HttpError('WEB', 'Web oturumu alınamadı')); }, 25000);
      const ok = () => { clearTimeout(t); resolve(); };
      this.once('web', ok);
      try { this.client.webLogOn(); } catch (e) { clearTimeout(t); this.off('web', ok); reject(e); }
    });
  }

  async fetchGames() {
    await this._ensureWeb(false);
    const run = () => fetchAllBadges({ steamid: this.steamid, cookies: this.cookieHeader });
    try {
      return await run();
    } catch (e) {
      if (e && ['SESSION_EXPIRED', 'EMPTY', 'FORBIDDEN'].includes(e.code)) {
        await this._ensureWeb(true);
        return run();
      }
      throw e;
    }
  }
}

module.exports = { SteamBackend };
