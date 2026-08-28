import assert from 'node:assert/strict';
import test from 'node:test';

import { STATIC_SITEMAP_PATHS, PUBLIC_SITE_SHELL_LASTMOD, buildSitemapXml, buildTerreiroPrerenderPage, staticSitemapRoutes } from '../lib/diretorioSeoShared';
import { omitSelectColumn, selectColumnFromSchemaError } from '../lib/diretorioQuery';
import { PUBLIC_PRERENDER_PAGES } from '../src/constants/seoPublicPages';
import { FEATURE_PAGE_PATHS } from '../src/constants/featurePagesContent';
import { COMMERCIAL_PAGE_PATHS } from '../src/constants/commercialPagesContent';

const RESOURCE_PATHS = [
  '/recursos',
  ...FEATURE_PAGE_PATHS,
] as const;

test('sitemap não publica páginas utilitárias e não contém rotas duplicadas', () => {
  const paths = STATIC_SITEMAP_PATHS.map((route) => route.path);
  assert.equal(paths.includes('/entrar'), false);
  assert.equal(new Set(paths).size, paths.length);
});

test('fallback estático do sitemap é XML válido e inclui rotas comerciais', () => {
  const routes = staticSitemapRoutes();
  const xml = buildSitemapXml('https://axecloud.com.br', routes);
  assert.match(xml, /^<\?xml version="1.0"/);
  assert.match(xml, /<urlset /);
  assert.match(xml, /https:\/\/axecloud\.com\.br\/recursos</);
  assert.match(xml, /https:\/\/axecloud\.com\.br\/por-que-axecloud</);
  assert.equal(xml.includes('/entrar'), false);
});

test('select do diretório remove coluna ausente do PostgREST', () => {
  assert.equal(
    selectColumnFromSchemaError({ message: "Could not find the 'verified_at' column of 'terreiros_diretorio'", code: 'PGRST204' }),
    'verified_at',
  );
  assert.equal(
    omitSelectColumn('nome, verified_at, slug', 'verified_at'),
    'nome, slug',
  );
});

test('páginas públicas atualizadas declaram lastmod atual', () => {
  for (const path of ['/', '/conteudo', '/por-que-axecloud', '/terreiros', '/eventos', ...COMMERCIAL_PAGE_PATHS, ...RESOURCE_PATHS]) {
    const route = STATIC_SITEMAP_PATHS.find((item) => item.path === path);
    assert.ok(route, `rota ausente: ${path}`);
    assert.equal(route.lastModified, PUBLIC_SITE_SHELL_LASTMOD, `lastmod incorreto: ${path}`);
  }
});

test('cluster comercial tem páginas únicas, indexáveis e com dados estruturados', () => {
  const pages = COMMERCIAL_PAGE_PATHS.map((path) => {
    const page = PUBLIC_PRERENDER_PAGES.find((item) => item.path === path);
    assert.ok(page, `página comercial ausente: ${path}`);
    assert.notEqual(page.robots, 'noindex, follow');
    const blocks = Array.isArray(page.jsonLd) ? page.jsonLd : [page.jsonLd];
    assert.ok(blocks.some((block) => block?.['@type'] === 'FAQPage'), `FAQ schema ausente: ${path}`);
    assert.ok(blocks.some((block) => block?.['@type'] === 'BreadcrumbList'), `breadcrumb schema ausente: ${path}`);
    return page;
  });
  assert.equal(new Set(pages.map((page) => page.title)).size, COMMERCIAL_PAGE_PATHS.length);
  assert.equal(new Set(pages.map((page) => page.description)).size, COMMERCIAL_PAGE_PATHS.length);
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

test('E.U.J.A. tem HTML crawler único e indexável', () => {
  const page = buildTerreiroPrerenderPage(
    {
      slug: 'e-u-j-a-espaco-universalista-dr-jose-de-arimateia',
      nome: 'E.U.J.A(Espaço Universalista Dr. José De Arimateia)',
      endereco: 'R. Santa Catarina, 72 - Vila Augusta, Sorocaba - SP, 18040-125',
      telefone: '015996958720',
      fotoUrl: '/api/v1/public/diretorio/foto/e-u-j-a-espaco-universalista-dr-jose-de-arimateia?v=2',
      linkMaps: 'https://www.google.com/maps/place/E.U.J.A',
      cidade: 'Sorocaba',
      estado: 'SP',
      cidadeSlug: 'sorocaba',
      cidadeUrl: '/terreiros/sp/sorocaba',
    },
    { indexable: true },
  );

  assert.equal(page.robots, 'index, follow');
  assert.match(page.title, /Sorocaba/);
  assert.match(page.intro, /Vila Augusta/);
  assert.ok(page.sections.some((section) => /Como visitar o E\.U\.J\.A/i.test(section.heading)));
  assert.ok(page.listLinks?.some((link) => link.href === '/terreiros/sp/sorocaba'));
});
