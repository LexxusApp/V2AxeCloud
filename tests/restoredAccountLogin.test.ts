import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateStrongPassword } from '../lib/passwordPolicy.js';

test('política de senha valida senha forte para conta restaurada', () => {
  assert.equal(validateStrongPassword('fraca').ok, false);
  assert.equal(validateStrongPassword('SemNumeroOuSimbolo!').ok, false);
  assert.equal(validateStrongPassword('Axe2026@77!').ok, true);
  assert.equal(validateStrongPassword('Terreiro@2026!').ok, true);
});

test('Login.tsx contém detecção e apresentação do card de conta restaurada', () => {
  const loginSrc = readFileSync(path.resolve('src/views/Login.tsx'), 'utf-8');

  // Verifica integração do check de conta restaurada
  assert.match(loginSrc, /check-restored-account/);
  assert.match(loginSrc, /setup-restored-password/);
  assert.match(loginSrc, /restoredAccount/);

  // Verifica presença dos elementos do card de acolhimento ao zelador
  assert.match(loginSrc, /Conta identificada & restaurada/);
  assert.match(loginSrc, /formatZeladorGreeting/);
  assert.match(loginSrc, /Seu acesso foi restaurado com sucesso/);
  assert.match(loginSrc, /Salvar nova senha e entrar/);
});

test('onboardingRoutes.ts exporta e registra endpoints de restauração de conta', () => {
  const routesSrc = readFileSync(path.resolve('api/lib/onboardingRoutes.ts'), 'utf-8');

  assert.match(routesSrc, /\/api\/v1\/auth\/check-restored-account/);
  assert.match(routesSrc, /\/api\/v1\/auth\/setup-restored-password/);
  assert.match(routesSrc, /restored_pending_password_setup/);
  assert.match(routesSrc, /checkPasswordExposure/);
  assert.match(routesSrc, /validateStrongPassword/);
});
