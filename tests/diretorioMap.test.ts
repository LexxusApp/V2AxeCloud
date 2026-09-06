import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchDiretorioMapPoints } from '../src/lib/diretorioMap.ts';

test('mapa destaca cadastro direto vinculado mesmo sem selo de verificação', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    v: 2,
    cities: ['Suzano'],
    ufs: ['SP'],
    s: ['casa-cadastrada'],
    n: ['Casa cadastrada'],
    c: [0],
    e: [0],
    a: [-2354000],
    o: [-4631000],
    r: [0],
    m: [1],
    i: [''],
  }), { status: 200 });

  try {
    const [point] = await fetchDiretorioMapPoints();
    assert.equal(point.verificada, false);
    assert.equal(point.gerenciada, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('payload antigo mantém perfil verificado em destaque', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    v: 2,
    cities: ['Mogi das Cruzes'],
    ufs: ['SP'],
    s: ['casa-verificada'],
    n: ['Casa verificada'],
    c: [0],
    e: [0],
    a: [-2352000],
    o: [-4619000],
    r: [1],
    i: [''],
  }), { status: 200 });

  try {
    const [point] = await fetchDiretorioMapPoints();
    assert.equal(point.verificada, true);
    assert.equal(point.gerenciada, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
