import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGoogleAdsHeadSnippet } from './google-ads-snippet.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'cinematic-site');
const OUT = path.join(ROOT, 'landing-dist');
const ASSET_OUT = path.join(OUT, 'm-assets', 'cinematic');

const pages = new Map([
  ['index.html', 'index.html'],
  ['terreiros.html', 'terreiros/index.html'],
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
  ['/terreiros-v2.css', path.join(SOURCE, 'terreiros-v2.css')],
  ['/shared-footer.js', path.join(SOURCE, 'shared-footer.js')],
  ['/favicon.svg', path.join(SOURCE, 'favicon.svg')],
  ['/production-bridge.js', path.join(SOURCE, 'production-bridge.js')],
  ['/assets/hero-fundo.webp', path.join(SOURCE, 'assets', 'hero-fundo.webp')],
  ['/assets/axecloud-trident.png', path.join(SOURCE, 'assets', 'axecloud-trident.png')],
  ['/fonts/manrope-variable.woff2', path.join(ROOT, 'node_modules', '@fontsource-variable', 'manrope', 'files', 'manrope-latin-wght-normal.woff2')],
  ['/vendor/gsap.min.js', path.join(ROOT, 'node_modules', 'gsap', 'dist', 'gsap.min.js')],
  ['/vendor/ScrollTrigger.min.js', path.join(ROOT, 'node_modules', 'gsap', 'dist', 'ScrollTrigger.min.js')],
  ['/vendor/leaflet/leaflet.js', path.join(ROOT, 'node_modules', 'leaflet', 'dist', 'leaflet.js')],
  ['/vendor/leaflet/leaflet.css', path.join(ROOT, 'node_modules', 'leaflet', 'dist', 'leaflet.css')],
  ['/vendor/L.TileLayer.NoGap.js', path.join(SOURCE, 'vendor', 'L.TileLayer.NoGap.js')],
]);

