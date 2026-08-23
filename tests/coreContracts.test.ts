import assert from 'node:assert/strict';
import test from 'node:test';
import { validateStrongPassword } from '../lib/passwordPolicy.ts';
import {
  excludeObrigacaoEvents,
  isObrigacaoEvent,
} from '../src/lib/calendarEventFilters.ts';
import {
  normalizeWhatsAppTemplates,
  WHATSAPP_TEMPLATE_DEFAULTS,
  WHATSAPP_TEMPLATE_ORDER,
} from '../src/constants/whatsappTemplates.ts';
import { isValidUuid, normalizeQueryTenantId } from '../api/lib/tenantAccess.ts';
import { parseGoogleMapsCoordinates } from '../lib/diretorioCoordinates.ts';
import {
  isClearlyOutsideDiretorioScope,
  isDiretorioListingIndexable,
  isDiretorioListingPublishable,
  isDiretorioPriorityIndexSlug,
} from '../lib/diretorioQuality.ts';

test('política de senha rejeita cada requisito ausente e aceita senha forte', () => {
  assert.equal(validateStrongPassword('Curta1!').ok, false);
  assert.equal(validateStrongPassword('SEMFRASE1!').ok, false);
  assert.equal(validateStrongPassword('semmaiuscula1!').ok, false);
  assert.equal(validateStrongPassword('SemNumero!').ok, false);
  assert.equal(validateStrongPassword('SemSimbolo1').ok, false);
  assert.deepEqual(validateStrongPassword('AxeCloud@2026'), { ok: true });
});

test('obrigações ficam fora do calendário geral sem remover giras', () => {
  const events = [
    { id: 'gira', tipo: 'Gira' },
    { id: 'obrigacao', tipo: 'Obrigação' },
    { id: 'sem-tipo' },
  ];

  assert.equal(isObrigacaoEvent(events[1]), true);
  assert.deepEqual(
    excludeObrigacaoEvents(events).map((event) => event.id),
    ['gira', 'sem-tipo'],
  );
});

test('templates de WhatsApp sempre normalizam todas as categorias suportadas', () => {
  const normalized = normalizeWhatsAppTemplates({ dados_acesso: 'Template personalizado' });

  assert.equal(normalized.dados_acesso, 'Template personalizado');
  assert.deepEqual(Object.keys(normalized), WHATSAPP_TEMPLATE_ORDER);
  for (const key of WHATSAPP_TEMPLATE_ORDER) {
    assert.ok(normalized[key].trim());
    assert.ok(WHATSAPP_TEMPLATE_DEFAULTS[key].trim());
  }
});

test('escopo de tenant aceita somente UUID válido e normaliza query string', () => {
  assert.equal(isValidUuid('6588b6c9-ce84-4140-a69a-f487a0c61dab'), true);
  assert.equal(isValidUuid('6588b6c9-ce84-7140-a69a-f487a0c61dab'), false);
  assert.equal(normalizeQueryTenantId([' tenant-1 ', 'tenant-2']), 'tenant-1');
  assert.equal(normalizeQueryTenantId('undefined'), '');
});

test('coordenadas do Google Maps aceitam formatos públicos e rejeitam valores inválidos', () => {
  assert.deepEqual(
    parseGoogleMapsCoordinates('https://www.google.com/maps/place/Casa/@-23.55052,-46.633308,15z'),
    { lat: -23.55052, lng: -46.633308 },
  );
  assert.deepEqual(
    parseGoogleMapsCoordinates('https://www.google.com/maps/data=!3d-22.906847!4d-43.172896'),
    { lat: -22.906847, lng: -43.172896 },
  );
  assert.equal(parseGoogleMapsCoordinates('https://www.google.com/maps?q=999.0,999.0'), null);
  assert.equal(parseGoogleMapsCoordinates('https://www.google.com/maps?q=0.0,0.0'), null);
  assert.equal(parseGoogleMapsCoordinates('https://www.google.com/maps/place/X/@0,0,15z'), null);
});

