import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { sendWhatsAppForTenant } from '../api/lib/whatsappSendCore.js';
import { handleWhatsappRoute } from '../api/lib/whatsappRouter.js';

test('teste do terreiro é bloqueado antes de consultar dados ou enviar à Meta', async () => {
  for (const tipo of ['teste', ' TESTE ']) {
    await assert.rejects(
      sendWhatsAppForTenant(null as any, { tenantId: 'never-used', tipo }),
      (error: any) => error.statusCode === 410,
    );
  }
});

test('endpoint antigo retorna 410 sem autenticar ou disparar', async () => {
  for (const method of ['POST', 'GET']) {
    let status = 0;
    let body = '';
    const res = {
      status(value: number) { status = value; return this; },
      setHeader() { return this; },
      end(value: string) { body = value; },
    };
    await handleWhatsappRoute('test-message', { method, body: {} }, res);
    assert.equal(status, 410);
    assert.equal(JSON.parse(body).code, 'WHATSAPP_TEST_DISABLED');
  }
});

test('as duas telas do zelador não oferecem nem chamam envio de teste', () => {
  for (const path of ['src/components/settings/SettingsWhatsAppPanel.tsx', 'src/views/WhatsAppConfig.tsx']) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /test-message|handleTestMessage|handleTestToPhone|Enviar teste|Testar envio/);
  }
  const settings = readFileSync('src/views/Settings.tsx', 'utf8');
  assert.doesNotMatch(settings, /requested === 'teste'/);
});

test('cadastro e reivindicação preservam boas-vindas sem teste automático', () => {
  const onboarding = readFileSync('api/lib/tenantOnboarding.ts', 'utf8');
  const welcome = readFileSync('api/lib/welcomeMessage.ts', 'utf8');
  const register = readFileSync('src/views/Register.tsx', 'utf8');
  assert.match(onboarding, /dispatchZeladorWelcomeWhatsApp/);
  assert.match(welcome, /tipo: "boas_vindas_zelador"/);
  for (const source of [onboarding, welcome, register]) {
    assert.doesNotMatch(source, /test-message|tipo:\s*["']teste["']|Paz e Luz, Teste/);
  }
});

test('teste de suporte do admin fica isolado do endpoint do zelador', () => {
  const admin = readFileSync('api/admin-console-routes.ts', 'utf8');
  assert.match(admin, /\/api\/admin-console\/whatsapp\/test-message/);
  const edge = readFileSync('cloudflare/api-container-worker.ts', 'utf8');
  assert.match(edge, /WHATSAPP_TEST_DISABLED/);
});