function assertFile(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`[cinematic] Arquivo ausente: ${file}`);
}
function digest(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
}
function digestContent(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
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
const reactShellOut = path.join(OUT, '__react_shell.html');
const currentIndex = fs.readFileSync(reactShellSource, 'utf8');
if (!currentIndex.includes('axecloud-marketing-build')) {
  fs.copyFileSync(reactShellSource, reactShellOut);
} else {
  assertFile(reactShellOut);
}

const urls = new Map();
for (const [publicPath, source] of assets) {
  assertFile(source);
  const name = outputName(source);
  urls.set(publicPath, `/m-assets/cinematic/${name}`);
}

function rewriteAssetReferences(content) {
  let rewritten = content;
  for (const [from, to] of [...urls.entries()].sort((a, b) => b[0].length - a[0].length)) {
    rewritten = rewritten.replaceAll(from, to);
  }
  return rewritten;
}

// CSS e JS também recebem hash do conteúdo já reescrito. Isso evita que o
// navegador mantenha em cache uma versão antiga com caminhos não versionados.
for (const [publicPath, source] of assets) {
  if (!/\.(?:css|js)$/i.test(source)) continue;
  const ext = path.extname(source);
  const base = path.basename(source, ext).replace(/\.min$/i, '');
  const rewritten = rewriteAssetReferences(fs.readFileSync(source, 'utf8'));
  urls.set(publicPath, `/m-assets/cinematic/${base}-${digestContent(rewritten)}${ext}`);
}

for (const [publicPath, source] of assets) {
  const destination = path.join(ASSET_OUT, path.basename(urls.get(publicPath)));
  if (/\.(?:css|js)$/i.test(source)) {
    fs.writeFileSync(destination, rewriteAssetReferences(fs.readFileSync(source, 'utf8')), 'utf8');
  } else {
    fs.copyFileSync(source, destination);
  }
}

const homeStylesContent = Buffer.concat([
  Buffer.from(rewriteAssetReferences(fs.readFileSync(assets.get('/styles.css'), 'utf8'))),
  Buffer.from('\n'),
  Buffer.from(rewriteAssetReferences(fs.readFileSync(assets.get('/styles-claro.css'), 'utf8'))),
  Buffer.from('\n'),
  Buffer.from(rewriteAssetReferences(fs.readFileSync(assets.get('/shared-footer.css'), 'utf8'))),
]);
const homeStylesName = `home-${digestContent(homeStylesContent)}.css`;
fs.writeFileSync(path.join(ASSET_OUT, homeStylesName), homeStylesContent);
const homeStylesUrl = `/m-assets/cinematic/${homeStylesName}`;

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
  if (sourceName === 'terreiros.html') {
    // Links reais no HTML: a descoberta das cidades não depende do canvas/JS.
    const catalog = JSON.parse(fs.readFileSync(path.join(OUT, 'diretorio-cidades.json'), 'utf8'));
    const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const states = new Map();
    for (const city of catalog.cidades || []) {
      if (!city.estado || !city.cidadeSlug) continue;
      const state = String(city.estado).toUpperCase();
      const cities = states.get(state) || [];
      cities.push(city);
      states.set(state, cities);
    }
    const links = [...states].sort(([a], [b]) => a.localeCompare(b)).map(([state, cities]) =>
      `<details><summary>${escape(state)} · ${cities.length} cidades</summary><ul>${cities.sort((a, b) => a.cidade.localeCompare(b.cidade, 'pt-BR')).map((city) => `<li><a href="/terreiros/${encodeURIComponent(state.toLowerCase())}/${encodeURIComponent(city.cidadeSlug)}">${escape(city.cidade)} (${Number(city.count) || 0})</a></li>`).join('')}</ul></details>`
    ).join('\n');
    html = html.replace('<!-- DIRECTORY_CITY_LINKS -->', `<section class="directory-city-links" aria-labelledby="city-directory-title"><h2 id="city-directory-title">Terreiros por cidade</h2><p>Explore as casas mapeadas em cada cidade do Brasil.</p>${links}</section>`);
    html = html.replace('</head>', `<style>.directory-city-links{margin:3rem auto;width:min(1120px,calc(100% - 40px))}.directory-city-links h2{font-size:1.75rem}.directory-city-links p{margin:1rem 0}.directory-city-links details{padding:1rem 0;border-bottom:1px solid rgba(180,150,60,.25)}.directory-city-links summary{cursor:pointer}.directory-city-links ul{columns:3;list-style:none;padding:1rem 0}.directory-city-links li{break-inside:avoid;margin:0 0 .75rem}.directory-city-links a{color:inherit;text-decoration:underline;text-underline-offset:3px}@media(max-width:700px){.directory-city-links ul{columns:1}}</style></head>`);
  }
  for (const [from, to] of [...urls.entries()].sort((a, b) => b[0].length - a[0].length)) {
    html = html.replaceAll(`"${from}"`, `"${to}"`).replaceAll(`'${from}'`, `'${to}'`);
  }
  if (sourceName === 'index.html') {
    html = html
      .replace(
        `<link rel="stylesheet" href="${urls.get('/styles.css')}" />`,
        `<link rel="stylesheet" href="${homeStylesUrl}" />`,
      )
      .replace(`  <link rel="stylesheet" href="${urls.get('/styles-claro.css')}" />\n`, '')
      .replace(`  <link rel="stylesheet" href="${urls.get('/shared-footer.css')}" />\n`, '');
  }
  html = html.replace(/\s*<link rel="manifest" href="\/site\.webmanifest" \/>/, '');
  html = html.replace(/(<body\b[^>]*>)/i, `$1\n  <script defer src="${bridgeUrl}"></script>`);
  const adsSnippet = buildGoogleAdsHeadSnippet();
  html = html.replace(
    '</head>',
    `${adsSnippet ? `  ${adsSnippet.replace(/\n/g, '\n  ')}\n` : ''}  <meta name="axecloud-marketing-build" content="cinematic-production" />\n</head>`,
  );

  const forbidden = ['/vendor/', 'href="/styles.css"', 'src="/app.js"', 'src="/shared-footer.js"'];
  const unresolved = forbidden.find((token) => html.includes(token));
  if (unresolved) throw new Error(`[cinematic] Referência não versionada em ${sourceName}: ${unresolved}`);

  const destination = path.join(OUT, outputRelative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, html, 'utf8');
}

console.log(`[cinematic] ${pages.size} páginas instaladas com ${assets.size + 1} assets versionados.`);
