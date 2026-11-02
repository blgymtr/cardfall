'use strict';
// Kart düşürme motoru: kuyruk, seçim stratejisi, duraklatma, düşen kart sayımı.
//  - "Akıllı" mod (ASF mantığı): 2 saatin altındaki oyunlar birlikte (en çok 32), sonra tek tek.
//  - Elle sabitlenen oyun (pin) varsa yalnızca o çalışır.

const { EventEmitter } = require('events');

const MAX_PLAYING = 32;
const HOURS_BEFORE_DROPS = 2;

class Engine extends EventEmitter {
  /**
   * @param {{backend: any, prices: any, store: import('./store').Store, now?: () => number}} o
   */
  constructor({ backend, prices, store, now = Date.now }) {
    super();
    this.backend = backend;
    this.prices = prices;
    this.store = store;
    this.now = now;
    this.reset();
    this._emitTimer = null;
    prices.on('update', () => this.changed());
  }

  reset() {
    clearTimeout(this._refreshTimer);
    this.run = 'stopped';          // stopped | running | paused
    this.games = new Map();
    this.pinned = null;
    this.idling = [];
    this.applied = null;
    this.activeMs = 0;
    this.segStart = null;
    this.dropped = 0;
    this.droppedValue = 0;
    this.completed = 0;
    this.lastRefresh = null;
    this.refreshing = false;
    this.error = null;
    this.logs = [];
    this.sessionStart = this.now();
  }

  // ---- durum ------------------------------------------------------------------
  get settings() { return this.store.settings; }
  get blocked() { return !!this.backend.blocked; }
  isActive() { return this.run === 'running' && !this.blocked && this.idling.length > 0; }

  log(kind, key, params = {}) {
    this.logs.unshift({ t: this.now(), kind, key, params });
    if (this.logs.length > 60) this.logs.length = 60;
  }

  changed() {
    if (this._emitTimer) return;
    this._emitTimer = setTimeout(() => { this._emitTimer = null; this.emit('change'); }, 150);
  }

  _accrue() {
    if (this.segStart != null) {
      const d = this.now() - this.segStart;
      this.activeMs += d;
      this.store.stats.activeMs += d;
      this.segStart = this.isActive() ? this.now() : null;
    } else if (this.isActive()) {
      this.segStart = this.now();
    }
  }

  // ---- kuyruk ------------------------------------------------------------------
  _queue() {
    const black = new Set(this.settings.blacklist);
    const list = [...this.games.values()].filter((g) => g.drops > 0 && !black.has(g.appid));
    const order = this.settings.order;
    const val = (g) => { const p = this.prices.get(g.appid); return p ? p.unit * g.drops : -1; };
    list.sort((a, b) => {
      if (order === 'hours-asc') return a.hours - b.hours || b.drops - a.drops;
      if (order === 'name') return a.name.localeCompare(b.name, 'tr');
      if (order === 'value-desc') return val(b) - val(a) || b.drops - a.drops;
      return b.drops - a.drops || a.hours - b.hours;
    });
    return list;
  }

  _pick() {
    const q = this._queue();
    if (!q.length) return [];
    if (this.pinned != null) {
      const p = q.find((g) => g.appid === this.pinned);
      if (p) return [p.appid];
      this.pinned = null;
    }
    const mode = this.settings.concurrency;
    if (mode === 'smart') {
      const fresh = q.filter((g) => g.hours < HOURS_BEFORE_DROPS);
      if (fresh.length) return fresh.slice(0, MAX_PLAYING).map((g) => g.appid);
      return [q[0].appid];
    }
    return q.slice(0, Math.min(MAX_PLAYING, Number(mode) || 1)).map((g) => g.appid);
  }

  _apply(force = false) {
    this._accrue();
    const want = this.run === 'running' ? this._pick() : [];
    const changedSet = JSON.stringify(want) !== JSON.stringify(this.idling);
    this.idling = want;
    if (force || changedSet || this.applied !== JSON.stringify(want)) {
      this.applied = JSON.stringify(want);
      this.backend.setGames(want);
      if (changedSet && want.length) {
        const names = want.slice(0, 2).map((id) => this.games.get(id)?.name).filter(Boolean).join(', ');
        this.log('play', want.length > 2 ? 'log.playMore' : 'log.play', { names, n: want.length - 2 });
      }
    }
    this._accrue();
    this.changed();
  }

  // ---- komutlar -----------------------------------------------------------------
  async start() {
    if (this.run === 'running') return;
    this.run = 'running';
    this.log('info', 'log.started');
    if (!this.games.size) await this.refresh();
    this._apply(true);
    this._schedule();
  }

  pause() {
    if (this.run !== 'running') return;
    this._accrue();
    this.run = 'paused';
    this.segStart = null;
    this.backend.setGames([]);
    this.idling = [];
    this.applied = '[]';
    clearTimeout(this._refreshTimer);
    this.store.statsFile.save();
    this.log('info', 'log.paused');
    this.changed();
  }

  async resume() {
    if (this.run === 'running') return;
    await this.start();
  }

  async toggle() { return this.run === 'running' ? this.pause() : this.start(); }

  pin(appid) {
    const g = this.games.get(Number(appid));
    if (!g || g.drops <= 0) return;
    this.pinned = g.appid;
    this.log('info', 'log.pinned', { name: g.name });
    if (this.run !== 'running') { this.start(); return; }
    this._apply();
  }

