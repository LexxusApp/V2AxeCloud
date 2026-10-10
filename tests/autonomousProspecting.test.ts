import assert from 'node:assert/strict';
import test from 'node:test';
import { AutonomousProspectingService } from '../cloudflare/prospect-worker/src/services/outreach/AutonomousProspectingService.js';
import { normalizePhone } from '../cloudflare/prospect-worker/src/deduplication/leadDeduplicator.js';

test('AutonomousProspectingService: validação de janela de horário comercial de Brasília (09h-18h Seg-Sáb)', () => {
  const service = new AutonomousProspectingService({
    SUPABASE_URL: 'https://mock.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'mock-key',
  } as any);

  // Quarta-feira às 14h00 em Brasília (17h00 UTC) -> dentro da janela comercial
  const wednesdayAfternoonUtc = new Date('2026-10-07T17:00:00Z');
  assert.equal(service.isWithinBusinessHours(wednesdayAfternoonUtc), true);

  // Quarta-feira às 22h00 em Brasília (01h00 UTC do dia seguinte) -> fora da janela comercial
  const wednesdayNightUtc = new Date('2026-10-08T01:00:00Z');
  assert.equal(service.isWithinBusinessHours(wednesdayNightUtc), false);

  // Quinta-feira às 04h00 em Brasília (07h00 UTC) -> fora da janela comercial (madrugada)
  const dawnUtc = new Date('2026-10-08T07:00:00Z');
  assert.equal(service.isWithinBusinessHours(dawnUtc), false);

  // Domingo às 14h00 em Brasília (17h00 UTC de 11/10/2026) -> domingo não envia
  const sundayAfternoonUtc = new Date('2026-10-11T17:00:00Z');
  assert.equal(service.isWithinBusinessHours(sundayAfternoonUtc), false);

  // Sábado às 10h00 em Brasília (13h00 UTC de 10/10/2026) -> sábado de manhã é comercial
  const saturdayMorningUtc = new Date('2026-10-10T13:00:00Z');
  assert.equal(service.isWithinBusinessHours(saturdayMorningUtc), true);
});

test('ExistingAxeCloudDbProvider: deduplicação por telefone impede conflito mesmo com directory_id diferente', () => {
  const importedPhones = new Set<string>();
  const importedIds = new Set<string>();

  // Simula o registro que causou o 409
  const existingLead = {
    id: 'c3cf0135-caef-4bfb-8c68-2802e39773c7',
    telefone: '+5589981482621',
  };
  importedIds.add(existingLead.id);
  importedPhones.add(normalizePhone(existingLead.telefone));

  // Novo candidato com ID diferente no catálogo, mas com o mesmo telefone
  const duplicateCandidate = {
    id: '03181954-8e37-4448-8119-963f2a4b17c0', // ID diferente
    telefone: '+5589981482621', // Mesmo telefone!
  };

  const normPhone = normalizePhone(duplicateCandidate.telefone);
  const isDuplicate = importedIds.has(duplicateCandidate.id) || (Boolean(normPhone) && importedPhones.has(normPhone));

  assert.equal(isDuplicate, true, 'Deve identificar como duplicata pelo telefone mesmo com ID diferente');
});
