/**
 * Regenera favicon, app tile/PWA e arquivos legados a partir da marca vetorial oficial.
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
const SITE_HOME_PUBLIC = path.join(ROOT, 'site-next', 'public');
const FAVICON_SOURCE = path.join(PUBLIC, 'axecloud-trident.png');
const PWA_SOURCE = FAVICON_SOURCE;
const LOGO_SOURCE = path.join(PUBLIC, 'brand', 'axecloud-logo-dark.svg');
const LOGO_LIGHT_SOURCE = path.join(PUBLIC, 'brand', 'axecloud-logo-light.svg');
const SYMBOL_SOURCE = path.join(PUBLIC, 'brand', 'axecloud-symbol.svg');
const ADMIN_PUBLIC = path.join(ROOT, 'axecloud-admin', 'public');
const ASSETS = path.join(ROOT, 'assets');

for (const source of [FAVICON_SOURCE, PWA_SOURCE, LOGO_SOURCE, LOGO_LIGHT_SOURCE, SYMBOL_SOURCE]) {
  if (!fs.existsSync(source)) throw new Error(`Fonte ausente: ${source}`);
}

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title">
  <title id="title">AxéCloud</title>
  <rect width="64" height="64" rx="15" fill="#102117"/>
  <image href="data:image/png;base64,${fs.readFileSync(FAVICON_SOURCE).toString('base64')}" x="7" y="7" width="50" height="50"/>
</svg>\n`;
fs.writeFileSync(path.join(PUBLIC, 'favicon.svg'), faviconSvg);
fs.writeFileSync(path.join(ROOT, 'cinematic-site', 'favicon.svg'), faviconSvg);
fs.writeFileSync(path.join(SITE_HOME_PUBLIC, 'favicon.svg'), faviconSvg);

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

async function resizePng(source, size) {
  return sharp(source, { density: 384 })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function resizeMaskablePng(size) {
  return sharp(PWA_SOURCE, { density: 384 })
    .flatten({ background: '#17251D' })
    .resize(size, size, { fit: 'cover' })
    .png()
    .toBuffer();
}

const faviconPngs = new Map();
const pwaPngs = new Map();
for (const size of [16, 32, 48, 96, 192, 512]) {
  faviconPngs.set(size, await resizePng(FAVICON_SOURCE, size));
  pwaPngs.set(size, await resizePng(PWA_SOURCE, size));
}

const faviconIco = pngsToIco([faviconPngs.get(16), faviconPngs.get(32), faviconPngs.get(48)]);
fs.writeFileSync(path.join(PUBLIC, 'favicon.ico'), faviconIco);
for (const size of [32, 48, 96, 192, 512]) {
  fs.writeFileSync(path.join(PUBLIC, `axecloud_${size}.png`), faviconPngs.get(size));
  fs.writeFileSync(path.join(PUBLIC, `pwa-${size}.png`), pwaPngs.get(size));
}
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(PUBLIC, `pwa-maskable-${size}.png`), await resizeMaskablePng(size));
}

fs.mkdirSync(ADMIN_PUBLIC, { recursive: true });
fs.writeFileSync(path.join(ADMIN_PUBLIC, 'favicon.ico'), faviconIco);
fs.writeFileSync(path.join(ADMIN_PUBLIC, 'favicon-48.png'), faviconPngs.get(48));
fs.writeFileSync(path.join(ADMIN_PUBLIC, 'apple-touch-icon.png'), pwaPngs.get(192));

const legacyLogo = await sharp(LOGO_SOURCE, { density: 384 }).resize({ width: 1120 }).png().toBuffer();
fs.writeFileSync(path.join(PUBLIC, 'logo-axecloud.png'), legacyLogo);
fs.writeFileSync(path.join(PUBLIC, 'ile-ase-logo.png'), legacyLogo);
fs.mkdirSync(ASSETS, { recursive: true });
fs.writeFileSync(path.join(ASSETS, 'logo-axecloud.png'), legacyLogo);

const matrixLogo = await resizePng(SYMBOL_SOURCE, 512);
fs.writeFileSync(path.join(PUBLIC, 'logo-topo-matriz.png'), matrixLogo);
await sharp(matrixLogo).resize(128, 128).webp({ quality: 92 }).toFile(path.join(PUBLIC, 'logo-topo-matriz-128.webp'));

const ogBackground = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#17251D"/>
    <circle cx="1120" cy="60" r="250" fill="none" stroke="#F7C928" stroke-width="3" opacity=".12"/>
    <circle cx="1120" cy="60" r="170" fill="none" stroke="#F7C928" stroke-width="2" opacity=".1"/>
    <circle cx="70" cy="610" r="190" fill="#F7C928" opacity=".05"/>
    <text x="600" y="500" text-anchor="middle" fill="#C7D0C9" font-family="Outfit,Arial,sans-serif" font-size="22" font-weight="600" letter-spacing="2">FINANCEIRO · GIRAS · CORRENTE · MEMÓRIA</text>
  </svg>
`);
const ogLogo = await sharp(LOGO_LIGHT_SOURCE, { density: 384 }).resize({ width: 920 }).png().toBuffer();
await sharp(ogBackground)
  .composite([{ input: ogLogo, left: 140, top: 150 }])
  .png()
  .toFile(path.join(PUBLIC, 'og-image.png'));

console.log('[brand] favicon, PWA, app tile, admin e arquivos legados atualizados');
