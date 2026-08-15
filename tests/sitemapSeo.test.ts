import assert from 'node:assert/strict';
import test from 'node:test';

import { STATIC_SITEMAP_PATHS, PUBLIC_SITE_SHELL_LASTMOD } from '../lib/diretorioSeoShared';
import { PUBLIC_PRERENDER_PAGES } from '../src/constants/seoPublicPages';

const RESOURCE_PATHS = [
  '/recursos',
  '/recursos/financeiro-pix-mensalidades',
  '/recursos/calendario-giras',
  '/recursos/portal-filho-de-santo',
  '/recursos/whatsapp-oficial',
  '/recursos/app-pwa-terreiro',
] as const;

test('sitemap não publica páginas utilitárias e não contém rotas duplicadas', () => {
  const paths = STATIC_SITEMAP_PATHS.map((route) => route.path);
  assert.equal(paths.includes('/entrar'), false);
  assert.equal(new Set(paths).size, paths.length);
});

test('páginas públicas atualizadas declaram lastmod atual', () => {
  for (const path of ['/', '/conteudo', '/por-que-axecloud', '/terreiros', '/eventos', ...RESOURCE_PATHS]) {
    const route = STATIC_SITEMAP_PATHS.find((item) => item.path === path);
    assert.ok(route, `rota ausente: ${path}`);
    assert.equal(route.lastModified, PUBLIC_SITE_SHELL_LASTMOD, `lastmod incorreto: ${path}`);
  }
});

test('login é noindex e Recursos têm metadados únicos por URL', () => {
  const login = PUBLIC_PRERENDER_PAGES.find((page) => page.path === '/entrar');
  assert.equal(login?.robots, 'noindex, follow');

  const resources = RESOURCE_PATHS.map((path) => {
    const page = PUBLIC_PRERENDER_PAGES.find((item) => item.path === path);
    assert.ok(page, `prerender ausente: ${path}`);
    return page;
  });
  assert.equal(new Set(resources.map((page) => page.title)).size, RESOURCE_PATHS.length);
});
