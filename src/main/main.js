'use strict';

const path = require('path');
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, nativeTheme, powerMonitor, powerSaveBlocker, safeStorage, Notification, shell } = require('electron');
const security = require('./security');
const I18N = require('../renderer/i18n');

// Ortam değişkenleriyle TLS doğrulamasını kapatma girişimini etkisiz kıl.
delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
process.on('uncaughtException', (e) => { console.error('uncaught:', e && e.message); });
process.on('unhandledRejection', (e) => { console.error('unhandled:', e && e.message); });

app.setName('Cardfall');
app.setAppUserModelId('com.omer.cardfall');
security.registerScheme();

// Test/geliştirme kancaları yalnızca paketlenmemiş sürümde çalışır.
const DEV = !app.isPackaged;
const DEMO = DEV && process.env.CARDFALL_DEMO === '1';
const START_HIDDEN = process.argv.includes('--hidden');
if (DEV && process.env.CARDFALL_USER_DATA) app.setPath('userData', path.resolve(process.env.CARDFALL_USER_DATA));

if (!app.requestSingleInstanceLock()) { app.quit(); } else { boot(); }

function boot() {
  let win = null;
  let tray = null;
  let controller = null;
  let quitting = false;
  let lastActivity = Date.now();
  let sleepBlock = null;
  let pushTimer = null;
  let loginItem = null;
  let hiddenShown = false;
  let capture = null;
  const calls = [];

  const ICON = path.join(__dirname, '..', '..', 'build', 'icon.png');
  const COLORS = {
    dark: { color: '#0c0e13', symbolColor: '#aab1c5' },
    light: { color: '#f2f3f7', symbolColor: '#454b5e' },
  };

  security.harden();

  // ---- pencere ----------------------------------------------------------------------
  function createWindow() {
    const dark = nativeTheme.shouldUseDarkColors;
    win = new BrowserWindow({
      width: 1200,
      height: 780,
      minWidth: 960,
      minHeight: 640,
      show: false,
      title: 'Cardfall',
      icon: ICON,
      backgroundColor: dark ? COLORS.dark.color : COLORS.light.color,
      titleBarStyle: 'hidden',
      titleBarOverlay: { ...(dark ? COLORS.dark : COLORS.light), height: 42 },
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        spellcheck: false,
        devTools: DEV,
        navigateOnDragDrop: false,
        webviewTag: false,
      },
    });
    win.removeMenu();
    win.setContentProtection(!!controller.store.settings.hideFromCapture);
    win.once('ready-to-show', () => { if (!START_HIDDEN || hiddenShown) win.show(); });
    win.on('minimize', () => { if (controller.store.settings.lockOnMinimize) controller.lock(); });
    win.loadURL(security.UI_ORIGIN + 'index.html');
    win.on('close', (e) => {
      if (quitting) return;
      const s = controller.store.settings;
      if (s.closeToTray && controller.engine.run === 'running') {
        e.preventDefault();
        controller.lock();
        win.hide();
      } else {
        quitting = true;
      }
    });
    win.on('closed', () => { win = null; });
  }

  function showWindow() {
    hiddenShown = true;
    if (!win) createWindow();
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }

  function pushState() {
    if (pushTimer) return;
    pushTimer = setTimeout(() => {
      pushTimer = null;
      if (win && !win.isDestroyed()) win.webContents.send('state', controller.publicState());
      refreshShell();
    }, 120);
  }

  // ---- tepsi / uyku / tema -----------------------------------------------------------------
  function buildTray() {
    const img = nativeImage.createFromPath(ICON);
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 20, height: 20 }));
    tray.on('click', showWindow);
    refreshShell();
  }

  function refreshShell() {
    const sum = controller.summary();
    if (tray) {
      const running = sum.run === 'running';
      const T = (k, p) => controller.t(k, p);
      tray.setToolTip(running ? (sum.active ? T('tray.running', { n: sum.idling }) : T('tray.waiting')) : (sum.phase === 'ready' ? T('tray.paused') : T('tray.locked')));
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: T('tray.open'), click: showWindow },
        { label: running ? T('tray.pause') : T('tray.resume'), enabled: sum.phase === 'ready' || sum.phase === 'locked', click: () => controller.engine.toggle() },
        { label: T('tray.lock'), click: () => controller.lock() },
        { type: 'separator' },
        { label: T('tray.quit'), click: () => app.quit() },
      ]));
    }
    // uyku engeli
    const want = controller.store.settings.keepAwake && sum.run === 'running';
    if (want && sleepBlock == null) sleepBlock = powerSaveBlocker.start('prevent-app-suspension');
    if (!want && sleepBlock != null) { powerSaveBlocker.stop(sleepBlock); sleepBlock = null; }
    // Windows ile başlat (gizli) ve ekran yakalama koruması
    const s = controller.store.settings;
    if (app.isPackaged && loginItem !== s.launchAtLogin) {
      loginItem = s.launchAtLogin;
      try { app.setLoginItemSettings({ openAtLogin: s.launchAtLogin, args: ['--hidden'] }); } catch { /* yok say */ }
    }
    if (capture !== s.hideFromCapture && win && !win.isDestroyed()) {
      capture = s.hideFromCapture;
      try { win.setContentProtection(!!capture); } catch { /* yok say */ }
    }
    // tema
    const theme = controller.store.settings.theme;
    if (nativeTheme.themeSource !== theme) nativeTheme.themeSource = theme;
    if (win && !win.isDestroyed() && process.platform === 'win32') {
      try { win.setTitleBarOverlay({ ...(nativeTheme.shouldUseDarkColors ? COLORS.dark : COLORS.light), height: 42 }); } catch { /* yok say */ }
    }
  }

  // ---- IPC --------------------------------------------------------------------------------
  const isStr = (v, max = 256) => typeof v === 'string' && v.length <= max;
  const isId = (v) => Number.isInteger(v) && v > 0 && v < 2 ** 31;

  // Saniyede en çok 50 çağrı: ele geçirilmiş bir arayüz bile ana süreci yoğun çağrıyla boğamaz.
  function allowCall() {
    const now = Date.now();
    while (calls.length && now - calls[0] > 1000) calls.shift();
    if (calls.length >= 50) return false;
    calls.push(now);
    return true;
  }

  function handle(channel, fn, { needReady = false } = {}) {
    ipcMain.handle(channel, async (event, ...args) => {
      if (!security.trustedSender(event, win)) return { ok: false, error: 'forbidden' };
      if (!allowCall()) return { ok: false, error: 'rate' };
      if (needReady && controller.phase() !== 'ready') return { ok: false, error: 'not-ready' };
      try {
        const r = await fn(...args);
        return r === undefined ? { ok: true } : r;
      } catch {
        return { ok: false, error: 'internal' }; // iç hata ayrıntısı arayüze sızdırılmaz
      }
    });
  }

  function registerIpc() {
    handle('state:get', () => ({ ok: true, state: controller.publicState() }));
    handle('auth:setup', (pass) => (isStr(pass, 128) ? controller.setup(pass) : { ok: false, messageKey: 'pw.invalid' }));
    handle('auth:unlock', (pass) => (isStr(pass, 128) ? controller.unlock(pass) : { ok: false, code: 'WRONG' }));
    handle('auth:lock', () => controller.lock());
    handle('lang:set', (l) => { if (['auto', ...I18N.LANGS].includes(l)) controller.setLanguage(l); });
    handle('auth:change', (a, b) => (isStr(a, 128) && isStr(b, 128) ? controller.changePassphrase(a, b) : { ok: false, messageKey: 'pw.invalid' }), { needReady: true });
    handle('login:start', () => { if (controller.phase() === 'login') controller.startLogin(); });
    handle('stats:get', () => ({ ok: true, stats: controller.statistics() }), { needReady: true });
    handle('stats:reset', () => controller.resetStatistics(), { needReady: true });
    handle('session:get', () => ({ ok: true, session: controller.sessionInfo() }), { needReady: true });
    handle('data:info', () => ({ ok: true, data: controller.dataInfo() }), { needReady: true });
    handle('data:clear', (kind) => {
      if (kind === 'log') controller.clearLog();
      else if (kind === 'history') controller.clearHistory();
      else if (kind === 'cache') controller.clearCache();
      else return { ok: false, error: 'bad-kind' };
      return { ok: true };
    }, { needReady: true });
    handle('account:logoutFull', () => controller.logoutFull(), { needReady: true });
    handle('info:get', async (id) => (isId(id) ? { ok: true, info: await controller.gameInfo(id) } : { ok: false, error: 'bad-id' }), { needReady: true });
    handle('app:openStore', (id) => { if (!isId(id)) return { ok: false, error: 'bad-id' }; shell.openExternal(`https://store.steampowered.com/app/${id}/`); }, { needReady: true });
    handle('account:logout', () => controller.logout(), { needReady: true });
    handle('account:wipe', (word) => { if (word !== 'SIL') return { ok: false, error: 'confirm' }; controller.wipeEverything(); });
    handle('farm:toggle', () => controller.engine.toggle(), { needReady: true });
    handle('farm:refresh', () => controller.engine.refresh(), { needReady: true });
    handle('farm:pin', (id) => { if (isId(id)) controller.engine.pin(id); }, { needReady: true });
    handle('farm:unpin', () => controller.engine.unpin(), { needReady: true });
    handle('farm:next', () => controller.engine.next(), { needReady: true });
    handle('game:black', (id, on) => { if (isId(id) && typeof on === 'boolean') controller.engine.setBlacklisted(id, on); }, { needReady: true });
    handle('settings:set', (patch) => { if (patch && typeof patch === 'object' && !Array.isArray(patch)) { const { blacklist, ...rest } = patch; controller.setSettings(rest); } }, { needReady: true });
    handle('app:quit', () => { quitting = true; app.quit(); });
    handle('app:hide', () => { controller.lock(); if (win) win.hide(); });

    ipcMain.on('activity', (event) => { if (security.trustedSender(event, win)) lastActivity = Date.now(); });
  }

  // ---- yaşam döngüsü -----------------------------------------------------------------------------
  app.whenReady().then(() => {
    const { Controller } = require('./controller');
    const dir = app.getPath('userData');
    security.hardenSession();

    controller = new Controller({
      dir,
      demo: DEMO,
      version: app.getVersion(),
      locale: app.getLocale(),
      safe: {
        isAvailable: () => safeStorage.isEncryptionAvailable(),
        encrypt: (s) => safeStorage.encryptString(s),
        decrypt: (b) => safeStorage.decryptString(b),
      },
    });
    nativeTheme.themeSource = controller.store.settings.theme;
    security.setupProtocol({ cacheDir: controller.store.cacheDir, offline: DEMO, resolveHeader: (id) => controller.appinfo.headerUrl(id) });

    controller.on('state', pushState);
    controller.engine.on('drop', ({ name, n }) => {
      if (win && win.isVisible() && win.isFocused()) return;
      if (Notification.isSupported()) new Notification({ title: controller.t('notif.title'), body: `${name}: +${n}`, silent: true }).show();
    });

    registerIpc();
    createWindow();
    buildTray();
    if (START_HIDDEN && Notification.isSupported()) {
      const n = new Notification({ title: controller.t('notif.waitTitle'), body: controller.t('notif.waitBody'), silent: true });
      n.on('click', showWindow);
      n.show();
    }

    // otomatik kilit
    setInterval(() => {
      const min = controller.store.settings.lockMinutes;
      if (min > 0 && Date.now() - lastActivity > min * 60000) controller.lock();
    }, 15000);
    powerMonitor.on('lock-screen', () => controller.lock());
    powerMonitor.on('suspend', () => controller.lock());

    // yalnızca geliştirme: uygulamayı otomatik test etmek için
    if (DEV && process.env.CARDFALL_TEST_HOOK === '1') {
      global.__cardfall = { controller, get win() { return win; } };
    }
  });

  app.on('second-instance', () => { if (controller) showWindow(); });
  app.on('activate', () => { if (controller) showWindow(); });
  app.on('before-quit', () => {
    quitting = true;
    if (controller) controller.shutdown();
  });
  app.on('window-all-closed', () => { if (quitting) app.quit(); });
}
