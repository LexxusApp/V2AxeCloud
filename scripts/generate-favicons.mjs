/**
 * Regenera favicon.ico (PNG-in-ICO) e PNGs 48/96 a partir de public/axecloud_192.png.
 * Uso: node scripts/generate-favicons.mjs
 *
 * Usa PNG embutido no .ico (não BMP clássico): Chrome/Edge/Firefox renderizam
 * corretamente; o pacote to-ico gera DIB/BMP que aparece como "ruído" na aba.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const SOURCE = path.join(PUBLIC, 'axecloud_192.png');

if (!fs.existsSync(SOURCE)) {
  throw new Error(`Fonte ausente: ${SOURCE}`);
}

/** Empacota PNGs num .ico moderno (PNG-in-ICO). */
function pngsToIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = [];

  for (const png of pngBuffers) {
    if (png[0] !== 0x89 || png[1] !== 0x50) {
      throw new Error('Buffer não é PNG válido');
    }
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    entries.push({
      w: w >= 256 ? 0 : w,
      h: h >= 256 ? 0 : h,
      size: png.length,
      offset,
      png,
    });
    offset += png.length;
  }

  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(count, 4);

  let dir = 6;
  for (const e of entries) {
    out[dir] = e.w;
    out[dir + 1] = e.h;
    out[dir + 2] = 0;
    out[dir + 3] = 0;
    out.writeUInt16LE(1, dir + 4);
    out.writeUInt16LE(32, dir + 6);
    out.writeUInt32LE(e.size, dir + 8);
    out.writeUInt32LE(e.offset, dir + 12);
    e.png.copy(out, e.offset);
    dir += 16;
  }
  return out;
}

async function resizePng(size) {
  return sharp(SOURCE)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png()
    .toBuffer();
}

const png16 = await resizePng(16);
const png32 = await resizePng(32);
const png48 = await resizePng(48);
const png96 = await resizePng(96);

fs.writeFileSync(path.join(PUBLIC, 'favicon.ico'), pngsToIco([png16, png32, png48]));
fs.writeFileSync(path.join(PUBLIC, 'axecloud_48.png'), png48);
fs.writeFileSync(path.join(PUBLIC, 'axecloud_96.png'), png96);
fs.writeFileSync(path.join(PUBLIC, 'pwa-48.png'), png48);
fs.writeFileSync(path.join(PUBLIC, 'pwa-96.png'), png96);

console.log('[favicons] favicon.ico (PNG-in-ICO 16/32/48), axecloud_48/96, pwa-48/96 atualizados');
