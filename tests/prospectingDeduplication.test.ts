import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkLeadDuplicate,
  normalizePhone,
  extractDomain,
  normalizeInstagram,
  buildCompositeKey,
} from '../cloudflare/prospect-worker/src/deduplication/leadDeduplicator.js';

test('leadDeduplicator: normalização de telefone brasileiro', () => {
  assert.equal(normalizePhone('(11) 98765-4321'), '5511987654321');
  assert.equal(normalizePhone('+55 (11) 98765-4321'), '5511987654321');
  assert.equal(normalizePhone('011987654321'), '5511987654321');
  assert.equal(normalizePhone(''), '');
});

test('leadDeduplicator: extração de domínio', () => {
  assert.equal(extractDomain('https://www.terreirooxum.com.br/contato'), 'terreirooxum.com.br');
  assert.equal(extractDomain('http://axeoxala.org/'), 'axeoxala.org');
  // Redes sociais não devem ser consideradas domínio próprio de dedup
  assert.equal(extractDomain('https://instagram.com/terreiro'), '');
  assert.equal(extractDomain('https://facebook.com/axe'), '');
});

test('leadDeduplicator: normalização de Instagram', () => {
  assert.equal(normalizeInstagram('@tenda_pombagira'), 'tenda_pombagira');
  assert.equal(normalizeInstagram('https://instagram.com/axe_oxum_oficial/'), 'axe_oxum_oficial');
  assert.equal(normalizeInstagram('https://www.instagram.com/ile_ase?igsh=123'), 'ile_ase');
});

test('leadDeduplicator: detecta duplicata por google_place_id', () => {
  const candidate = {
    name: 'Ilê Asé Odé',
    google_place_id: 'ChIJ12345ABC',
    phone: '11999999999',
  };

  const existing = [
    { id: 'lead-1', name: 'Ilê Asé Odé Antigo', google_place_id: 'ChIJ12345ABC' },
  ];

  const result = checkLeadDuplicate(candidate, existing);
  assert.equal(result.isDuplicate, true);
  assert.equal(result.matchReason, 'google_place_id');
  assert.equal(result.matchedLeadId, 'lead-1');
});

test('leadDeduplicator: detecta duplicata por telefone', () => {
  const candidate = {
    name: 'Terreiro Pai Benedito',
    phone: '(11) 98765-4321',
  };

  const existing = [
    { id: 'lead-2', name: 'Centro Pai Benedito', phone_normalized: '5511987654321' },
  ];

  const result = checkLeadDuplicate(candidate, existing);
  assert.equal(result.isDuplicate, true);
  assert.equal(result.matchReason, 'phone');
  assert.equal(result.matchedLeadId, 'lead-2');
});

test('leadDeduplicator: detecta duplicata por website', () => {
  const candidate = {
    name: 'Terreiro Ogum Megê',
    website: 'https://www.ogummege.com.br',
  };

  const existing = [
    { id: 'lead-3', name: 'Templo Ogum Megê', website: 'http://ogummege.com.br/sobre' },
  ];

  const result = checkLeadDuplicate(candidate, existing);
  assert.equal(result.isDuplicate, true);
  assert.equal(result.matchReason, 'website');
  assert.equal(result.matchedLeadId, 'lead-3');
});

test('leadDeduplicator: detecta duplicata por Instagram', () => {
  const candidate = {
    name: 'Casa das Águas',
    instagram: '@casadasaguas.axe',
  };

  const existing = [
    { id: 'lead-4', name: 'Casa das Águas Antiga', instagram: 'https://instagram.com/casadasaguas.axe' },
  ];

  const result = checkLeadDuplicate(candidate, existing);
  assert.equal(result.isDuplicate, true);
  assert.equal(result.matchReason, 'instagram');
  assert.equal(result.matchedLeadId, 'lead-4');
});

test('leadDeduplicator: detecta duplicata por nome + cidade + endereço composto', () => {
  const candidate = {
    name: 'Tenda Espírita Vovó Maria Conga',
    city: 'Suzano',
    address: 'Rua das Flores, 120',
  };

  const existing = [
    {
      id: 'lead-5',
      name: 'Tenda Espírita Vovó Maria Conga',
      city: 'Suzano',
      address: 'Rua das Flores 120',
    },
  ];

  const result = checkLeadDuplicate(candidate, existing);
  assert.equal(result.isDuplicate, true);
  assert.equal(result.matchReason, 'composite_address');
  assert.equal(result.matchedLeadId, 'lead-5');
});

test('leadDeduplicator: permite cadastro quando não há duplicidade', () => {
  const candidate = {
    name: 'Novo Terreiro de Yansã',
    city: 'Salvador',
    state: 'BA',
    phone: '71988887777',
    website: 'https://yansa-salvador.com',
  };

  const existing = [
    { id: 'lead-6', name: 'Outro Terreiro', city: 'São Paulo', phone: '11911112222' },
  ];

  const result = checkLeadDuplicate(candidate, existing);
  assert.equal(result.isDuplicate, false);
});

test('leadDeduplicator: detecta duplicata por directory_id (catálogo AxéCloud)', () => {
  const candidate = {
    name: 'Ilê Asé Omin',
    directory_id: '123e4567-e89b-12d3-a456-426614174000',
  };

  const existing = [
    {
      id: 'lead-7',
      name: 'Ilê Asé Omin Antigo',
      directory_id: '123e4567-e89b-12d3-a456-426614174000',
    },
  ];

  const result = checkLeadDuplicate(candidate, existing);
  assert.equal(result.isDuplicate, true);
  assert.equal(result.matchReason, 'directory_id');
  assert.equal(result.matchedLeadId, 'lead-7');
});

test('leadDeduplicator: detecta duplicata por mesmo nome normalizado e mesma cidade', () => {
  const candidate = {
    name: 'Templo de Umbanda Caboclo Pena Branca',
    city: 'Curitiba',
  };

  const existing = [
    {
      id: 'lead-8',
      name: 'Templo de Umbanda Caboclo Pena Branca',
      city: 'Curitiba',
      address: 'Rua Desconhecida, 50',
    },
  ];

  const result = checkLeadDuplicate(candidate, existing);
  assert.equal(result.isDuplicate, true);
  assert.equal(result.matchReason, 'composite_address');
  assert.equal(result.matchedLeadId, 'lead-8');
});

