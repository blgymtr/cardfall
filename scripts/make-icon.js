'use strict';
// Uygulama simgesini kodla çizer (harici görsel kullanılmaz): degrade kare üzerinde iki kart ve aşağı düşen ok.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 512;
const SS = 3;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const cov = (sd) => clamp(0.5 - sd);

function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r;
  const qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function sdSeg(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay));
  return Math.hypot(pax - bax * h, pay - bay * h);
}
function toLocal(px, py, cx, cy, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), dx = px - cx, dy = py - cy;
  return [dx * c + dy * s, -dx * s + dy * c];
}

function shade(x, y) {
  // arka plan: yuvarlatılmış kare + köşegen degrade
  const bgSd = sdRoundRect(x, y, W / 2, W / 2, W / 2, W / 2, W * 0.225);
  const a0 = cov(bgSd);
  if (a0 <= 0) return [0, 0, 0, 0];
  const t = clamp((x + y) / (2 * W));
  let col = [mix(143, 94, t), mix(157, 234, t), mix(255, 212, t)];
  const blend = (c, a) => { col = [mix(col[0], c[0], a), mix(col[1], c[1], a), mix(col[2], c[2], a)]; };

  // üstten yumuşak parıltı
  blend([255, 255, 255], 0.16 * clamp(1 - y / (W * 0.7)));

  // arka kart
  const A1 = (-14 * Math.PI) / 180;
  const [bx, by] = toLocal(x, y, W * 0.43, W * 0.5, A1);
  blend([255, 255, 255], 0.34 * cov(sdRoundRect(bx, by, 0, 0, W * 0.165, W * 0.235, W * 0.04)));

  // ön kart (hafif gölgeli)
  const A2 = (9 * Math.PI) / 180;
  const [fx, fy] = toLocal(x, y, W * 0.56, W * 0.52, A2);
  const sd = sdRoundRect(fx, fy, 0, 0, W * 0.175, W * 0.245, W * 0.045);
  blend([20, 30, 70], 0.22 * clamp(1 - (sd + 6) / 26) * (sd > 0 ? 1 : 0));
  blend([255, 255, 255], 0.97 * cov(sd));

  // kart üstünde aşağı düşen ok
  const arrowCol = [86, 104, 240];
  const th = W * 0.022;
  const dA = Math.min(
    sdSeg(fx, fy, 0, -W * 0.12, 0, W * 0.075),
    sdSeg(fx, fy, -W * 0.085, -W * 0.01, 0, W * 0.082),
    sdSeg(fx, fy, W * 0.085, -W * 0.01, 0, W * 0.082),
  ) - th;
  blend(arrowCol, cov(dA) * cov(sd + 3));
  // alt çizgi
  blend([150, 165, 255], cov(sdSeg(fx, fy, -W * 0.09, W * 0.16, W * 0.09, W * 0.16) - th * 0.8) * cov(sd + 3));

  return [col[0], col[1], col[2], a0];
}

const px = Buffer.alloc(W * W * 4);
for (let y = 0; y < W; y++) {
  for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const [cr, cg, cb, ca] = shade(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
        r += cr * ca; g += cg * ca; b += cb * ca; a += ca;
      }
    }
    const i = (y * W + x) * 4;
    const n = SS * SS;
    px[i] = a ? Math.round(r / a) : 0;
    px[i + 1] = a ? Math.round(g / a) : 0;
    px[i + 2] = a ? Math.round(b / a) : 0;
    px[i + 3] = Math.round((a / n) * 255);
  }
}

// ---- PNG kodlayıcı ----
const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const raw = Buffer.alloc((W * 4 + 1) * W);
for (let y = 0; y < W; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);

const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'icon.png'), png);
fs.writeFileSync(path.join(root, 'src', 'renderer', 'icon.png'), png);
console.log('icon written', png.length, 'bytes');
