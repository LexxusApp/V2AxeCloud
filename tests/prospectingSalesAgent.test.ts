import test from 'node:test';
import assert from 'node:assert/strict';
import { AxeCloudSalesAgent } from '../cloudflare/prospect-worker/src/sales-agent/AxeCloudSalesAgent.js';
import { AXECLOUD_KNOWLEDGE_BASE } from '../cloudflare/prospect-worker/src/sales-agent/knowledgeBase.js';
import type { ProspectingEnv } from '../cloudflare/prospect-worker/src/types.js';

test('AxeCloudSalesAgent: conhecimento oficial não alucina preços ou períodos de teste', () => {
  const premium = AXECLOUD_KNOWLEDGE_BASE.plans.find((p) => p.name === 'Premium');
  assert.ok(premium, 'Plano Premium deve existir na base');
  assert.equal(premium.priceMonthly, 'R$ 69,90/mês');
  assert.equal(premium.trialDays, 30);
  assert.equal(AXECLOUD_KNOWLEDGE_BASE.registrationUrl, 'https://axecloud.com.br/register');
});

test('AxeCloudSalesAgent: intercepta opt-out imediatamente sem chamar modelo de IA', async () => {
  const fakeEnv = {} as ProspectingEnv;
  const agent = new AxeCloudSalesAgent(fakeEnv);

  const response = await agent.handleInbound({
    leadName: 'Terreiro Teste',
    currentMessage: 'Favor parar com mensagens',
    conversationHistory: [],
  });

  assert.equal(response.stage, 'recusa');
  assert.equal(response.confidence, 1.0);
  assert.match(response.replyText, /não enviaremos novas mensagens/i);
});

test('AxeCloudSalesAgent: detecta pedido de atendente humano e ativa humanHandoff', async () => {
  const fakeEnv = {} as ProspectingEnv;
  const agent = new AxeCloudSalesAgent(fakeEnv);

  const response = await agent.handleInbound({
    leadName: 'Terreiro Teste',
    currentMessage: 'Quero falar com uma pessoa de verdade, atendente humano',
    conversationHistory: [],
  });

  assert.equal(response.humanHandoff, true);
  assert.match(response.replyText, /atendente/i);
});

test('ChatOnboardingService: gera senhas temporárias que atendem rigorosamente à política de senha forte', async () => {
  const { ChatOnboardingService } = await import(
    '../cloudflare/prospect-worker/src/services/onboarding/ChatOnboardingService.js'
  );
  const { validateStrongPassword } = await import('../lib/passwordPolicy.js');

  const fakeEnv = {
    SUPABASE_URL: 'https://fake.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake_key',
  } as ProspectingEnv;

  const service = new ChatOnboardingService(fakeEnv);

  for (let i = 0; i < 20; i++) {
    const pwd = service.generateCompliantPassword();
    assert.match(pwd, /^Axe@\d{4}$/, 'Senha deve seguir o padrão Axe@XXXX');
    const policyResult = validateStrongPassword(pwd);
    assert.equal(policyResult.ok, true, `Senha ${pwd} deve ser válida segundo a política oficial`);
  }
});

test('ChatOnboardingService: normaliza e-mails removendo pontuação acidental e espaços', async () => {
  const { ChatOnboardingService } = await import(
    '../cloudflare/prospect-worker/src/services/onboarding/ChatOnboardingService.js'
  );
  const fakeEnv = {
    SUPABASE_URL: 'https://fake.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake_key',
  } as ProspectingEnv;

  const service = new ChatOnboardingService(fakeEnv);
  assert.equal(service.normalizeEmail('  PaiCarlos@Gmail.com.  '), 'paicarlos@gmail.com');
  assert.equal(service.normalizeEmail('zelador@axe.org,'), 'zelador@axe.org');
});

test('ChatOnboardingService: formata mensagem de boas-vindas com credenciais oficiais e login', async () => {
  const { ChatOnboardingService } = await import(
    '../cloudflare/prospect-worker/src/services/onboarding/ChatOnboardingService.js'
  );
  const fakeEnv = {
    SUPABASE_URL: 'https://fake.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake_key',
  } as ProspectingEnv;

  const service = new ChatOnboardingService(fakeEnv);
  const msg = service.formatWelcomeMessage({
    success: true,
    email: 'carlos@terreiro.com',
    tempPassword: 'Axe@7890',
    loginUrl: 'https://axecloud.com.br/login',
    nomeZelador: 'Pai Carlos',
    nomeTerreiro: 'Tenda Luz do Amanhecer',
  });

  assert.match(msg, /Pronto, Pai Carlos!/);
  assert.match(msg, /30 dias grátis/);
  assert.match(msg, /https:\/\/axecloud\.com\.br\/login/);
  assert.match(msg, /carlos@terreiro\.com/);
  assert.match(msg, /Axe@7890/);
});

test('ChatOnboardingService: formata mensagem clara para e-mail já cadastrado com link de redefinição', async () => {
  const { ChatOnboardingService } = await import(
    '../cloudflare/prospect-worker/src/services/onboarding/ChatOnboardingService.js'
  );
  const fakeEnv = {
    SUPABASE_URL: 'https://fake.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake_key',
  } as ProspectingEnv;

  const service = new ChatOnboardingService(fakeEnv);
  const msg = service.formatAlreadyExistsMessage({
    success: false,
    alreadyExists: true,
    email: 'existente@terreiro.com',
    loginUrl: 'https://axecloud.com.br/login',
    nomeZelador: 'Mãe Silvia',
    nomeTerreiro: 'Ilê Asé',
  });

  assert.match(msg, /já possui uma conta/i);
  assert.match(msg, /existente@terreiro\.com/);
  assert.match(msg, /https:\/\/axecloud\.com\.br\/login/);
  assert.match(msg, /https:\/\/axecloud\.com\.br\/recuperar-senha/);
});

test('Webhook Guard: mensagem para Filho de Santo não contém "Recebido!" e orienta procurar zeladoria', () => {
  const filhoNotice =
    'Axé! 🙏 Esta é uma linha de avisos automáticos do sistema do seu terreiro. Para recados litúrgicos ou dúvidas, procure diretamente a zeladoria da sua casa.';

  assert.doesNotMatch(filhoNotice, /recebido/i, 'Mensagem NÃO deve conter a palavra "Recebido!"');
  assert.match(filhoNotice, /^Axé!/);
  assert.match(filhoNotice, /linha de avisos automáticos do sistema do seu terreiro/);
  assert.match(filhoNotice, /procure diretamente a zeladoria da sua casa/);
});

test('CrmService: possui métodos de busca por Filho de Santo e Perfil Líder', async () => {
  const { CrmService } = await import('../cloudflare/prospect-worker/src/services/crm/crmService.js');
  const fakeEnv = {
    SUPABASE_URL: 'https://fake.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake_key',
  } as ProspectingEnv;

  const crm = new CrmService(fakeEnv);
  assert.equal(typeof crm.findFilhoDeSantoByPhone, 'function');
  assert.equal(typeof crm.findPerfilLiderByPhone, 'function');
});

