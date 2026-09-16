import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const generatedRobots = readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
const siteHomeRobots = readFileSync(new URL('../site-next/public/robots.txt', import.meta.url), 'utf8');
const generator = readFileSync(new URL('../scripts/generate-sitemap.mjs', import.meta.url), 'utf8');
const directoryRoutes = readFileSync(new URL('../api/lib/diretorioPublicRoutes.ts', import.meta.url), 'utf8');

for (const [label, content] of [
  ['app', generatedRobots],
  ['site-home', siteHomeRobots],
] as const) {
  test(`robots do ${label} libera somente as fotos públicas dentro de /api`, () => {
    assert.match(content, /^Allow: \/api\/v1\/public\/diretorio\/foto\/$/m);
    assert.match(content, /^Disallow: \/api\/$/m);
  });

  test(`robots do ${label} permite rastrear /register para ler o noindex`, () => {
    assert.doesNotMatch(content, /^Disallow: \/register\/?$/m);
  });
}

test('gerador preserva a política de robots nos próximos builds', () => {
  assert.match(generator, /'Allow: \/api\/v1\/public\/diretorio\/foto\/'/);
  assert.match(generator, /'Disallow: \/api\/'/);
  assert.doesNotMatch(generator, /'Disallow: \/register'/);
});

test('foto externa expirada responde como recurso ausente, não como falha do servidor', () => {
  const photoRoute = directoryRoutes.match(/app\.get\("\/api\/v1\/public\/diretorio\/foto\/:slug"[\s\S]*?\n  \}\);/)?.[0] || '';
  assert.match(photoRoute, /if \(!photo\)[\s\S]*?res\.status\(404\)\.end\(\)/);
  assert.doesNotMatch(photoRoute, /if \(!photo\)[\s\S]*?res\.status\(502\)\.end\(\)/);
});
