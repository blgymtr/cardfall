'use strict';
// Gizli olmayan yerel veriler (ayarlar, istatistik, fiyat önbelleği). Atomik yazılır.

const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
  theme: 'system',          // system | dark | light
  language: 'auto',         // auto | tr | en | de
  refreshMinutes: 5,
  concurrency: 'smart',     // smart | 1..32
  order: 'drops-desc',      // drops-desc | hours-asc | name | value-desc
  autoStart: true,
  keepAwake: true,
  lockMinutes: 10,          // 0 = hiç otomatik kilitleme yok
  closeToTray: true,
  blacklist: [],
};

const ORDERS = ['drops-desc', 'hours-asc', 'name', 'value-desc'];
const THEMES = ['system', 'dark', 'light'];
const LANGUAGES = ['auto', 'tr', 'en', 'de'];

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
  if (typeof input.autoStart === 'boolean') out.autoStart = input.autoStart;
  if (typeof input.keepAwake === 'boolean') out.keepAwake = input.keepAwake;
  if ('lockMinutes' in input) out.lockMinutes = clampInt(input.lockMinutes, 0, 240, base.lockMinutes);
  if (typeof input.closeToTray === 'boolean') out.closeToTray = input.closeToTray;
  if (Array.isArray(input.blacklist)) {
    out.blacklist = [...new Set(input.blacklist.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 5000);
  }
  return out;
}

class JsonFile {
  constructor(file, fallback) {
    this.file = file;
    this.fallback = fallback;
    this._timer = null;
    this.data = this._read();
  }
  _read() {
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      return typeof this.fallback === 'function' ? this.fallback() : this.fallback;
    }
  }
  save() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 400);
  }
  flush() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 });
      fs.renameSync(tmp, this.file);
    } catch { /* disk yazılamıyorsa sessiz geç, uygulama çalışmaya devam eder */ }
  }
  remove() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    try { fs.rmSync(this.file, { force: true }); } catch { /* yok say */ }
  }
}

class Store {
  constructor(dir) {
    this.dir = dir;
    this.settingsFile = new JsonFile(path.join(dir, 'settings.json'), {});
    this.settings = sanitizeSettings(this.settingsFile.data);
    this.statsFile = new JsonFile(path.join(dir, 'stats.json'), { activeMs: 0, dropped: 0, value: 0 });
    this.stats = this.statsFile.data;
    for (const k of ['activeMs', 'dropped', 'value']) if (!Number.isFinite(this.stats[k])) this.stats[k] = 0;
    this.priceFile = new JsonFile(path.join(dir, 'prices.json'), { template: null, games: {} });
  }
  setSettings(patch) {
    this.settings = sanitizeSettings(patch, this.settings);
    this.settingsFile.data = this.settings;
    this.settingsFile.save();
    return this.settings;
  }
  flush() {
    this.settingsFile.flush();
    this.statsFile.flush();
    this.priceFile.flush();
  }
  wipeAll() {
    for (const f of [this.settingsFile, this.statsFile, this.priceFile]) f.remove();
    this.settings = { ...DEFAULT_SETTINGS };
    this.stats.activeMs = 0; this.stats.dropped = 0; this.stats.value = 0;
    this.priceFile.data = { template: null, games: {} };
  }
}

module.exports = { Store, JsonFile, sanitizeSettings, DEFAULT_SETTINGS };
