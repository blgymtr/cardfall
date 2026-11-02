'use strict';
// Kart düşürme motoru: kuyruk, seçim stratejisi, duraklatma, düşen kart sayımı, istatistik.
//  - "Akıllı" mod (ASF mantığı): 2 saatin altındaki oyunlar birlikte (en çok 32), sonra tek tek.
//  - Elle sabitlenen oyun (pin) varsa yalnızca o çalışır.
//  - Takılan oyun: 2 saati geçmiş bir oyunda ayarlanan süre boyunca kart düşmezse sıranın sonuna alınır.

const { EventEmitter } = require('events');

const MAX_PLAYING = 32;
const HOURS_BEFORE_DROPS = 2;
const TICK_MS = 30_000;
const DAY = 86_400_000;

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

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
    this._emitTimer = null;
    this.reset();
    prices.on('update', () => this.changed());
  }

  reset() {
    clearTimeout(this._refreshTimer);
    clearInterval(this._tickTimer);
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
    this._stuckDirty = false;
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

  _threshold() { return (Number(this.settings.stuckMinutes) || 0) * 60_000; }

  /** Oyun, 2 saati geçtiği halde ayarlanan süredir kart vermiyor mu? */
  isStuck(appid) {
    const thr = this._threshold();
    if (thr <= 0) return false;
    const g = this.games.get(appid);
    const s = this.store.stats.games && this.store.stats.games[appid];
    return !!(g && s && g.hours >= HOURS_BEFORE_DROPS && s.sinceDrop >= thr);
  }

  _accrue() {
    const now = this.now();
    if (this.segStart != null) {
      const d = now - this.segStart;
      if (d > 0) {
        this.activeMs += d;
        this.store.stats.activeMs += d;
        const thr = this._threshold();
        for (const id of this.idling) {
          const g = this.games.get(id);
          const s = this.store.gameStat(id, g && g.name);
          s.idleMs += d;
          if (g && g.hours >= HOURS_BEFORE_DROPS) {
            const was = s.sinceDrop;
            s.sinceDrop += d;
            if (thr > 0 && was < thr && s.sinceDrop >= thr && this.pinned !== id) {
              this._stuckDirty = true;
              this.log('warn', 'log.stuck', { name: g.name, h: Math.round(thr / 360_000) / 10 });
            }
          }
        }
        this.store.statsFile.save();
      }
      this.segStart = this.isActive() ? now : null;
    } else if (this.isActive()) {
      this.segStart = now;
    }
  }

  /** Dakikada birkaç kez: süreleri işler, takılan oyun varsa sırayı yeniden seçer. */
  tick() {
    this._accrue();
    if (this._stuckDirty) { this._stuckDirty = false; this._apply(); }
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
    // takılanlar sona (sıralama bozulmadan)
    return [...list.filter((g) => !this.isStuck(g.appid)), ...list.filter((g) => this.isStuck(g.appid))];
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
      const ok = q.filter((g) => !this.isStuck(g.appid));
      if (ok.length) return [ok[0].appid];
      // hepsi takıldı: sayaçları sıfırla ve yeni bir tur başlat
      for (const g of q) this.store.gameStat(g.appid, g.name).sinceDrop = 0;
      this.log('warn', 'log.stuckReset');
      return [q[0].appid];
    }
    return q.slice(0, Math.min(MAX_PLAYING, Number(mode) || 1)).map((g) => g.appid);
  }

  _apply(force = false) {
    this._accrue();
    const want = this.run === 'running' ? this._pick() : [];
    const changedSet = JSON.stringify(want) !== JSON.stringify(this.idling);
    if (changedSet) {
      for (const id of want) if (!this.idling.includes(id)) this.store.gameStat(id, this.games.get(id)?.name).runs += 1;
    }
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
    clearInterval(this._tickTimer);
    this._tickTimer = setInterval(() => this.tick(), TICK_MS);
    if (this._tickTimer.unref) this._tickTimer.unref();
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
    clearInterval(this._tickTimer);
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
        const s = this.store.gameStat(g.appid, g.name);
        s.cards += n;
        s.sinceDrop = 0;
        s.lastDrop = this.now();
        if (this.store.addHistory) this.store.addHistory({ t: this.now(), appid: g.appid, name: g.name, n, v: p ? p.unit * n : null });
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

  _fmt(v) { return this.prices.template ? this.prices.format(v) : null; }

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
        stuck: this.isStuck(g.appid),
        value: p ? p.unit * g.drops : null,
        valueText: p ? this.prices.format(p.unit * g.drops) : null,
        unitText: p ? this.prices.format(p.unit) : null,
      };
    });
    const queued = rows.filter((r) => !r.black && !r.idle).length;
    const gs = Object.values(this.store.stats.games || {});
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
        grossText: this._fmt(t.gross),
        netText: this.prices.template ? this.prices.format(this.prices.netOf(t.gross)) : null,
        priced: t.priced,
      },
      priceProgress: this.prices.progress(),
      session: {
        activeMs: this.activeMs, runningSince: this.segStart, dropped: this.dropped,
        droppedValueText: this._fmt(this.droppedValue),
        startedAt: this.sessionStart,
      },
      lifetime: {
        activeMs: this.store.stats.activeMs, dropped: this.store.stats.dropped,
        valueText: this._fmt(this.store.stats.value),
        gamesRun: gs.filter((x) => x.idleMs > 0).length,
        gamesDropped: gs.filter((x) => x.cards > 0).length,
        gamesNoDrop: gs.filter((x) => x.idleMs > 0 && x.cards === 0).length,
        stalled: rows.filter((r) => r.stuck && !r.black).length,
      },
      lastRefresh: this.lastRefresh,
      refreshing: this.refreshing,
      error: this.error,
      logs: this.logs.slice(0, 30),
    };
  }

  /** İstatistik penceresi için ayrıntılı özet (istek üzerine hesaplanır). */
  summary() {
    this._accrue();
    const st = this.store.stats;
    const hist = this.store.history || [];
    const now = this.now();
    const thr = this._threshold();
    const games = Object.entries(st.games || {}).map(([id, g]) => ({ appid: Number(id), ...g }));
    const ran = games.filter((g) => g.idleMs > 0);
    const withDrops = games.filter((g) => g.cards > 0);
    const noDrop = ran.filter((g) => g.cards === 0);
    const stalled = thr > 0 ? games.filter((g) => g.sinceDrop >= thr).sort((a, b) => b.sinceDrop - a.sinceDrop) : [];

    const byDay = {};
    for (const h of hist) byDay[dayKey(h.t)] = (byDay[dayKey(h.t)] || 0) + h.n;
    const daily = [];
    for (let i = 13; i >= 0; i--) {
      const t = now - i * DAY;
      daily.push({ day: dayKey(t), t, n: byDay[dayKey(t)] || 0 });
    }
    const today = daily[daily.length - 1].n;
    const week = daily.slice(-7).reduce((a, d) => a + d.n, 0);

    return {
      since: st.since,
      cardsTotal: st.dropped,
      cardsSession: this.dropped,
      valueText: this._fmt(st.value),
      valueSessionText: this._fmt(this.droppedValue),
      activeMs: st.activeMs,
      sessionActiveMs: this.activeMs,
      runningSince: this.segStart,
      gamesRun: ran.length,
      gamesDropped: withDrops.length,
      gamesNoDrop: noDrop.length,
      gamesStalled: stalled.length,
      today,
      week,
      avgMinPerCard: st.dropped > 0 ? st.activeMs / 60_000 / st.dropped : null,
      daily,
      top: withDrops.sort((a, b) => b.cards - a.cards || b.idleMs - a.idleMs).slice(0, 8).map((g) => ({ name: g.name, cards: g.cards, idleMs: g.idleMs })),
      stalled: stalled.slice(0, 8).map((g) => ({ name: g.name, ms: g.sinceDrop })),
      waiting: noDrop.filter((g) => !(thr > 0 && g.sinceDrop >= thr)).length,
      recent: hist.slice(-15).reverse().map((h) => ({ t: h.t, name: h.name, n: h.n })),
    };
  }
}

module.exports = { Engine, MAX_PLAYING };
