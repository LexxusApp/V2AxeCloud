import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'landing-dist');
const CINEMATIC = [
  'index.html',
  'terreiros/index.html',
  'eventos/index.html',
  'evento/index.html',
  'senhas/index.html',
  'conteudo/index.html',
  'conteudo/calendario-liturgico/index.html',
  'por-que-axecloud/index.html',
  'espaco-do-fiel/index.html',
];
const REACT = [
  '__react_shell.html',
  'register/index.html',
  'termos/index.html',
  'privacidade/index.html',
  'conteudo/gestao-de-terreiros/index.html',
  'recursos/index.html',
  'recursos/financeiro-pix-mensalidades/index.html',
  'recursos/calendario-giras/index.html',
  'recursos/portal-filho-de-santo/index.html',
  'recursos/whatsapp-oficial/index.html',
  'recursos/app-pwa-terreiro/index.html',
];
const RESOURCE_ROUTES = [
  '/recursos',
  '/recursos/financeiro-pix-mensalidades',
  '/recursos/calendario-giras',
  '/recursos/portal-filho-de-santo',
  '/recursos/whatsapp-oficial',
  '/recursos/app-pwa-terreiro',
];

function fail(message) {
  throw new Error(`[marketing:validate] ${message}`);
}
function read(relative) {
  const target = path.join(OUT, relative);
  if (!fs.existsSync(target)) fail(`arquivo ausente: ${relative}`);
  return fs.readFileSync(target, 'utf8');
}

for (const relative of CINEMATIC) {
  const html = read(relative);
  if (!html.includes('axecloud-marketing-build" content="cinematic-production')) {
    fail(`marcador cinematográfico ausente: ${relative}`);
  }
  if (!html.includes('AW-18367072937') && !html.includes('googletagmanager.com/gtag/js')) {
    fail(`tag Google Ads ausente: ${relative}`);
  }
  if (!/<link rel="canonical" href="https:\/\/axecloud\.com\.br\//.test(html)) {
    fail(`canonical de produção ausente: ${relative}`);
  }
  if (!/<meta name="description" content="[^"]{40,}"/.test(html)) {
    fail(`description insuficiente: ${relative}`);
  }
  for (const match of html.matchAll(/(?:src|href)="(\/m-assets\/cinematic\/[^"]+)"/g)) {
    const asset = path.join(OUT, match[1].slice(1));
    if (!fs.existsSync(asset)) fail(`asset ausente em ${relative}: ${match[1]}`);
  }
  if (/"\/(?:vendor\/|styles(?:-claro)?\.css|app\.js|shared-footer\.(?:css|js))"/.test(html)) {
    fail(`asset não versionado em ${relative}`);
  }
}

for (const relative of REACT) {
  const html = read(relative);
  if (html.includes('cinematic-production')) fail(`rota React sobrescrita: ${relative}`);
  if (!html.includes('/m-assets/')) fail(`bundle React ausente: ${relative}`);
}

const resourceTitles = new Set();
for (const route of RESOURCE_ROUTES) {
  const html = read(`${route.slice(1)}/index.html`);
  const canonical = route === '/' ? 'https://axecloud.com.br/' : `https://axecloud.com.br${route}`;
  if (!html.includes(`<link rel="canonical" href="${canonical}" />`)) {
    fail(`canonical incorreto: ${route}`);
  }
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1]?.trim();
  if (!title) fail(`title ausente: ${route}`);
  if (resourceTitles.has(title)) fail(`title duplicado em Recursos: ${title}`);
  resourceTitles.add(title);
}

const homeMarkdown = read('index.md');
if (!homeMarkdown.includes('AxéCloud') || homeMarkdown.includes('<script')) {
  fail('index.md para agentes ausente ou ainda contém HTML');
}

if (fs.existsSync(path.join(OUT, 'entrar', 'index.html'))) {
  fail('/entrar não pode pertencer ao container de marketing');
}

console.log(`[marketing:validate] ${CINEMATIC.length} páginas novas e ${REACT.length} rotas preservadas validadas.`);
