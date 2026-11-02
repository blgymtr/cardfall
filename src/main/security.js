'use strict';
// Electron sertleştirmesi: arayüz süreci internete çıkamaz, yalnızca kendi
// "cardfall://" şemasını okur; oyun görselleri ana süreç üzerinden (izinli
// Steam CDN'den) alınıp diske önbelleklenir.

const fs = require('fs');
const path = require('path');
const { app, protocol, session } = require('electron');
const http = require('./http');

const SCHEME = 'cardfall';
const UI_ORIGIN = `${SCHEME}://ui/`;
const RENDERER_DIR = path.resolve(__dirname, '..', 'renderer');

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: cardfall:",
  "font-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function registerScheme() {
  protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true } }]);
}

function baseHeaders(type) {
  return {
    'Content-Type': type,
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
}

const notFound = () => new Response('Not found', { status: 404, headers: { 'X-Content-Type-Options': 'nosniff' } });

async function serveUi(pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return notFound(); }
  rel = rel.replace(/^\/+/, '') || 'index.html';
  const full = path.resolve(RENDERER_DIR, rel);
  if (!full.startsWith(RENDERER_DIR + path.sep)) return notFound();
  const type = MIME[path.extname(full).toLowerCase()];
  if (!type) return notFound();
  try {
    return new Response(await fs.promises.readFile(full), { headers: baseHeaders(type) });
  } catch { return notFound(); }
}

// ---- oyun görselleri ---------------------------------------------------------------------
const VARIANTS = { capsule: 'capsule_231x87.jpg', header: 'header.jpg' };
const failed = new Map(); // anahtar -> zaman (kısa süreli olumsuz önbellek)

function looksLikeImage(buf) {
  if (buf.length < 16 || buf.length > 1_500_000) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  return null;
}

async function serveImage(pathname, { cacheDir, offline }) {
  const m = /^\/(\d{1,10})\/(capsule|header)$/.exec(pathname);
  if (!m) return notFound();
  const [, appid, variant] = m;
  const key = `${appid}_${variant}`;
  const file = path.join(cacheDir, `${key}.img`);
  const headers = (type) => ({ 'Content-Type': type, 'Cache-Control': 'max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' });
  try {
    const cached = await fs.promises.readFile(file);
    const type = looksLikeImage(cached);
    if (type) return new Response(cached, { headers: headers(type) });
  } catch { /* önbellekte yok */ }
  if (offline) return notFound();
  const t = failed.get(key);
  if (t && Date.now() - t < 10 * 60 * 1000) return notFound();
  try {
    const buf = await http.get(`https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/${VARIANTS[variant]}`, { hosts: http.IMAGE_HOSTS, binary: true, maxBytes: 1_500_000, timeoutMs: 12000 });
    const type = looksLikeImage(buf);
    if (!type) throw new Error('not an image');
    fs.promises.mkdir(cacheDir, { recursive: true }).then(() => fs.promises.writeFile(file, buf)).catch(() => {});
    return new Response(buf, { headers: headers(type) });
  } catch {
    failed.set(key, Date.now());
    return notFound();
  }
}

function setupProtocol({ cacheDir, offline }) {
  protocol.handle(SCHEME, async (request) => {
    let url;
    try { url = new URL(request.url); } catch { return notFound(); }
    if (url.host === 'ui') return serveUi(url.pathname);
    if (url.host === 'img') return serveImage(url.pathname, { cacheDir, offline });
    return notFound();
  });
}

// ---- genel sertleştirme -----------------------------------------------------------------------
function harden() {
  app.enableSandbox();

  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-navigate', (e) => e.preventDefault());
    contents.on('will-redirect', (e) => e.preventDefault());
    contents.on('will-attach-webview', (e) => e.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });

}

/** app.whenReady() sonrasında çağrılır. */
function hardenSession() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
  ses.setDevicePermissionHandler(() => false);
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, cb) => {
    const u = details.url;
    const ok = u.startsWith(`${SCHEME}://`) || u.startsWith('data:') || (!app.isPackaged && u.startsWith('devtools://'));
    cb({ cancel: !ok });
  });
}

/** Yalnızca kendi arayüz sayfamızdan gelen IPC çağrılarına izin ver. */
function trustedSender(event, win) {
  try {
    if (!win || event.sender !== win.webContents) return false;
    const url = event.senderFrame && event.senderFrame.url;
    return typeof url === 'string' && url.startsWith(UI_ORIGIN) && event.senderFrame === event.sender.mainFrame;
  } catch { return false; }
}

module.exports = { registerScheme, setupProtocol, harden, hardenSession, trustedSender, UI_ORIGIN, CSP, looksLikeImage };
