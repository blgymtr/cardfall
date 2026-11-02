'use strict';
// Kalıcı silme: dosya içeriğinin üzerine rastgele veri yazılır, diske işlenir (fsync), adı değiştirilir ve silinir.
// Not: SSD'lerde aşınma dengeleme nedeniyle eski bloklar tamamen yok edilemeyebilir; bu en iyi çabadır.
// Asıl koruma, sırların zaten şifreli (AES-256-GCM + DPAPI) yazılmış olmasıdır.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function shredFile(file) {
  let size = 0;
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile()) { if (st.isSymbolicLink()) fs.rmSync(file, { force: true }); return 0; }
    size = st.size;
    const fd = fs.openSync(file, 'r+');
    try {
      const CHUNK = 1 << 20;
      let pos = 0;
      while (pos < size) {
        const n = Math.min(CHUNK, size - pos);
        fs.writeSync(fd, crypto.randomBytes(n), 0, n, pos);
        pos += n;
      }
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } catch { /* dosya yoksa ya da kilitliyse normal silmeye düş */ }
  try {
    const alias = path.join(path.dirname(file), crypto.randomBytes(8).toString('hex') + '.del');
    fs.renameSync(file, alias);
    fs.rmSync(alias, { force: true });
  } catch {
    try { fs.rmSync(file, { force: true }); } catch { /* yok say */ }
  }
  return size;
}

/** Klasördeki her dosyayı (alt klasörler dahil) kalıcı siler; klasörü de kaldırır. Silinen bayt sayısını döner. */
function shredDir(dir, { keepDir = false } = {}) {
  let bytes = 0;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) bytes += shredDir(p);
    else bytes += shredFile(p);
  }
  if (!keepDir) { try { fs.rmdirSync(dir); } catch { /* yok say */ } }
  return bytes;
}

function sizeOf(p) {
  let total = 0;
  try {
    const st = fs.lstatSync(p);
    if (st.isFile()) return st.size;
    if (st.isDirectory()) for (const name of fs.readdirSync(p)) total += sizeOf(path.join(p, name));
  } catch { /* yok say */ }
  return total;
}

module.exports = { shredFile, shredDir, sizeOf };
