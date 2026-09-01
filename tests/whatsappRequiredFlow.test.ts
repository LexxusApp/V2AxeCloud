import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeBrazilPhone } from '../lib/brazilPhone';

test('normaliza WhatsApp brasileiro e rejeita número incompleto', () => {
  assert.equal(normalizeBrazilPhone('(71) 99999-9999'), '71999999999');
  assert.equal(normalizeBrazilPhone('+55 71 99999-9999'), '71999999999');
  assert.equal(normalizeBrazilPhone('(11) 3333-4444'), '1133334444');
  assert.equal(normalizeBrazilPhone('719999'), null);
  assert.equal(normalizeBrazilPhone(''), null);
});

test('cadastro exige WhatsApp também no servidor', () => {
  const register = readFileSync('src/views/Register.tsx', 'utf8');
  const onboarding = readFileSync('api/lib/tenantOnboarding.ts', 'utf8');
  assert.doesNotMatch(register, /WhatsApp[\s\S]{0,120}\(opcional\)/);
  assert.match(register, /normalizeBrazilPhone\(whatsapp\)/);
  assert.match(onboarding, /Informe um WhatsApp brasileiro válido com DDD/);
});

test('sino abre modal persistente e endpoint sincroniza conta, perfil e Radar', () => {
  const panel = readFileSync('src/components/NotificationPanel.tsx', 'utf8');
  const modal = readFileSync('src/components/CompleteWhatsAppModal.tsx', 'utf8');
  const route = readFileSync('api/lib/accountCredentialsRoutes.ts', 'utf8');
  assert.match(panel, /COMPLETE_WHATSAPP_NOTIF_ID/);
  assert.match(panel, /setWhatsappModalOpen\(true\)/);
  assert.match(modal, /\/api\/v1\/account\/whatsapp/);
  assert.match(route, /whatsapp_publico: whatsapp/);
  assert.match(route, /telefone: whatsapp/);
  assert.match(route, /updateUserById/);
});
