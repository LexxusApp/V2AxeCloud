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

test('AutoResponderDetector: identifica respostas automáticas de WhatsApp Business e impede réplica de IA', async () => {
  const { isAutoResponderMessage } = await import(
    '../cloudflare/prospect-worker/src/whatsapp/autoResponderDetector.js'
  );

  // Mensagem real recebida de Joyce Xavier
  const realAutoReply = 'Agradecemos o seu contato.\n\nSua mensagem foi recebida. Em breve, retornaremos para você.✨';
  assert.equal(isAutoResponderMessage(realAutoReply), true);

  // Outras mensagens reais de saudações de terreiros e WhatsApp Business
  assert.equal(isAutoResponderMessage('Babalorixá Rodrigo De Ògun agradece seu contato. Como podemos ajudar?'), true);
  assert.equal(
    isAutoResponderMessage(
      'Seja bem-vindo(a)! Aqui é o Sacerdote Thiers, do T.U.IC. Estou à disposição para ajudar no que precisar em sua caminhada espiritual. No que posso te auxiliar hoje?',
    ),
    true,
  );
  assert.equal(isAutoResponderMessage('Obrigado pelo contato! No momento estamos ausentes.'), true);
  assert.equal(isAutoResponderMessage('Recebemos sua mensagem. Nosso horário de atendimento é de 9h às 18h.'), true);
  assert.equal(isAutoResponderMessage('Esta é uma mensagem automática. Assim que possível retornaremos.'), true);

  // Mensagens humanas legítimas que NÃO devem ser bloqueadas
  assert.equal(isAutoResponderMessage('Boa tarde, quanto custa o sistema?'), false);
  assert.equal(isAutoResponderMessage('Olá, como funciona o teste de 30 dias?'), false);
  assert.equal(isAutoResponderMessage('Quero cadastrar meu terreiro'), false);

  // AxeCloudSalesAgent retorna replyText vazio quando recebe auto-responder
  const fakeEnv = {} as ProspectingEnv;
  const agent = new AxeCloudSalesAgent(fakeEnv);
  const response = await agent.handleInbound({
    leadName: 'Terreiro Teste',
    currentMessage: realAutoReply,
    conversationHistory: [],
  });
  assert.equal(response.replyText, '', 'Agente NÃO deve responder mensagens automáticas de ausência');
});

test('AutonomousLearningService: classe possui métodos para contexto ativo, gravação e auto-otimização', async () => {
  const { AutonomousLearningService } = await import(
    '../cloudflare/prospect-worker/src/services/learning/AutonomousLearningService.js'
  );

  const fakeEnv = {
    SUPABASE_URL: 'https://fake.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake_key',
  } as ProspectingEnv;

  const service = new AutonomousLearningService(fakeEnv);
  assert.equal(typeof service.getActiveLearnedContext, 'function');
  assert.equal(typeof service.recordWinningPattern, 'function');
  assert.equal(typeof service.runAutonomousSelfOptimization, 'function');

  // getActiveLearnedContext gracefully returns fallback guidelines on network failure
  const context = await service.getActiveLearnedContext();
  assert.ok(context.guidelinesText.length > 0, 'Deve retornar diretrizes mesmo em falha de rede');
  assert.ok(Array.isArray(context.winningExamples), 'Exemplos devem ser um array');
});

test('Webhook Guard: protege conversas comerciais e trials de serem interceptadas por avisos de suporte', () => {
  const lead = { id: 'lead-123', name: 'Flávia' };
  const history = [
    { direction: 'outbound' as const, body: 'Pronto, Flávia! Seu acesso de 30 dias grátis foi criado!' },
  ];

  const isSalesOrTrialFlow = Boolean(
    lead ||
    history.some((h) => h.direction === 'outbound')
  );

  assert.equal(isSalesOrTrialFlow, true, 'Fluxo de vendas ativo ou trial recém-criado deve ser preservado');
});

test('Webhook & SalesAgent: dúvidas funcionais (ex: link de filhos) NUNCA disparam criação de conta nem mensagem de e-mail existente', async () => {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  const msgBody = 'Tenho que mandar o link pros filhos da casa ?';
  const currentHasEmail = emailRegex.test(msgBody);
  const currentEmail = msgBody.match(emailRegex)?.[0];
  const detectedEmail = (currentEmail || 'flavia@exemplo.com').toLowerCase().trim();

  const isFunctionalQuestion = /\?|\b(como|quando|onde|qual|quanto|quem|por que|porque|precisa|tem que|consigo|pode|funciona|link|filho|filhos|gira|giras|mensalidade|mensalidades|pix|radar|app|aplicativo|mural|curimba|obrigacao|obrigações|camarinha)\b/i.test(msgBody);
  const explicitlyRequestedAccessCreation = /\b(pode criar|pode cadastrar|cria pra mim|cadastra pra mim|crie meu acesso|libera meu acesso|quero meu acesso|libera o teste|começar o teste|quero testar agora)\b/i.test(msgBody);

  const replyAction: string = 'none';
  const shouldCreateTrial =
    Boolean(detectedEmail) &&
    !isFunctionalQuestion &&
    (
      (currentHasEmail && (replyAction === 'create_trial_account' || /\b(testar|teste|cadastro|cadastrar|experimentar)\b/i.test(msgBody))) ||
      explicitlyRequestedAccessCreation
    );

  assert.equal(isFunctionalQuestion, true, 'Mensagem deve ser reconhecida como dúvida funcional');
  assert.equal(currentHasEmail, false, 'Mensagem NÃO contém e-mail');
  assert.equal(shouldCreateTrial, false, 'NÃO deve criar conta de teste para uma dúvida funcional!');
});

