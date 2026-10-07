import assert from 'node:assert/strict';
import test from 'node:test';
import { isDiretorioListingIndexable } from '../lib/diretorioQuality';
import { buildLocalBusinessJsonLd, buildTerreiroPrerenderPage } from '../lib/diretorioSeoShared';
import worker from '../cloudflare/marketing-preview-worker.js';

const house = { slug: 'ile-asipa', nome: 'Ilê Asipá', cidade: 'Salvador', estado: 'BA', endereco: 'R. da Gratidão, 8 - Piatã, Salvador - BA', cidadeSlug: 'salvador', cidadeUrl: '/terreiros/ba/salvador', telefone: null, fotoUrl: null, linkMaps: null };
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
