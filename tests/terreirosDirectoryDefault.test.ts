import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../cinematic-site/terreiros.html', import.meta.url), 'utf8');

test('/terreiros abre sem filtro e apresenta o diretório nacional', () => {
  assert.match(page, /<input id="buscar"[^>]+placeholder="Ex\.: Campinas ou Pai Joaquim" \/>/);
  assert.doesNotMatch(page, /<input id="buscar"[^>]+value="Campinas"/);
  assert.match(page, /<h2 id="results-title">Casas em todo o Brasil<\/h2>/);
  assert.match(page, /<a id="results-link" href="\/terreiros" hidden>/);
  assert.doesNotMatch(page, /const campinas = cidades\.find/);
  assert.match(page, /await pontosPromise;\s*await carregaTodos\(\);/);
});

test('filtros de UF e cidade da URL continuam preservados', () => {
  assert.match(page, /if \(cidadeDaUrl\)/);
  assert.match(page, /await carregaCidade\(uf, cidadeDaUrl\.cidadeSlug\)/);
  assert.match(page, /if \(ufParam\)/);
  assert.match(page, /await carregaEstado\(estadoDaUrl\.estado\.toLowerCase\(\)\)/);
});