  unpin() {
    if (this.pinned == null) return;
    this.pinned = null;
    this.log('info', 'log.unpinned');
    this._apply();
  }

  /** Sıradaki oyuna geç. */
  next() {
    const q = this._queue();
    if (q.length < 2) return;
    const cur = this.pinned != null ? this.pinned : (this.idling[0] ?? q[0].appid);
    const i = q.findIndex((g) => g.appid === cur);
    this.pin(q[(i + 1) % q.length].appid);
  }

  setBlacklisted(appid, on) {
    const id = Number(appid);
    const set = new Set(this.settings.blacklist);
    on ? set.add(id) : set.delete(id);
    this.store.setSettings({ blacklist: [...set] });
    if (on && this.pinned === id) this.pinned = null;
    this._apply();
  }

  /** Steam yeniden bağlandı ya da başka oturum durumu değişti. */
  onBackendChanged() {
    this._accrue();
    this._apply(true);
  }

  onSettingsChanged() {
    this._schedule();
    this._apply();
  }

  // ---- yenileme -------------------------------------------------------------------
  _schedule() {
    clearTimeout(this._refreshTimer);
    if (this.run !== 'running') return;
    this._refreshTimer = setTimeout(async () => {
      await this.refresh();
      this._schedule();
    }, this.settings.refreshMinutes * 60 * 1000);
  }

  async refresh() {
    if (this.refreshing) return;
    this.refreshing = true;
    this.error = null;
    this.changed();
    try {
      const list = await this.backend.fetchGames();
      this._merge(list);
      this.lastRefresh = this.now();
      this.log('info', 'log.refreshed', { n: this.totals().drops });
      const ids = this._queue().map((g) => g.appid);
      this.prices.ensure(ids);
    } catch (e) {
      this.error = e && e.message ? String(e.message) : 'Refresh failed';
      this.log('error', 'log.refreshFailed', { reason: this.error });
    } finally {
      this.refreshing = false;
      this._apply();
    }
  }

  _merge(list) {
    const first = this.games.size === 0;
    const seen = new Set();
    for (const g of list) {
      seen.add(g.appid);
      const prev = this.games.get(g.appid);
      if (prev && g.drops < prev.drops) {
        const n = prev.drops - g.drops;
        const p = this.prices.get(g.appid);
        this.dropped += n;
        this.store.stats.dropped += n;
        if (p) { this.droppedValue += p.unit * n; this.store.stats.value += p.unit * n; }
        this.log('drop', g.drops === 0 ? 'log.dropDone' : 'log.drop', { name: g.name, n });
        this.emit('drop', { name: g.name, n });
        this.store.statsFile.save();
      }
      this.games.set(g.appid, { appid: g.appid, name: g.name, drops: g.drops, hours: g.hours });
    }
    for (const id of [...this.games.keys()]) if (!seen.has(id)) this.games.delete(id);
    this.completed = [...this.games.values()].filter((g) => g.drops === 0).length;
    if (first && this.games.size) this.log('info', 'log.queued', { n: this._queue().length });
  }

  // ---- görünüm ------------------------------------------------------------------------
  totals() {
    let drops = 0, games = 0, gross = 0, priced = 0;
    for (const g of this._queue()) {
      drops += g.drops; games++;
      const p = this.prices.get(g.appid);
      if (p) { gross += p.unit * g.drops; priced++; }
    }
    return { drops, games, gross, priced };
  }

  snapshot() {
    this._accrue();
    const t = this.totals();
    const black = new Set(this.settings.blacklist);
    const idleSet = new Set(this.idling);
    const rows = [...this.games.values()].filter((g) => g.drops > 0).map((g) => {
      const p = this.prices.get(g.appid);
      return {
        appid: g.appid, name: g.name, drops: g.drops, hours: Math.round(g.hours * 10) / 10,
        idle: idleSet.has(g.appid), black: black.has(g.appid), pinned: this.pinned === g.appid,
        value: p ? p.unit * g.drops : null,
        valueText: p ? this.prices.format(p.unit * g.drops) : null,
        unitText: p ? this.prices.format(p.unit) : null,
      };
    });
    const queued = rows.filter((r) => !r.black && !r.idle).length;
    return {
      run: this.run,
      blocked: this.blocked,
      active: this.isActive(),
      finished: this.run === 'running' && this.games.size > 0 && t.games === 0,
      pinned: this.pinned,
      idling: this.idling.slice(),
      games: rows,
      totals: {
        drops: t.drops, games: t.games, queued, idling: this.idling.length, completed: this.completed,
        grossText: this.prices.template ? this.prices.format(t.gross) : null,
        netText: this.prices.template ? this.prices.format(this.prices.netOf(t.gross)) : null,
        priced: t.priced,
      },
      priceProgress: this.prices.progress(),
      session: {
        activeMs: this.activeMs, runningSince: this.segStart, dropped: this.dropped,
        droppedValueText: this.prices.template ? this.prices.format(this.droppedValue) : null,
        startedAt: this.sessionStart,
      },
      lifetime: { activeMs: this.store.stats.activeMs, dropped: this.store.stats.dropped,
        valueText: this.prices.template ? this.prices.format(this.store.stats.value) : null },
      lastRefresh: this.lastRefresh,
      refreshing: this.refreshing,
      error: this.error,
      logs: this.logs.slice(0, 30),
    };
  }
}

module.exports = { Engine, MAX_PLAYING };