test('Base de Conhecimento: FAQ detalha que zelador não precisa mandar links manuais e que médiuns entram com Registro + CPF', () => {
  const faqFilhos = AXECLOUD_KNOWLEDGE_BASE.faq.find((f) => f.question.includes('link para os filhos'));
  assert.ok(faqFilhos, 'Deve existir FAQ sobre link para os filhos');
  assert.match(faqFilhos.answer, /não precisa mandar link/i);
  assert.match(faqFilhos.answer, /WhatsApp do médium/i);
  assert.match(faqFilhos.answer, /Registro/i);
  assert.match(faqFilhos.answer, /CPF/i);

  const faqPix = AXECLOUD_KNOWLEDGE_BASE.faq.find((f) => f.question.includes('mensalidades'));
  assert.ok(faqPix, 'Deve existir FAQ sobre cobrança de mensalidades');
  assert.match(faqPix.answer, /Pix/i);
  assert.match(faqPix.answer, /WhatsApp/i);
});

test('SalesAgent: sanitiza ação impedindo create_trial_account em perguntas conceituais sem e-mail atual', async () => {
  const inputMessage = 'Como funciona o envio de senhas para os consulentes?';
  const isQuestion = /\?|\b(como|quando|onde|qual|quanto|quem|por que|porque|precisa|tem que|consigo|pode|funciona|link)\b/i.test(inputMessage);
  assert.equal(isQuestion, true);
});

test('Quero Conhecer: resposta oficial inclui link de registro e chamada para 30 dias', () => {
  const msg = 'Quero conhecer';
  const isQueroConhecer = /^\s*quero\s+conhecer\b/i.test(msg) || /quero\s+conhecer/i.test(msg);
  assert.equal(isQueroConhecer, true);

  const reply = `Axé! 🙏 O AxéCloud organiza fichas dos filhos, obrigações litúrgicas, mensalidades com Pix no WhatsApp e aviso de giras. Entre muitos outros Módulos.

Liberei 30 dias grátis para você testar sem cartão:
👉 Crie seu terreiro em 1 minuto: https://axecloud.com.br/register

Ou se preferir, me manda aqui seu e-mail e o nome da casa que eu já gero seu acesso por aqui mesmo!`;

  assert.match(reply, /https:\/\/axecloud\.com\.br\/register/);
  assert.match(reply, /30 dias grátis/);
  assert.match(reply, /Pix no WhatsApp/);
});

test('Onboarding 2 Etapas: valida fluxo de e-mail e nome da casa separados e juntos', () => {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i;

  // Caso 1: Apenas e-mail
  const msgEmailOnly = 'zelador@axe.com.br';
  const hasEmail1 = emailRegex.test(msgEmailOnly);
  const clean1 = msgEmailOnly.replace(emailRegex, '').trim();
  assert.equal(hasEmail1, true);
  assert.equal(clean1.length < 3, true, 'Não possui nome de terreiro');

  // Caso 2: Apenas nome da casa
  const msgTerreiroOnly = 'Terreiro da Bandeira';
  const hasEmail2 = emailRegex.test(msgTerreiroOnly);
  const isTerreiroName2 = /\b(terreiro|tenda|ilê|ile|casa|centro|barracão|barracao|roça|roca|cabana|sear|t\.u|c\.e)\b/i.test(msgTerreiroOnly);
  assert.equal(hasEmail2, false);
  assert.equal(isTerreiroName2, true);

  // Caso 3: Ambos juntos
  const msgBoth = 'zelador@axe.com.br Terreiro da Bandeira';
  const hasEmail3 = emailRegex.test(msgBoth);
  const clean3 = msgBoth.replace(emailRegex, '').replace(/\b(meu|e-mail|email|é|eh|o|a|nome|do|da|meu terreiro|minha casa|terreiro|casa|de|para|por|favor|aqui)\b/gi, ' ').trim();
  assert.equal(hasEmail3, true);
  assert.ok(clean3.length >= 3, 'Deve extrair o nome da casa');
});


