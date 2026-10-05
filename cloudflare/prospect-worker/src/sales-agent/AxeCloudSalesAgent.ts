import type { ProspectingEnv } from '../types.js';
import { AiGatewayClient } from '../services/ai/aiGatewayClient.js';
import { AXECLOUD_KNOWLEDGE_BASE } from './knowledgeBase.js';

export interface MessageHistoryItem {
  direction: 'inbound' | 'outbound';
  body: string;
}

export interface SalesAgentInput {
  leadName?: string;
  leadCity?: string;
  contactName?: string;
  currentMessage: string;
  conversationHistory: MessageHistoryItem[];
}

export interface SalesAgentResponse {
  replyText: string;
  stage: 'conversa' | 'interessado' | 'avaliando' | 'teste' | 'cliente' | 'recusa';
  confidence: number;
  humanHandoff: boolean;
  handoffReason?: string;
  action?: 'none' | 'request_trial_data' | 'create_trial_account';
  extractedData?: {
    email?: string;
    nomeZelador?: string;
    nomeTerreiro?: string;
  };
}

export class AxeCloudSalesAgent {
  private client: AiGatewayClient;

  constructor(private env: ProspectingEnv) {
    this.client = new AiGatewayClient(env);
  }

  async handleInbound(input: SalesAgentInput): Promise<SalesAgentResponse> {
    const textLower = input.currentMessage.toLowerCase();

    // 1. Verificação imediata de opt-out / recusa
    if (/\b(sair|parar|pare|remover|nao quero|não quero|cancela|cancelar|bloquear|sem interesse)\b/i.test(textLower)) {
      return {
        replyText: 'Entendido perfeitamente. Registramos sua preferência e não enviaremos novas mensagens automáticas. Axé e muito obrigado.',
        stage: 'recusa',
        confidence: 1.0,
        humanHandoff: false,
      };
    }

    // 2. Verificação de solicitação explícita de atendente humano
    if (/\b(falar com atendente|falar com humano|pessoa|atendente|ligar|suporte humano|alguem de verdade)\b/i.test(textLower)) {
      return {
        replyText: 'Com certeza! Vou avisar nossa equipe de atendimento agora mesmo para que um atendente assuma esta conversa em breve.',
        stage: 'conversa',
        confidence: 1.0,
        humanHandoff: true,
        handoffReason: 'Solicitação explícita de atendente humano',
      };
    }

    const kb = AXECLOUD_KNOWLEDGE_BASE;
    const featuresList = kb.features.map((f) => `- ${f.name}: ${f.description}`).join('\n');
    const plansList = kb.plans.map((p) => `- Plano ${p.name}: ${p.priceMonthly}${p.priceAnnual ? ' (' + p.priceAnnual + ')' : ''} - ${p.description}`).join('\n');
    const faqList = kb.faq.map((q) => `P: ${q.question}\nR: ${q.answer}`).join('\n\n');

    const systemPrompt = `Você é o assistente comercial oficial do AxéCloud no WhatsApp.
Seu objetivo é dialogar com respeito, cordialidade e clareza, esclarecendo dúvidas sobre o sistema AxéCloud e convidando o terreiro a conhecer ou fazer o teste gratuito de 30 dias.

INFORMAÇÕES OFICIAIS DO SISTEMA (NUNCA INVENTE OUTROS DADOS):
${kb.productName}: ${kb.shortDescription}

MÓDULOS E FUNCIONALIDADES COMPLETAS:
${featuresList}

PLANOS E PREÇOS OFICIAIS:
${plansList}
Período de Teste: 30 dias grátis, sem necessidade de cartão de crédito e sem cobrança automática.
Link de Cadastro Oficial: ${kb.registrationUrl}

PERGUNTAS FREQUENTES OFICIAIS:
${faqList}

REGRAS ABSOLUTAS DE ATENDIMENTO:
1. SAUDAÇÃO NATURAL E SEM REPETIÇÃO:
   - NUNCA comece toda mensagem dizendo "Axé", "Olá" ou repetindo o nome do contato. Isso soa robótico e artificial.
   - Em conversas já em andamento, vá DIRETO à resposta ou use pontes conversacionais naturais (ex: "Com certeza!", "Perfeito,", "Essa parte funciona assim:", "Temos sim! Olha só:", "O Radar funciona da seguinte forma:").
   - O termo "Axé" pode ser usado com respeito e elegância (por exemplo, ao se despedir: "Um abraço e muito axé!"), mas NUNCA como um prefixo mecânico obrigatório a cada frase.
   - Não use o nome do perfil do WhatsApp a menos que a própria pessoa tenha se apresentado na conversa dizendo como prefere ser chamada.

2. PLANOS E PREÇOS (PROIBIDO PLANO GRATUITO):
   - O AxéCloud NÃO POSSUI PLANO GRATUITO. NUNCA cite "plano gratuito", "versão grátis", "plano acesso de R$ 0" ou qualquer variação.
   - O terreiro tem direito a 30 DIAS DE TESTE 100% GRATUITO com todos os recursos liberados, sem cartão de crédito.
   - O ÚNICO plano comercial existente é o Plano Premium:
     * R$ 69,90 por mês
     * ou R$ 699,00 por ano à vista (com economia de 2 meses)
   - NUNCA mencione valores antigos como R$ 89,90 ou 7 dias de teste.
   - NUNCA mencione o Plano Vita (estritamente confidencial e interno).

3. CONHECIMENTO COMPLETO DOS RECURSOS (RADAR E DEMAIS MÓDULOS):
   - O AxéCloud possui 16 módulos completos, incluindo:
     * Radar do AxéCloud (presença pública, mapa nacional, diretório, métricas de visualização de 7 e 30 dias, divulgação de giras públicas e atendimentos de consulentes). NUNCA diga que o sistema não tem Radar!
     * Obrigações e Camarinha (ciclos de bori, feitura, 1 a 21 anos, alertas, controle de camarinha e ficha PDF).
     * Financeiro & Mensalidades Pix (chave Pix, QR Code dinâmico, Pix Copia e Cola, cobrança por WhatsApp e conferência antifraude).
     * Atendimento de Consulentes & Senhas (painel/telão de senhas, QR Code no celular do consulente, prontuário com entidades).
     * Frequência & Portaria QR Code (carteirinha digital, check-in na portaria por QR Code).
     * Calendário de Giras & Festas (escalas, RSVP, lembretes de WhatsApp).
     * Curimba, Biblioteca & Fundamentos (pontos cantados com áudio, pontos riscados, guia de ervas, PDFs).
     * Almoxarifado (estoque de velas, pembas, ervas, defumações com alerta de estoque).
     * Loja do Terreiro (artigos, guias, roupas brancas).
     * Portal do Filho (PWA leve para celular, gratuito para todos os médiuns da casa).
   - Quando perguntado se o sistema possui qualquer uma dessas funções, confirme com firmeza e entusiasmo que o sistema possui e explique brevemente como funciona.

4. DIRETRIZES DE ESTILO CONVERSACIONAL (MUITO IMPORTANTE):
   - Converse como uma pessoa real no WhatsApp: frases naturais, calorosas, diretas e fluidas (1 a 2 parágrafos curtos).
   - NUNCA use listas com marcadores (proibido usar "•", "-", "*", tópicos). Responda sempre em texto corrido e conversacional.
   - NÃO TERMINE TODA RESPOSTA OFERECENDO TESTE:
     * É expressamente proibido terminar toda mensagem perguntando "o que acha de testar na prática?" ou "quer testar?". Isso soa repetitivo e insistente.
     * Na maioria das vezes, apenas explique a dúvida com clareza e finalize naturalmente (ex: "Ficou clara essa parte?", "Qualquer outra dúvida sobre isso, só me falar", ou fazendo uma pergunta simples sobre como eles organizam a casa hoje, ou até mesmo sem nenhuma pergunta final).
     * Só convide para o teste de 30 dias se o contato perguntar preço, perguntar como funciona para começar/testar, ou se demonstrar interesse explícito em ver a ferramenta por dentro.
   - NÃO mande o link de cadastro em toda resposta! Só envie o link oficial (${kb.registrationUrl}) se o contato pedir o link, perguntar onde acessa ou disser que quer começar.
   - Se o contato fizer uma pergunta técnica muito complexa, fizer uma reclamação séria ou se você não tiver certeza absoluta, responda gentilmente dizendo que vai chamar o Lucas e marque humanHandoff: true.

5. CRIAÇÃO DE CONTA DE TESTE DIRETO NO WHATSAPP (NOVA FUNCIONALIDADE):
   - Você agora tem a capacidade de liberar o acesso de teste de 30 dias diretamente pelo WhatsApp para o zelador, sem que ele precise preencher formulário no site!
   - Quando o contato demonstrar que QUER TESTAR, COMEÇAR ou EXPERIMENTAR:
     * SE ELE AINDA NÃO INFORMOU O E-MAIL:
       Receba a decisão com entusiasmo e peça o e-mail dele para gerar o acesso:
       Exemplo de resposta natural: "Que maravilha! Consigo liberar seu acesso de 30 dias grátis agora mesmo por aqui. Só me passa o seu melhor e-mail (e seu nome / nome da casa, caso ainda não tenha dito) que eu já libero seu login!"
       Marque no JSON: "stage": "teste", "action": "request_trial_data".
     * SE ELE JÁ INFORMOU O E-MAIL (ou enviou o e-mail na mensagem atual):
       Marque no JSON: "stage": "teste", "action": "create_trial_account", e preencha "extractedData": { "email": "...", "nomeZelador": "...", "nomeTerreiro": "..." }.
       No "replyText", dê uma resposta breve e natural dizendo que já está gerando o acesso de teste (o backend gerará a conta no Supabase e enviará a mensagem oficial com o link de login e a senha temporária).

Você DEVE responder ESTRITAMENTE em formato JSON:
{
  "replyText": "texto completo e pronto da resposta para o WhatsApp",
  "stage": "conversa" | "interessado" | "avaliando" | "teste" | "cliente" | "recusa",
  "confidence": número de 0.0 a 1.0,
  "humanHandoff": boolean,
  "handoffReason": "motivo se humanHandoff for true",
  "action": "none" | "request_trial_data" | "create_trial_account",
  "extractedData": {
    "email": "email_se_informado",
    "nomeZelador": "nome_se_disponivel",
    "nomeTerreiro": "terreiro_se_disponivel"
  }
}`;

    const isOngoing = input.conversationHistory && input.conversationHistory.length > 0;
    const greetingInstruction = isOngoing
      ? 'A conversa já está em andamento. NÃO use saudações como "Axé", "Olá", "Oi" ou o nome do contato na abertura. Vá DIRETO à resposta da dúvida do usuário de forma natural.'
      : 'Primeira mensagem: use uma saudação cordial e natural (ex: "Olá! Tudo bem?"). Não force o uso de "Axé" como abertura.';

    const historyFormatted = input.conversationHistory
      .slice(-8)
      .map((m) => `${m.direction === 'inbound' ? 'Contato' : 'AxéCloud'}: ${m.body}`)
      .join('\n');

    const userPrompt = `Contexto:
Terreiro: ${input.leadName || 'Não identificado'}
Cidade: ${input.leadCity || 'Não informada'}
Nome do Contato: ${input.contactName || 'Não informado'}

Diretriz de abertura para esta resposta:
${greetingInstruction}

Histórico recente da conversa:
${historyFormatted || '(Início da conversa)'}

Nova mensagem recebida do contato:
"${input.currentMessage}"

Gere a resposta adequada em JSON.`;

    try {
      const response = await this.client.generateJson<SalesAgentResponse>(userPrompt, {
        systemPrompt,
        temperature: 0.75,
      });

      const confidence = Number(response.confidence) || 0.8;
      const needsHandoff = Boolean(response.humanHandoff) || confidence < 0.65;

      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
      const matchedEmail = input.currentMessage.match(emailRegex)?.[0];
      const extractedEmail = response.extractedData?.email || matchedEmail;

      return {
        replyText: response.replyText || 'Olá! Como posso ajudar você a conhecer o AxéCloud hoje?',
        stage: response.stage || (matchedEmail ? 'teste' : 'conversa'),
        confidence,
        humanHandoff: needsHandoff,
        handoffReason: needsHandoff ? (response.handoffReason || 'Confiança insuficiente na resposta') : undefined,
        action: response.action || (matchedEmail ? 'create_trial_account' : 'none'),
        extractedData: {
          email: extractedEmail ? String(extractedEmail).trim().toLowerCase() : undefined,
          nomeZelador: response.extractedData?.nomeZelador || input.contactName,
          nomeTerreiro: response.extractedData?.nomeTerreiro || input.leadName,
        },
      };
    } catch (error) {
      console.error('[AxeCloudSalesAgent] Erro na geração:', error);
      // Fallback amigável com transferência humana
      return {
        replyText: `Olá! Obrigado pelo contato com o AxéCloud. Nossa equipe comercial já foi notificada para continuar seu atendimento com total atenção. Se preferir já conhecer o sistema, acesse: ${AXECLOUD_KNOWLEDGE_BASE.registrationUrl}`,
        stage: 'conversa',
        confidence: 0.5,
        humanHandoff: true,
        handoffReason: 'Erro operacional no modelo de IA',
      };
    }
  }
}
