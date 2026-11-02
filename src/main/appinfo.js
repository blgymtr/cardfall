'use strict';
// Oyun bilgisi: Steam mağaza API'sinden ad, kısa açıklama, tür, geliştirici, çıkış tarihi ve görsel adresi.
// Sonuçlar 7 gün saklanır, süresi dolunca istek üzerine arka planda yenilenir. İstekler tek tek ve yavaş gider.

const http = require('./http');

const TTL = 7 * 24 * 3600 * 1000;
const MISSING_TTL = 24 * 3600 * 1000;
const GAP_MS = 1300;
const STORE_LANG = { tr: 'turkish', en: 'english', de: 'german', it: 'italian', fr: 'french', es: 'spanish' };

const ENTITIES = { '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };
function plain(s, max) {
  const t = String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:quot|amp|lt|gt|#39|apos|nbsp);/g, (m) => ENTITIES[m])
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class AppInfo {
  /** @param {{store: import('./store').Store, offline?: boolean}} o */
  constructor({ store, offline = false }) {
    this.store = store;
    this.offline = offline;
    this.chain = Promise.resolve();
    this.pending = new Map();
    this.gap = GAP_MS;
  }

  get cache() { return this.store.infoFile.data; }
  peek(appid) { return this.cache[appid] || null; }

  _fresh(hit, lang) {
    if (!hit) return false;
    if (hit.missing) return Date.now() - hit.t < MISSING_TTL;
    return Date.now() - hit.t < TTL && hit.desc && hit.desc[lang] !== undefined;
  }

  /** Bilgiyi önbellekten verir; eskiyse (ya da dil yoksa) mağazadan alır. */
  load(appid, lang = 'en') {
    const id = Number(appid);
    if (!Number.isInteger(id) || id <= 0) return Promise.resolve(null);
    const hit = this.cache[id];
    if (this._fresh(hit, lang) || this.offline) return Promise.resolve(hit || null);
    const key = `${id}:${lang}`;
    if (this.pending.has(key)) return this.pending.get(key);
    const run = this.chain.then(() => this._fetch(id, lang));
    this.chain = run.catch(() => {}).then(() => sleep(this.gap));
    const p = run.catch(() => hit || null).finally(() => this.pending.delete(key));
    this.pending.set(key, p);
    return p;
  }

  /** Görsel yedeği: mağazanın bildirdiği başlık görseli adresi. */
  async headerUrl(appid) {
    const info = await this.load(appid, 'en');
    return info && info.header ? info.header : null;
  }

  async _fetch(id, lang) {
    const l = STORE_LANG[lang] || 'english';
    const json = await http.getJson(`https://store.steampowered.com/api/appdetails?appids=${id}&l=${l}&filters=basic,genres,release_date,developers`, { timeoutMs: 15000, maxBytes: 2 * 1024 * 1024 });
    const entry = json && json[id];
    const prev = this.cache[id] || {};
    if (!entry || entry.success !== true || !entry.data) {
      this.cache[id] = { t: Date.now(), missing: true, desc: prev.desc || {} };
      this.store.infoFile.save();
      return this.cache[id];
    }
    const d = entry.data;
    const header = typeof d.header_image === 'string' && http.isAllowedUrl(d.header_image, http.IMAGE_HOSTS) ? d.header_image : (prev.header || null);
    this.cache[id] = {
      t: Date.now(),
      name: plain(d.name, 120),
      header,
      desc: { ...(prev.missing ? {} : prev.desc), [lang]: plain(d.short_description, 420) },
      genres: Array.isArray(d.genres) ? d.genres.map((g) => plain(g.description, 40)).filter(Boolean).slice(0, 6) : [],
      devs: Array.isArray(d.developers) ? d.developers.map((x) => plain(x, 60)).filter(Boolean).slice(0, 3) : [],
      release: d.release_date && d.release_date.date ? plain(d.release_date.date, 40) : '',
    };
    this.store.infoFile.save();
    return this.cache[id];
  }
}

module.exports = { AppInfo, plain, STORE_LANG };
