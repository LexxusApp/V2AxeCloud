import assert from 'node:assert/strict';
import test from 'node:test';
import { isDiretorioListingIndexable, isDiretorioListingPublishable, isDiretorioRemovalBlocked } from '../lib/diretorioQuality';
import { buildLocalBusinessJsonLd, buildTerreiroPrerenderPage } from '../lib/diretorioSeoShared';
import worker from '../cloudflare/marketing-preview-worker.js';

const house = { slug: 'ile-asipa', nome: 'Ilê Asipá', cidade: 'Salvador', estado: 'BA', endereco: 'R. da Gratidão, 8 - Piatã, Salvador - BA', cidadeSlug: 'salvador', cidadeUrl: '/terreiros/ba/salvador', telefone: null, fotoUrl: null, linkMaps: null };
test('pedido de retirada impede publicação, indexação e novo slug da mesma instituição', () => {
  const removed = { ...house, slug: 'centro-espirita-lar-de-nana', nome: 'Centro Espírita Lar de Nanã', cidade: 'Belo Horizonte', estado: 'MG' };
  for (const row of [removed, { ...removed, slug: 'outro-slug' }]) {
    assert.equal(isDiretorioRemovalBlocked(row), true);
    assert.equal(isDiretorioListingPublishable(row), false);
    assert.equal(isDiretorioListingIndexable(row), false);
  }
  assert.equal(isDiretorioRemovalBlocked({ ...removed, slug: 'outra-instituicao', cidade: 'Salvador', estado: 'BA' }), false);
  assert.equal(isDiretorioListingIndexable(house), true);
});
test('URL removida retorna 410 antes dos assets, inclusive barra final, legado e Googlebot', async () => {
  const env = { PREVIEW_MODE: 'false', ASSETS: { fetch: async () => { throw new Error('Não deve consultar uma cópia antiga'); } } };
  for (const route of ['/terreiro/centro-espirita-lar-de-nana', '/terreiro/centro-espirita-lar-de-nana/', '/terreiros/centro-espirita-lar-de-nana']) {
    for (const agent of ['Mozilla/5.0', 'Googlebot']) {
      const response = await worker.fetch(new Request(`https://axecloud.com.br${route}`, { headers: { 'User-Agent': agent } }), env);
      assert.equal(response.status, 410);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
    }
  }
});
test('casas com endereço útil são indexáveis sem foto ou telefone', () => {
  assert.equal(isDiretorioListingIndexable(house), true);
  assert.equal(isDiretorioListingIndexable({ ...house, nome: 'Centro Cultural Esperança', tipo: 'terreiro' }), true);
  assert.equal(isDiretorioListingIndexable({ ...house, nome: 'Casa', endereco: 'Salvador' }), false);
  assert.equal(isDiretorioListingIndexable({ ...house, slug: 'associacao-araxa' }), false);
  const page = buildTerreiroPrerenderPage(house, { indexable: isDiretorioListingIndexable(house) });
  assert.equal(page.robots, 'index, follow');
});
test('dados estruturados conservam a imagem absoluta e telefone real', () => {
  const schema = buildLocalBusinessJsonLd({ ...house, fotoUrl: 'https://example.com/foto.jpg', telefone: '(71) 99999-0000' });
  assert.equal(schema.image, 'https://example.com/foto.jpg');
  assert.equal(schema.telephone, '(71) 99999-0000');
});
test('estado não é confundido com slug de perfil', async () => {
  const response = await worker.fetch(new Request('https://axecloud.com.br/terreiros/sp'), { PREVIEW_MODE: 'false' });
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('Location'), '/terreiros?uf=sp');
});
test('cidade legada aponta diretamente para sua URL canônica', async () => {
  const env = { PREVIEW_MODE: 'false', ASSETS: { fetch: async () => Response.json({ cidades: [{ estado: 'SP', cidadeSlug: 'suzano' }] }) } };
  const response = await worker.fetch(new Request('https://axecloud.com.br/terreiros/cidade/suzano'), env);
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('Location'), '/terreiros/sp/suzano');
});
test('perfil ausente retorna 404 tanto para visitante quanto Googlebot', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('Não encontrado', { status: 404 });
    const env = { PREVIEW_MODE: 'false', ASSETS: { fetch: async () => new Response('Not Found', { status: 404 }) }, API: { fetch: async () => new Response('Não encontrado', { status: 404 }) } };
    for (const agent of ['Mozilla/5.0', 'Googlebot']) {
      const response = await worker.fetch(new Request('https://axecloud.com.br/terreiro/ausente', { headers: { 'User-Agent': agent } }), env);
      assert.equal(response.status, 404);
    }
  } finally { globalThis.fetch = originalFetch; }
});
test('cidades, artigos e recursos ausentes não viram cópias da home com HTTP 200', async () => {
  const env = { PREVIEW_MODE: 'false', ASSETS: { fetch: async () => new Response('Not Found', { status: 404 }) }, API: { fetch: async () => new Response('Cidade não encontrada', { status: 404 }) } };
  for (const route of ['/terreiros/sp/cidade-ausente', '/conteudo/artigo-ausente', '/recursos/recurso-ausente']) {
    const response = await worker.fetch(new Request(`https://axecloud.com.br${route}`), env);
    assert.equal(response.status, 404);
    assert.equal((await response.text()).includes('rel="canonical"'), false);
  }
});
