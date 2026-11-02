'use strict';

const path = require('path');
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, nativeTheme, powerMonitor, powerSaveBlocker, safeStorage, Notification } = require('electron');
const security = require('./security');

app.setName('Cardfall');
app.setAppUserModelId('com.omer.cardfall');
security.registerScheme();

// Test/geliştirme kancaları yalnızca paketlenmemiş sürümde çalışır.
const DEV = !app.isPackaged;
const DEMO = DEV && process.env.CARDFALL_DEMO === '1';
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
    win.once('ready-to-show', () => win.show());
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
      tray.setToolTip(running ? `Cardfall — ${sum.active ? `${sum.idling} oyun çalışıyor` : 'bekliyor'}` : 'Cardfall — duraklatıldı');
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Cardfall\'ı aç', click: showWindow },
        { label: running ? 'Duraklat' : 'Devam et', enabled: sum.phase === 'ready' || sum.phase === 'locked', click: () => controller.engine.toggle() },
        { label: 'Kilitle', click: () => controller.lock() },
        { type: 'separator' },
        { label: 'Çıkış', click: () => app.quit() },
      ]));
    }
    // uyku engeli
    const want = controller.store.settings.keepAwake && sum.run === 'running';
    if (want && sleepBlock == null) sleepBlock = powerSaveBlocker.start('prevent-app-suspension');
    if (!want && sleepBlock != null) { powerSaveBlocker.stop(sleepBlock); sleepBlock = null; }
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

  function handle(channel, fn, { needReady = false } = {}) {
    ipcMain.handle(channel, async (event, ...args) => {
      if (!security.trustedSender(event, win)) return { ok: false, error: 'forbidden' };
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
    handle('auth:setup', (pass) => (isStr(pass, 128) ? controller.setup(pass) : { ok: false, message: 'Geçersiz parola' }));
    handle('auth:unlock', (pass) => (isStr(pass, 128) ? controller.unlock(pass) : { ok: false, code: 'WRONG' }));
    handle('auth:lock', () => controller.lock());
    handle('auth:change', (a, b) => (isStr(a, 128) && isStr(b, 128) ? controller.changePassphrase(a, b) : { ok: false, message: 'Geçersiz' }), { needReady: true });
    handle('login:start', () => { if (controller.phase() === 'login') controller.startLogin(); });
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
    security.setupProtocol({ cacheDir: path.join(dir, 'imgcache'), offline: DEMO });

    controller = new Controller({
      dir,
      demo: DEMO,
      version: app.getVersion(),
      safe: {
        isAvailable: () => safeStorage.isEncryptionAvailable(),
        encrypt: (s) => safeStorage.encryptString(s),
        decrypt: (b) => safeStorage.decryptString(b),
      },
    });
    nativeTheme.themeSource = controller.store.settings.theme;

    controller.on('state', pushState);
    controller.engine.on('drop', ({ name, n }) => {
      if (win && win.isVisible() && win.isFocused()) return;
      if (Notification.isSupported()) new Notification({ title: 'Kart düştü', body: `${name}: +${n}`, silent: true }).show();
    });

    registerIpc();
    createWindow();
    buildTray();

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
