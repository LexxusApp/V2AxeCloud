import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const directoryLoader = readFileSync(new URL('../src/lib/diretorioSnapshot.ts', import.meta.url), 'utf8');

test('cidade consulta o endpoint dedicado antes do snapshot geral', () => {
  const loaderBody = directoryLoader.match(/export async function loadDiretorioCidadeDetail[\s\S]*?\n\}/)?.[0] || '';
  const apiPosition = loaderBody.indexOf('fetchDiretorioCidade(estado, cidadeSlug)');
  const snapshotPosition = loaderBody.indexOf('fetchDiretorioCidadeSnapshot(estado, cidadeSlug, signal)');

  assert.ok(apiPosition >= 0, 'consulta dedicada da cidade não encontrada');
  assert.ok(snapshotPosition > apiPosition, 'snapshot geral deve ser apenas contingência');
});
