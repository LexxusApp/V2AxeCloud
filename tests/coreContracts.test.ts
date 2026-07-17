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
