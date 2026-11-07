import assert from 'node:assert/strict';
import test from 'node:test';
import { canReadLibraryMaterial, libraryMaterialResponse, parseLibraryAudience } from '../lib/libraryAudience.js';

const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
test('acervo privado exige destinatário válido e não cai para público em entrada inválida', () => {
  assert.throws(() => parseLibraryAudience({ visibilidade: 'private', destinatarios: [first] }));
  assert.throws(() => parseLibraryAudience({ visibilidade: 'individual', destinatarios: [] }));
  assert.throws(() => parseLibraryAudience({ visibilidade: 'individual', destinatarios: ['local-1'] }));
  assert.deepEqual(parseLibraryAudience({ visibilidade: 'individual', destinatarios: [first, first] }).destinatarios, [first]);
});
test('somente o destinatário exato e a gestão autorizada leem material individual', () => {
  const material = { visibilidade: 'individual', destinatarios: [first] };
  assert.equal(canReadLibraryMaterial(material, { manager: false, memberId: first }), true);
  assert.equal(canReadLibraryMaterial(material, { manager: false, memberId: second }), false);
  assert.equal(canReadLibraryMaterial(material, { manager: false, memberId: null }), false);
  assert.equal(canReadLibraryMaterial({ visibilidade: 'desconhecida' }, { manager: false, memberId: first }), false);
  assert.equal(canReadLibraryMaterial(material, { manager: true, memberId: null }), true);
});
test('compatibilidade do acervo legado compartilhado e limpeza de URLs assinadas/destinatários', () => {
  assert.equal(canReadLibraryMaterial({}, { manager: false, memberId: second }), true);
  const material = { visibilidade: 'individual', destinatarios: [first], storage_path: 'casa/livro.pdf', arquivo_url: 'https://signed.example.invalid/document' };
  const response = libraryMaterialResponse(material, { manager: false, memberId: first });
  assert.equal(response.arquivo_url, '');
  assert.equal('destinatarios' in response, false);
  assert.equal(material.arquivo_url, 'https://signed.example.invalid/document');
  const legacy = libraryMaterialResponse({ arquivo_url: 'https://storage.invalid/storage/v1/object/sign/biblioteca_estudos/casa/legado.pdf?token=old', storage_path: null }, { manager: false, memberId: second });
  assert.equal(legacy.arquivo_url, '');
  assert.equal(legacy.storage_path, 'casa/legado.pdf');
  const pilot = libraryMaterialResponse({ arquivo_url: '/api/pilot/library/pdf-proxy?path=casa%2Fprivado.pdf', storage_path: null }, { manager: true, memberId: null });
  assert.equal(pilot.arquivo_url, '');
  assert.equal(pilot.storage_path, 'casa/privado.pdf');
});
