'use strict';
// Yerel veriler: ayarlar, istatistik, geçmiş (Windows DPAPI ile şifreli) ve fiyat önbelleği (herkese açık veri).
// Dosyalar atomik yazılır; eski düz metin dosyalar ilk okumada kabul edilip bir sonraki kayıtta şifrelenir.

const fs = require('fs');
const path = require('path');
const { shredFile, shredDir, sizeOf } = require('./shred');

const DEFAULT_SETTINGS = {
  theme: 'system',          // system | dark | light
  language: 'auto',         // auto | tr | en | de
  refreshMinutes: 5,
  concurrency: 'smart',     // smart | 1..32
  order: 'drops-desc',      // drops-desc | hours-asc | name | value-desc
  autoStart: true,
  keepAwake: true,
  lockMinutes: 5,           // 0 = hiç otomatik kilitleme yok
  lockOnMinimize: false,    // pencere küçülünce kilitle
  closeToTray: true,
  launchAtLogin: false,     // Windows ile gizli başlat (parola bekler)
  hideFromCapture: false,   // ekran görüntüsü / paylaşımında pencereyi gizle
  stuckMinutes: 180,        // 2 saati geçmiş oyunda bu süre kart düşmezse sıranın sonuna al (0 = kapalı)
  blacklist: [],
};

const ORDERS = ['drops-desc', 'hours-asc', 'name', 'value-desc'];
const THEMES = ['system', 'dark', 'light'];
const LANGUAGES = ['auto', 'tr', 'en', 'de', 'it', 'fr', 'es'];
const HISTORY_MAX = 5000;
const GAMES_MAX = 4000;

function clampInt(v, lo, hi, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

function sanitizeSettings(input, base = DEFAULT_SETTINGS) {
  const out = { ...base };
  if (!input || typeof input !== 'object') return out;
  if (THEMES.includes(input.theme)) out.theme = input.theme;
  if (LANGUAGES.includes(input.language)) out.language = input.language;
  if ('refreshMinutes' in input) out.refreshMinutes = clampInt(input.refreshMinutes, 2, 60, base.refreshMinutes);
  if ('concurrency' in input) {
    out.concurrency = input.concurrency === 'smart' ? 'smart' : String(clampInt(input.concurrency, 1, 32, 1));
  }
  if (ORDERS.includes(input.order)) out.order = input.order;
  for (const k of ['autoStart', 'keepAwake', 'lockOnMinimize', 'closeToTray', 'launchAtLogin', 'hideFromCapture']) {
    if (typeof input[k] === 'boolean') out[k] = input[k];
  }
  if ('lockMinutes' in input) out.lockMinutes = clampInt(input.lockMinutes, 0, 240, base.lockMinutes);
  if ('stuckMinutes' in input) out.stuckMinutes = clampInt(input.stuckMinutes, 0, 1440, base.stuckMinutes);
  if (Array.isArray(input.blacklist)) {
    out.blacklist = [...new Set(input.blacklist.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 5000);
  }
  return out;
}

class JsonFile {
  /** @param {{isAvailable(): boolean, encrypt(s: string): Buffer, decrypt(b: Buffer): string}|null} seal */
  constructor(file, fallback, seal = null) {
    this.file = file;
    this.fallback = fallback;
    this.seal = seal;
    this._timer = null;
    this.data = this._read();
  }
  _fresh() { return typeof this.fallback === 'function' ? this.fallback() : JSON.parse(JSON.stringify(this.fallback)); }
  _read() {
    try {
      const j = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (j && typeof j === 'object' && typeof j.__sealed === 'string') {
        if (!this.seal || !this.seal.isAvailable()) return this._fresh();
        return JSON.parse(this.seal.decrypt(Buffer.from(j.__sealed, 'base64')));
      }
      return j;
    } catch {
      return this._fresh();
    }
  }
  /** Bekleyen bir yazma varsa yenisini kuyruğa almaz (sürekli çağrılsa bile açlık yaşanmaz). */
  save() {
    if (this._timer) return;
    this._timer = setTimeout(() => this.flush(), 1500);
    if (this._timer.unref) this._timer.unref();
  }
  flush() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const text = JSON.stringify(this.data);
      const out = this.seal && this.seal.isAvailable()
        ? JSON.stringify({ __sealed: this.seal.encrypt(text).toString('base64') })
        : text;
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, out, { mode: 0o600 });
      fs.renameSync(tmp, this.file);
    } catch { /* disk yazılamıyorsa sessiz geç, uygulama çalışmaya devam eder */ }
  }
  remove() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    shredFile(this.file);
    shredFile(this.file + '.tmp');
  }
}

const freshStats = () => ({ activeMs: 0, dropped: 0, value: 0, since: Date.now(), games: {} });

