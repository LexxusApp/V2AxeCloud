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
import { isClearlyOutsideDiretorioScope } from '../lib/diretorioQuality.ts';

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
});
