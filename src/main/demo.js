'use strict';
// Yalnızca geliştirme/test için (paketli sürümde kapalı): Steam'e hiç bağlanmayan sahte arka uç.

const { EventEmitter } = require('events');
const { PriceService } = require('./prices');

const NAMES = [
  'Hollow Lantern', 'Star Harbor', 'Paper Knights', 'Cinder & Tide', 'Neon Orchard', 'Gravity Gardener', 'Mossbound',
  'Last Train to Ember', 'Quiet Signal', 'Rust Cathedral', 'Tiny Tundra', 'Saffron Skies', 'Bell Hollow', 'Orbit Diner',
  'Velvet Depths', 'Copper Meadow', 'The Lamp Archive', 'Salt Road', 'Drift Atlas', 'Mirror Foxes', 'Wicker Sun',
  'Lowlight Station', 'Pale Harvest', 'Kite Forge', 'Ashen Opera', 'Marble Dunes', 'Glass Anthem', 'Fennel Frontier',
  'Night Bakery', 'Echo Canyon', 'Cobalt Parade', 'Moth Kingdom', 'Ivory Circuit', 'Tangle Woods', 'Sundial Heist',
  'Lantern Fleet', 'Ridge Runner', 'Opal Keep', 'Hush Harbor', 'Beacon Vale', 'Thistle Drive', 'Pine & Plasma',
];

class DemoBackend extends EventEmitter {
  constructor() {
    super();
    this.demo = true;
    this.blocked = false;
    this.loggedOn = false;
    this.accountName = 'Demo Hesap';
    this.steamid = '76561198000000000';
    this.idling = [];
    this.games = NAMES.map((name, i) => ({
      appid: 100000 + i * 7,
      name,
      drops: i % 9 === 8 ? 0 : 1 + ((i * 5) % 7),
      hours: i % 4 === 0 ? 0.3 + (i % 5) * 0.4 : 2.5 + ((i * 13) % 90) / 3,
      collected: null,
      total: null,
    }));
    this.timer = setInterval(() => this._tick(), 3000);
    this.timer.unref && this.timer.unref();
  }

  _tick() {
    for (const g of this.games) {
      if (!this.idling.includes(g.appid) || this.blocked) continue;
      g.hours += 0.12;
      if (g.drops > 0 && g.hours >= 2 && Math.random() < 0.28) g.drops -= 1;
    }
  }

  async startQR() {
    this.emit('qr', 'https://s.team/q/1/demo-only-not-a-real-login');
    setTimeout(() => this.emit('qrScanned'), 2500);
    this._qrT = setTimeout(() => this.emit('qrDone', { refreshToken: 'demo-token', accountName: this.accountName }), 4000);
  }
  cancelQR() { clearTimeout(this._qrT); }

  logOn() { setTimeout(() => { this.loggedOn = true; this.emit('account', this.accountName); this.emit('loggedOn'); }, 700); }
  logOff() { this.loggedOn = false; this.idling = []; }
  setGames(ids) { this.idling = ids.slice(); }
  getCookies() { return 'demo'; }
  async fetchGames() {
    await new Promise((r) => setTimeout(r, 400));
    return this.games.map((g) => ({ ...g }));
  }
  // test kancası: başka bir cihazda oyun açılmış gibi davran
  setBlocked(b) { this.blocked = b; this.emit('blocked', b); }
}

class DemoPrices extends PriceService {
  constructor(o) {
    super(o);
    this.gap = 120;
    if (!this.cache.template) this.cache.template = { prefix: '₺', suffix: '', dec: ',', decimals: 2, hasDecimals: true };
  }
  async _fetchOne(appid) {
    this.cache.games[appid] = { t: Date.now(), unit: 0.4 + ((appid * 37) % 520) / 100, count: 6 };
  }
}

module.exports = { DemoBackend, DemoPrices };