class Store {
  /** @param {string} dir @param {object|null} seal DPAPI sarmalayıcısı */
  constructor(dir, seal = null) {
    this.dir = dir;
    this.settingsFile = new JsonFile(path.join(dir, 'settings.json'), {}, seal);
    this.settings = sanitizeSettings(this.settingsFile.data);
    this.settingsFile.data = this.settings;
    this.statsFile = new JsonFile(path.join(dir, 'stats.json'), freshStats, seal);
    this.stats = this.statsFile.data;
    for (const k of ['activeMs', 'dropped', 'value']) if (!Number.isFinite(this.stats[k])) this.stats[k] = 0;
    if (!Number.isFinite(this.stats.since)) this.stats.since = Date.now();
    if (!this.stats.games || typeof this.stats.games !== 'object') this.stats.games = {};
    this.historyFile = new JsonFile(path.join(dir, 'history.json'), [], seal);
    if (!Array.isArray(this.historyFile.data)) this.historyFile.data = [];
    this.history = this.historyFile.data;
    this.priceFile = new JsonFile(path.join(dir, 'prices.json'), { template: null, games: {} });
    this.infoFile = new JsonFile(path.join(dir, 'appinfo.json'), {});
    this.cacheDir = path.join(dir, 'imgcache');
    // eski düz metin dosyaları ilk fırsatta şifreli biçime çevir
    if (seal && seal.isAvailable()) { this.settingsFile.save(); this.statsFile.save(); }
  }

  setSettings(patch) {
    this.settings = sanitizeSettings(patch, this.settings);
    this.settingsFile.data = this.settings;
    this.settingsFile.save();
    return this.settings;
  }

  addHistory(entry) {
    this.history.push(entry);
    if (this.history.length > HISTORY_MAX) this.history.splice(0, this.history.length - HISTORY_MAX);
    this.historyFile.save();
  }

  /** Oyun başına kalıcı istatistik kaydı. */
  gameStat(appid, name) {
    const games = this.stats.games;
    let g = games[appid];
    if (!g) {
      if (Object.keys(games).length >= GAMES_MAX) return { name: name || '', cards: 0, idleMs: 0, sinceDrop: 0, lastDrop: 0, runs: 0 };
      g = games[appid] = { name: name || '', cards: 0, idleMs: 0, sinceDrop: 0, lastDrop: 0, runs: 0 };
    }
    if (name && g.name !== name) g.name = name;
    return g;
  }

  flush() {
    this.settingsFile.flush();
    this.statsFile.flush();
    this.historyFile.flush();
    this.priceFile.flush();
    this.infoFile.flush();
  }

  resetStats() {
    const fresh = freshStats();
    for (const k of Object.keys(this.stats)) delete this.stats[k];
    Object.assign(this.stats, fresh);
    this.history.length = 0;
    this.statsFile.save();
    this.historyFile.save();
  }

  // ---- temizlik ve kalıcı silme ------------------------------------------------------
  /** Düşen kart geçmişini siler (toplam sayaçlar kalır). */
  clearHistory() {
    this.history.length = 0;
    this.historyFile.flush();
  }

  /** Oyun görselleri, mağaza bilgisi ve fiyat önbelleğini kalıcı siler. Silinen bayt sayısını döner. */
  clearCache() {
    let bytes = shredDir(this.cacheDir);
    const p = this.priceFile.data;
    p.template = null;
    p.games = {};
    bytes += sizeOf(this.priceFile.file);
    this.priceFile.remove();
    for (const k of Object.keys(this.infoFile.data)) delete this.infoFile.data[k];
    bytes += sizeOf(this.infoFile.file);
    this.infoFile.remove();
    return bytes;
  }

  /** Hesaba bağlı her şeyi siler: istatistik, geçmiş, önbellek, gizlenen oyunlar. Parola ve ayarlar kalır. */
  accountWipe() {
    this.resetStats();
    this.statsFile.flush();
    this.historyFile.flush();
    this.clearCache();
    this.setSettings({ blacklist: [] });
    this.settingsFile.flush();
  }

  /** Yerel verinin dökümü (ayarlar ekranı için). */
  dataInfo() {
    const f = (name, p) => ({ name, bytes: sizeOf(p) });
    const files = [
      f('vault', path.join(this.dir, 'vault.bin')),
      f('settings', this.settingsFile.file),
      f('stats', this.statsFile.file),
      f('history', this.historyFile.file),
      f('cache', this.cacheDir),
      f('prices', this.priceFile.file),
      f('info', this.infoFile.file),
    ];
    return { dir: this.dir, files, total: files.reduce((a2, x) => a2 + x.bytes, 0), cache: files.filter((x) => ['cache', 'prices', 'info'].includes(x.name)).reduce((a2, x) => a2 + x.bytes, 0) };
  }

  /** Her şeyi kalıcı siler (kasa dahil değil; kasayı Vault.wipe siler). */
  wipeAll() {
    for (const f of [this.settingsFile, this.statsFile, this.historyFile, this.priceFile, this.infoFile]) f.remove();
    shredDir(this.cacheDir);
    this.settings = { ...DEFAULT_SETTINGS };
    this.settingsFile.data = this.settings;
    const fresh = freshStats();
    for (const k of Object.keys(this.stats)) delete this.stats[k];
    Object.assign(this.stats, fresh);
    this.history.length = 0;
    this.priceFile.data.template = null;
    this.priceFile.data.games = {};
    for (const k of Object.keys(this.infoFile.data)) delete this.infoFile.data[k];
  }
}

module.exports = { Store, JsonFile, sanitizeSettings, DEFAULT_SETTINGS, HISTORY_MAX };
