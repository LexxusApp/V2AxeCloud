import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const nginxConfig = readFileSync(new URL('../deploy/nginx-marketing.conf', import.meta.url), 'utf8');
const directoryLoader = readFileSync(new URL('../src/lib/diretorioSnapshot.ts', import.meta.url), 'utf8');

test('cidade canônica mantém a URL e serve sua página dedicada', () => {
  assert.match(nginxConfig, /location ~ "\^\/terreiros\/\(\[A-Za-z\]\{2\}\)\/\(\[\^\/\]\+\)\/\?\$"/);
  assert.doesNotMatch(nginxConfig, /return 302 \/terreiros\?uf=\$1&cidade=\$2/);
  assert.match(nginxConfig, /# Cidades canônicas:[\s\S]*?try_files \$uri\/index\.html \/__react_shell\.html/);
});

test('perfil canônico serve o HTML pré-renderizado do próprio terreiro', () => {
  assert.match(nginxConfig, /location ~ \^\/terreiro\/\[\^\/\]\+\/\?\$/);
  assert.doesNotMatch(nginxConfig, /try_files \/terreiro\/index\.html/);
  assert.match(nginxConfig, /# Perfis canônicos:[\s\S]*?try_files \$uri\/index\.html \/__react_shell\.html/);
});

test('rota genérica antiga de perfil volta para o mapa novo', () => {
  assert.match(nginxConfig, /location = \/terreiro \{[\s\S]*?return 302 \/terreiros;/);
});

test('cidade consulta o endpoint dedicado antes do snapshot geral', () => {
  const loaderBody = directoryLoader.match(/export async function loadDiretorioCidadeDetail[\s\S]*?\n\}/)?.[0] || '';
  const apiPosition = loaderBody.indexOf('fetchDiretorioCidade(estado, cidadeSlug)');
  const snapshotPosition = loaderBody.indexOf('fetchDiretorioCidadeSnapshot(estado, cidadeSlug, signal)');

  assert.ok(apiPosition >= 0, 'consulta dedicada da cidade não encontrada');
  assert.ok(snapshotPosition > apiPosition, 'snapshot geral deve ser apenas contingência');
});
