/**
 * Gera public/sitemap.xml e public/robots.txt para o AxéCloud (Vite + Vercel).
 *
 * Equivalente ao app/sitemap.ts do Next.js App Router: roda no build e
 * publica XML estático em /sitemap.xml.
 *
 * Uso:
 *   node scripts/generate-sitemap.mjs
 *   SITE_URL=https://axecloud.com.br node scripts/generate-sitemap.mjs
 *
 * Variáveis:
 *   SITE_URL — origem canônica (padrão: https://axecloud.com.br)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITEMAP_ROUTES } from './sitemap-routes.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const DEFAULT_SITE_URL = 'https://axecloud.com.br';

/** @typedef {'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'} ChangeFrequency */

/**
 * @typedef {Object} SitemapRoute
 * @property {string} path
 * @property {ChangeFrequency} [changeFrequency]
 * @property {number} [priority]
 * @property {string | Date} [lastModified]
 * @property {string} [comment]
 */

/**
 * @param {string} value
 */
function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * @param {string} siteUrl
 * @param {string} routePath
 */
function toAbsoluteUrl(siteUrl, routePath) {
  const base = siteUrl.replace(/\/+$/, '');
  if (routePath === '/' || routePath === '') return `${base}/`;
  const segment = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return `${base}${segment}`;
}

/**
 * @param {string | Date | undefined}
 */
function formatLastMod(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new Error(`lastModified inválido: ${String(value)}`);
  }
  return date.toISOString().slice(0, 10);
}

/**
 * @param {string} siteUrl
 * @param {SitemapRoute[]} routes
 */
export function buildSitemapXml(siteUrl, routes) {
  const urlEntries = routes.map((route) => {
    const loc = escapeXml(toAbsoluteUrl(siteUrl, route.path));
    const lastmod = formatLastMod(route.lastModified);
    const lines = [
      '  <url>',
      `    <loc>${loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
    ];
    if (route.changeFrequency) {
      lines.push(`    <changefreq>${escapeXml(route.changeFrequency)}</changefreq>`);
    }
    if (typeof route.priority === 'number') {
      const priority = Math.min(1, Math.max(0, route.priority)).toFixed(1);
      lines.push(`    <priority>${priority}</priority>`);
    }
    lines.push('  </url>');
    return lines.join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urlEntries,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * @param {string} siteUrl
 */
export function buildRobotsTxt(siteUrl) {
  const origin = siteUrl.replace(/\/+$/, '');
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /dashboard',
    'Disallow: /checkout',
    'Disallow: /register',
    'Disallow: /consulente',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

function resolveSiteUrl() {
  const raw = (process.env.SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL).trim();
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`SITE_URL inválida: "${raw}"`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`SITE_URL deve usar http ou https: "${raw}"`);
  }
  return `${parsed.protocol}//${parsed.host}`;
}

function main() {
  if (!SITEMAP_ROUTES.length) {
    throw new Error('SITEMAP_ROUTES está vazio — adicione ao menos uma rota pública.');
  }

  const siteUrl = resolveSiteUrl();
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const sitemapPath = path.join(PUBLIC_DIR, 'sitemap.xml');
  const robotsPath = path.join(PUBLIC_DIR, 'robots.txt');

  const sitemapXml = buildSitemapXml(siteUrl, SITEMAP_ROUTES);
  const robotsTxt = buildRobotsTxt(siteUrl);

  fs.writeFileSync(sitemapPath, sitemapXml, 'utf8');
  fs.writeFileSync(robotsPath, robotsTxt, 'utf8');

  console.log(`[sitemap] ${siteUrl} — ${SITEMAP_ROUTES.length} URL(s)`);
  for (const route of SITEMAP_ROUTES) {
    console.log(`  • ${toAbsoluteUrl(siteUrl, route.path)}`);
  }
  console.log(`[sitemap] escrito: ${path.relative(ROOT, sitemapPath)}`);
  console.log(`[sitemap] escrito: ${path.relative(ROOT, robotsPath)}`);
}

main();
