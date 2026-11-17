import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/marketing-preview-worker.js';

test('assets antigos ausentes retornam 404 sem um módulo substituto nem cache', async () => {
  for (const name of ['MatrizEditorialLayout-CzzGENKO.js', 'old-style.css']) {
    const response = await worker.fetch(new Request('https://axecloud.com.br/m-assets/' + name), {
      ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) },
    });
    assert.equal(response.status, 404);
    assert.match(response.headers.get('Cache-Control') || '', /no-store/);
    assert.equal(await response.text(), 'Not found');
  }
});

test('módulos existentes preservam código, exports e cache publicados', async () => {
  const source = 'export const M = "layout";';
  const response = await worker.fetch(new Request('https://axecloud.com.br/m-assets/current.js'), {
    ASSETS: { fetch: async () => new Response(source, { headers: {
      'Content-Type': 'text/javascript', 'Cache-Control': 'public, max-age=31536000, immutable',
    } }) },
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), source);
  assert.match(response.headers.get('Cache-Control') || '', /immutable/);
});
