import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildZeladorNavEntries } from '../src/constants/appNav';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('gestão avançada mantém os oito registros privados e relatórios autenticados', () => {
  const api = read('api/lib/advancedManagementRoutes.ts');
  const migration = read('supabase/migrations/20260823153000_gestao_avancada.sql');
  const nav = read('src/constants/appNav.ts');

  for (const resource of ['patrimonio', 'documentos', 'consulentes', 'atendimentos', 'caminhada', 'liturgico', 'desenvolvimento', 'camarinha']) {
    assert.match(api, new RegExp(`"${resource}"`));
    assert.match(migration, new RegExp(`'${resource}'`));
  }
  assert.match(api, /requireAuthOrRespond/);
  assert.match(api, /assertZeladorOrGlobalAdmin/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on public\.gestao_registros from anon, authenticated/i);
  assert.match(nav, /label: 'Visão da casa'/);
  assert.match(nav, /label: 'Atendimentos'/);
  assert.match(nav, /label: 'Formação da corrente'/);
  assert.match(nav, /label: 'Secretaria da casa'/);
});

test('gestão avançada permanece fora do menu do zelador', () => {
  const entries = buildZeladorNavEntries('umbanda');
  assert.equal(entries.some((entry) => entry.type === 'management'), false);
});

test('catálogo público anuncia 24 módulos sem incluir recursos adiados', () => {
  const catalog = read('src/constants/landingModules.ts');
  const entries = catalog.match(/\blive: true,/g) || [];
  assert.equal(entries.length, 24);
  assert.doesNotMatch(catalog, /Equipe e permissões/i);
  assert.doesNotMatch(catalog, /Carteirinha digital/i);
});

test('documentos usam upload privado em vez de campo de link', () => {
  const api = read('api/lib/advancedManagementRoutes.ts');
  const view = read('src/views/AdvancedManagement.tsx');

  assert.match(api, /\/api\/v1\/gestao\/documentos\/upload-url/);
  assert.match(api, /createSignedUploadUrl/);
  assert.match(api, /createSignedUrl/);
  assert.match(api, /DOCUMENT_MAX_BYTES = 20 \* 1024 \* 1024/);
  assert.match(view, /type="file"/);
  assert.match(view, /uploadToSignedUrl/);
  assert.doesNotMatch(view, /label: 'Link seguro do arquivo'/);
});
