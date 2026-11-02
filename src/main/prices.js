'use strict';
// Kart değerleri: Steam Topluluk Pazarı'ndan oyunun (foil olmayan) kartlarının
// en düşük satış fiyatı ortalaması. Her oyun için tek istek; sonuçlar 24 saat saklanır.

const { EventEmitter } = require('events');
const http = require('./http');

const TTL = 24 * 3600 * 1000;
const GAP_MS = 3500;
const FEE = 1.15; // alıcının ödediği fiyat ≈ satıcının eline geçen × 1.15

// ---- para biçimi (Steam yerel para biriminde "₺0,49", "$0.03", "1.234,56 TL"...) ----
const NUM_RE = /\d[\d., \s]*\d|\d/;

function parseMoney(text) {
  const m = NUM_RE.exec(String(text || ''));
  if (!m) return null;
  const raw = m[0].replace(/[ \s]/g, '');
  const lastDot = raw.lastIndexOf('.');
  const lastComma = raw.lastIndexOf(',');
  const sep = Math.max(lastDot, lastComma);
  let value;
  if (sep === -1) value = Number(raw);
  else {
    const frac = raw.length - sep - 1;
    const hasBoth = lastDot !== -1 && lastComma !== -1;
    // "1,234" tek tür ayraç ve 3 hane => binlik; aksi halde ondalık
    if (!hasBoth && frac === 3 && raw.split(raw[sep]).length === 2 && Number(raw[0]) !== 0) value = Number(raw.replace(/[.,]/g, ''));
    else value = Number(raw.slice(0, sep).replace(/[.,]/g, '') + '.' + raw.slice(sep + 1));
  }
  return Number.isFinite(value) ? value : null;
}

/** Bir örnek fiyat metninden ("₺0,49") biçim şablonu çıkarır. */
function makeTemplate(text) {
  const t = String(text || '');
  const m = NUM_RE.exec(t);
  if (!m) return null;
  const raw = m[0];
  const lastDot = raw.lastIndexOf('.');
  const lastComma = raw.lastIndexOf(',');
  const sep = Math.max(lastDot, lastComma);
  let dec = null, decimals = 0;
  if (sep !== -1) {
    const frac = raw.length - sep - 1;
    const bothKinds = lastDot !== -1 && lastComma !== -1;
    if (bothKinds || frac !== 3) { dec = raw[sep]; decimals = frac; }
  }
  return { prefix: t.slice(0, m.index), suffix: t.slice(m.index + raw.length), dec: dec || (raw.includes(',') ? ',' : '.'), decimals: dec ? decimals : 0, hasDecimals: !!dec };
}

function formatMoney(tpl, value) {
  if (!tpl || !Number.isFinite(value)) return '—';
  const decimals = tpl.hasDecimals ? tpl.decimals : 0;
  const [int, frac] = Math.abs(value).toFixed(decimals).split('.');
  const group = tpl.dec === ',' ? '.' : ',';
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${tpl.prefix}${grouped}${frac ? tpl.dec + frac : ''}${tpl.suffix}`;
}

// ---- Pazar yanıtı -----------------------------------------------------------
function averageCardPrice(results) {
  const normal = (results || []).filter((r) => {
    const hash = String(r.hash_name || r.name || '');
    const type = String((r.asset_description && r.asset_description.type) || '');
    return !/foil/i.test(hash) && !/foil/i.test(type) && Number(r.sell_price) > 0;
  });
  if (!normal.length) return null;
  let sum = 0, n = 0, sample = null;
  for (const r of normal) {
    const v = parseMoney(r.sell_price_text);
    if (v === null) continue;
    sum += v; n++;
    if (!sample) sample = r.sell_price_text;
  }
  if (!n) return null;
  return { unit: sum / n, count: n, sample };
}

class PriceService extends EventEmitter {
  /** @param {{store: import('./store').Store, getCookies: () => string|null}} o */
  constructor({ store, getCookies }) {
    super();
    this.store = store;
    this.getCookies = getCookies;
    this.queue = [];
    this.running = false;
    this.stopped = false;
    this.done = 0;
    this.total = 0;
    this.gap = GAP_MS;
    this.cache = store.priceFile.data;
    if (!this.cache.games) this.cache.games = {};
  }

  get template() { return this.cache.template || null; }
  format(value) { return formatMoney(this.template, value); }
  get(appid) {
    const g = this.cache.games[appid];
    return g && g.unit != null ? g : null;
  }
  netOf(gross) { return gross / FEE; }

  ensure(appids) {
    const now = Date.now();
    for (const id of appids) {
      const c = this.cache.games[id];
      if ((c && now - c.t < TTL) || this.queue.includes(id)) continue;
      this.queue.push(id);
      this.total++;
    }
    this._loop();
  }

  progress() { return { done: this.done, total: this.total }; }

  /** Bekleyen fiyat isteklerini bırakır (önbellek temizlenince). */
  clear() { this.queue = []; this.total = 0; this.done = 0; }

  stop() { this.stopped = true; this.queue = []; }

  async _loop() {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      while (this.queue.length && !this.stopped) {
        const id = this.queue.shift();
        let wait = this.gap;
        try {
          await this._fetchOne(id);
          this.done++;
        } catch (e) {
          if (e && e.code === 'RATE_LIMIT') { this.queue.unshift(id); wait = 90_000; }
          else if (e && e.code === 'SESSION_EXPIRED') { this.queue.unshift(id); wait = 60_000; }
          else { this.cache.games[id] = { t: Date.now() - TTL + 30 * 60 * 1000, unit: null, count: 0 }; this.done++; }
        }
        this.emit('update');
        await new Promise((r) => setTimeout(r, wait));
      }
    } finally {
      this.running = false;
      if (!this.queue.length) { this.total = 0; this.done = 0; }
      this.store.priceFile.save();
      this.emit('update');
    }
  }

  async _fetchOne(appid) {
    const results = [];
    let start = 0;
    let total = Infinity;
    for (let page = 0; page < 3 && start < total; page++) {
      const q = new URLSearchParams({
        query: '', start: String(start), count: '100', search_descriptions: '0', sort_column: 'name', sort_dir: 'asc',
        appid: '753', norender: '1',
      });
      q.append('category_753_Game[0]', `tag_app_${appid}`);
      q.append('category_753_item_class[0]', 'tag_item_class_2'); // ticaret kartı
      q.append('category_753_cardborder[0]', 'tag_cardborder_0'); // foil olmayan
      const json = await http.getJson(`https://steamcommunity.com/market/search/render/?${q}`, { cookies: this.getCookies && this.getCookies() });
      if (!json || json.success === false) throw new http.HttpError('MARKET', 'Invalid market response');
      const got = json.results || [];
      results.push(...got);
      total = Number(json.total_count) || 0;
      start += Number(json.pagesize) || got.length || 10;
      if (start < total) await new Promise((r) => setTimeout(r, this.gap));
    }
    const avg = averageCardPrice(results);
    if (avg) {
      if (!this.cache.template) this.cache.template = makeTemplate(avg.sample);
      this.cache.games[appid] = { t: Date.now(), unit: avg.unit, count: avg.count };
    } else {
      this.cache.games[appid] = { t: Date.now(), unit: null, count: 0 };
    }
    this.store.priceFile.save();
  }
}

module.exports = { PriceService, parseMoney, makeTemplate, formatMoney, averageCardPrice, FEE };
