import test from 'node:test';
import assert from 'node:assert/strict';
import { OptInGuard } from '../cloudflare/prospect-worker/src/whatsapp/optInGuard.js';
import type { ProspectingLead } from '../cloudflare/prospect-worker/src/types.js';

test('OptInGuard: detecção de palavras-chave de opt-out', () => {
  assert.equal(OptInGuard.isOptOutMessage('Por favor, parar com essas mensagens'), true);
  assert.equal(OptInGuard.isOptOutMessage('Não quero receber nada'), true);
  assert.equal(OptInGuard.isOptOutMessage('Remover meu número agora'), true);
  assert.equal(OptInGuard.isOptOutMessage('SAIR'), true);
  assert.equal(OptInGuard.isOptOutMessage('Cancelar envio'), true);
  assert.equal(OptInGuard.isOptOutMessage('Sem interesse, obrigado'), true);

  assert.equal(OptInGuard.isOptOutMessage('Olá, quero saber mais sobre o sistema'), false);
  assert.equal(OptInGuard.isOptOutMessage('Quanto custa a mensalidade?'), false);
  assert.equal(OptInGuard.isOptOutMessage('Axé! Como funciona o teste?'), false);
});

test('OptInGuard: impede envio para número em blacklist', () => {
  const lead: ProspectingLead = {
    id: 'lead-1',
    name: 'Terreiro Teste',
    phone: '11999999999',
    source: 'manual',
    status: 'discovered',
    score: 80,
    whatsapp_opt_in: true,
  };

  const check = OptInGuard.canSendMessage(lead, true);
  assert.equal(check.allowed, false);
  assert.match(check.reason || '', /blacklist/i);
});

test('OptInGuard: impede envio para lead sem consentimento (opt-in = false)', () => {
  const lead: ProspectingLead = {
    id: 'lead-2',
    name: 'Terreiro Teste 2',
    phone: '11999999999',
    source: 'google_places',
    status: 'discovered',
    score: 90,
    whatsapp_opt_in: false,
  };

  const check = OptInGuard.canSendMessage(lead, false);
  assert.equal(check.allowed, false);
  assert.match(check.reason || '', /opt-in/i);
});

test('OptInGuard: impede envio para lead marcado como do_not_contact', () => {
  const lead: ProspectingLead = {
    id: 'lead-3',
    name: 'Terreiro Teste 3',
    phone: '11999999999',
    source: 'existing_axecloud_database',
    status: 'do_not_contact',
    score: 85,
    whatsapp_opt_in: true,
  };

  const check = OptInGuard.canSendMessage(lead, false);
  assert.equal(check.allowed, false);
  assert.match(check.reason || '', /do_not_contact/i);
});

test('OptInGuard: autoriza envio quando há opt-in e não está em blacklist', () => {
  const lead: ProspectingLead = {
    id: 'lead-4',
    name: 'Terreiro Autorizado',
    phone: '11999999999',
    source: 'manual',
    status: 'qualified',
    score: 85,
    whatsapp_opt_in: true,
  };

  const check = OptInGuard.canSendMessage(lead, false);
  assert.equal(check.allowed, true);
});
