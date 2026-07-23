import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'cinematic-site');
const OUT = path.join(ROOT, 'landing-dist');
const ASSET_OUT = path.join(OUT, 'm-assets', 'cinematic');

const pages = new Map([
  ['index.html', 'index.html'],
  ['terreiros.html', 'terreiros/index.html'],
  ['terreiro.html', 'terreiro/index.html'],
  ['eventos.html', 'eventos/index.html'],
  ['evento.html', 'evento/index.html'],
  ['senhas.html', 'senhas/index.html'],
  ['conteudo.html', 'conteudo/index.html'],
  ['calendario-liturgico.html', 'conteudo/calendario-liturgico/index.html'],
  ['por-que-axecloud.html', 'por-que-axecloud/index.html'],
  ['espaco-do-fiel.html', 'espaco-do-fiel/index.html'],
]);

const assets = new Map([
  ['/styles.css', path.join(SOURCE, 'styles.css')],
  ['/styles-claro.css', path.join(SOURCE, 'styles-claro.css')],
  ['/app.js', path.join(SOURCE, 'app.js')],
  ['/shared-footer.css', path.join(SOURCE, 'shared-footer.css')],
  ['/shared-footer.js', path.join(SOURCE, 'shared-footer.js')],
  ['/favicon.svg', path.join(SOURCE, 'favicon.svg')],
  ['/production-bridge.js', path.join(SOURCE, 'production-bridge.js')],
  ['/assets/hero-fundo.webp', path.join(SOURCE, 'assets', 'hero-fundo.webp')],
  ['/vendor/gsap.min.js', path.join(ROOT, 'node_modules', 'gsap', 'dist', 'gsap.min.js')],
  ['/vendor/ScrollTrigger.min.js', path.join(ROOT, 'node_modules', 'gsap', 'dist', 'ScrollTrigger.min.js')],
  ['/vendor/lenis.min.js', path.join(ROOT, 'node_modules', 'lenis', 'dist', 'lenis.min.js')],
  ['/vendor/leaflet/leaflet.js', path.join(ROOT, 'node_modules', 'leaflet', 'dist', 'leaflet.js')],
  ['/vendor/leaflet/leaflet.css', path.join(ROOT, 'node_modules', 'leaflet', 'dist', 'leaflet.css')],
]);

function assertFile(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`[cinematic] Arquivo ausente: ${file}`);
}
function digest(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
}
function outputName(source) {
  const ext = path.extname(source);
  const base = path.basename(source, ext).replace(/\.min$/i, '');
  return `${base}-${digest(source)}${ext}`;
}

fs.mkdirSync(ASSET_OUT, { recursive: true });

// O nginx usa este shell somente quando uma rota React dinâmica ainda não foi
// pré-renderizada. Sem ele, o novo index cinematográfico viraria o fallback de
// /terreiro/:slug e outras páginas públicas dinâmicas.
const reactShellSource = path.join(OUT, 'index.html');
assertFile(reactShellSource);
fs.copyFileSync(reactShellSource, path.join(OUT, '__react_shell.html'));

const urls = new Map();
for (const [publicPath, source] of assets) {
  assertFile(source);
  const name = outputName(source);
  const destination = path.join(ASSET_OUT, name);
  fs.copyFileSync(source, destination);
  urls.set(publicPath, `/m-assets/cinematic/${name}`);
}

const leafletImages = path.join(ROOT, 'node_modules', 'leaflet', 'dist', 'images');
const leafletImageOut = path.join(ASSET_OUT, 'images');
fs.mkdirSync(leafletImageOut, { recursive: true });
for (const name of ['marker-icon.png', 'marker-icon-2x.png', 'marker-shadow.png']) {
  const source = path.join(leafletImages, name);
  assertFile(source);
  fs.copyFileSync(source, path.join(leafletImageOut, name));
}

const bridgeUrl = urls.get('/production-bridge.js');
for (const [sourceName, outputRelative] of pages) {
  const sourcePath = path.join(SOURCE, sourceName);
  assertFile(sourcePath);
  let html = fs.readFileSync(sourcePath, 'utf8');
  for (const [from, to] of [...urls.entries()].sort((a, b) => b[0].length - a[0].length)) {
    html = html.replaceAll(`"${from}"`, `"${to}"`).replaceAll(`'${from}'`, `'${to}'`);
  }
  html = html.replace(/\s*<link rel="manifest" href="\/site\.webmanifest" \/>/, '');
  html = html.replace(/(<body\b[^>]*>)/i, `$1\n  <script src="${bridgeUrl}"></script>`);
  html = html.replace('</head>', `  <meta name="axecloud-marketing-build" content="cinematic-production" />\n</head>`);

  const forbidden = ['/vendor/', 'href="/styles.css"', 'src="/app.js"', 'src="/shared-footer.js"'];
  const unresolved = forbidden.find((token) => html.includes(token));
  if (unresolved) throw new Error(`[cinematic] Referência não versionada em ${sourceName}: ${unresolved}`);

  const destination = path.join(OUT, outputRelative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, html, 'utf8');
}

console.log(`[cinematic] ${pages.size} páginas instaladas com ${assets.size} assets versionados.`);