test('diretório rejeita anúncios comerciais sem excluir casas de axé', () => {
  assert.equal(
    isClearlyOutsideDiretorioScope('Mãe Yara d’Ogum Especialista em União de Casais'),
    true,
  );
  assert.equal(
    isClearlyOutsideDiretorioScope('Jogo de Búzios - Consulta com Dona Mulambo'),
    true,
  );
  assert.equal(isClearlyOutsideDiretorioScope('Ilè Asé Igbá Odé'), false);
  assert.equal(isClearlyOutsideDiretorioScope('Tenda de Umbanda Estrela de Aruanda'), false);
  assert.equal(
    isClearlyOutsideDiretorioScope('Próximo a Tenda Espírita Encontro das Águas'),
    true,
  );
  assert.equal(isClearlyOutsideDiretorioScope('Terreiro Cultural do Viaduto de Madureira'), true);
  assert.equal(isClearlyOutsideDiretorioScope('Terreiro de Ideias: Arte e Comunicação'), true);
  assert.equal(isClearlyOutsideDiretorioScope('Confraria do Impossível'), true);
  assert.equal(isClearlyOutsideDiretorioScope('Casa de Velas Jardim de Cima'), true);
  assert.equal(isClearlyOutsideDiretorioScope('Loja do Axé e Artigos Religiosos'), true);
  assert.equal(isClearlyOutsideDiretorioScope('Casa'), true);
  assert.equal(isClearlyOutsideDiretorioScope('Omo Arô Cia Cultural'), true);
  assert.equal(isClearlyOutsideDiretorioScope('Prefeitura de São Sebastião do Alto'), true);
  assert.equal(isClearlyOutsideDiretorioScope('Escola de Atabaque Ritmos da Umbanda'), true);
  assert.equal(isClearlyOutsideDiretorioScope('MuseUmbanda'), true);
  assert.equal(isClearlyOutsideDiretorioScope('Bazar dos Orixás'), true);
  assert.equal(isClearlyOutsideDiretorioScope('Centro Espírita de Valença - CEV'), true);
  // O nome sozinho não distingue uma casa umbandista histórica de um centro
  // kardecista; essa decisão é feita na importação com o contexto do Maps.
  assert.equal(isClearlyOutsideDiretorioScope('Centro Espírita Amor e Verdade'), false);
  assert.equal(isClearlyOutsideDiretorioScope('Centro Espírita Caboclo Sete Flechas'), false);
  assert.equal(isClearlyOutsideDiretorioScope('Mesquita Al-Nur'), true);
  assert.equal(isClearlyOutsideDiretorioScope('Casa das Velas São Jorge'), true);
  assert.equal(
    isDiretorioListingPublishable({
      nome: 'Cantagalo',
      slug: 'cantagalo',
      cidade: 'Cantagalo',
      estado: 'RJ',
      endereco: 'Cantagalo - RJ',
    }),
    false,
  );
  assert.equal(
    isDiretorioListingPublishable({
      nome: 'Mesquita da Paz',
      slug: 'mesquita-da-paz',
      cidade: 'São Paulo',
      estado: 'SP',
      endereco: 'Rua Exemplo, 100 - Centro',
    }),
    false,
  );
  assert.equal(
    isDiretorioListingIndexable({
      nome: 'Casa São Jorge',
      slug: 'casa-sao-jorge',
      cidade: 'São Paulo',
      estado: 'SP',
      endereco: 'Rua das Flores, 123 - Centro',
      link_maps: 'https://maps.google.com/?q=-23.5,-46.6',
    }),
    false,
  );
  assert.equal(
    isDiretorioListingIndexable({
      nome: 'Tenda de Umbanda Estrela Guia',
      slug: 'tenda-umbanda-estrela-guia',
      cidade: 'São Paulo',
      estado: 'SP',
      endereco: 'Rua das Flores, 123 - Centro',
      telefone: '(11) 99999-0000',
      foto_url: 'https://cdn.example/foto.jpg',
    }),
    true,
  );
  assert.equal(
    isDiretorioListingIndexable({
      nome: 'Ilê Axé Odé',
      slug: 'ile-axe-ode',
      cidade: 'Salvador',
      estado: 'BA',
      endereco: 'Rua do Axé, 45 - Liberdade',
      telefone: '(71) 99999-0000',
      foto_url: 'https://cdn.example/foto.jpg',
    }),
    true,
  );
  assert.equal(
    isDiretorioListingIndexable({
      nome: 'Tenda de Umbanda Estrela Guia',
      slug: 'tenda-umbanda-estrela-guia',
      cidade: 'São Paulo',
      estado: 'SP',
      endereco: 'Rua das Flores, 123 - Centro',
      telefone: '(11) 99999-0000',
    }),
    false,
  );
  assert.equal(
    isDiretorioPriorityIndexSlug('e-u-j-a-espaco-universalista-dr-jose-de-arimateia'),
    true,
  );
  assert.equal(
    isDiretorioListingIndexable({
      nome: 'E.U.J.A(Espaço Universalista Dr. José De Arimateia)',
      slug: 'e-u-j-a-espaco-universalista-dr-jose-de-arimateia',
      cidade: 'Sorocaba',
      estado: 'SP',
      endereco: 'R. Santa Catarina, 72 - Vila Augusta, Sorocaba - SP, 18040-125',
      telefone: '015996958720',
      foto_url: '/api/v1/public/diretorio/foto/e-u-j-a-espaco-universalista-dr-jose-de-arimateia?v=2',
      link_maps: 'https://www.google.com/maps/place/E.U.J.A',
    }),
    true,
  );
});
