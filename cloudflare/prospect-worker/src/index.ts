/**
 * Cloudflare Worker: axecloud-prospect-api
 * API REST Segura, Cloudflare Workflows, Cloudflare Queues e WhatsApp Webhook
 */

import type {
  ProspectingEnv,
  QueueEnrichmentMessage,
  QueueAiAnalysisMessage,
  QueueConversationMessage,
} from './types.js';
import { CrmService } from './services/crm/crmService.js';
import { LeadAnalyzer } from './services/ai/leadAnalyzer.js';
import { AxeCloudSalesAgent } from './sales-agent/AxeCloudSalesAgent.js';
import { MetaCloudClient } from './whatsapp/metaCloudClient.js';
import { OptInGuard } from './whatsapp/optInGuard.js';
import {
  handleMetaWebhookChallenge,
  verifyMetaHmacSha256,
  extractInboundMessagesFromMetaPayload,
  extractStatusesFromMetaPayload,
} from './whatsapp/webhookHandler.js';
import { ProspectingDiscoveryWorkflow } from './workflows/ProspectingDiscoveryWorkflow.js';
import { ProspectingLeadWorkflow } from './workflows/ProspectingLeadWorkflow.js';
import { listAvailableProviders } from './providers/providerRegistry.js';
import { FollowUpService } from './services/followup/FollowUpService.js';
import { ChatOnboardingService } from './services/onboarding/ChatOnboardingService.js';
import { AutonomousProspectingService } from './services/outreach/AutonomousProspectingService.js';

// Exporta as classes de Workflow para o runtime da Cloudflare
export { ProspectingDiscoveryWorkflow, ProspectingLeadWorkflow };

/**
 * Utilitário de autenticação JWT via Supabase Auth
 */
async function authenticateAdmin(
  request: Request,
  env: ProspectingEnv,
): Promise<{ ok: boolean; user?: { id: string; email?: string }; error?: string }> {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return { ok: false, error: 'Token de autorização não fornecido.' };
  }

  if (env.SUPABASE_SERVICE_ROLE_KEY && token === env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: true, user: { id: 'service-role', email: 'lucasilvasiqueira@outlook.com.br' } };
  }

  const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });

    if (!res.ok) {
      return { ok: false, error: 'Sessão inválida ou expirada.' };
    }

    const user = (await res.json()) as { id: string; email?: string };
    const email = (user.email || '').toLowerCase().trim();

    // Verificação de permissão de admin global
    const allowedEmails = (env.ADMIN_CONSOLE_EMAILS || env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (email && allowedEmails.includes(email)) {
      return { ok: true, user };
    }

    // Consulta perfil_lider no Supabase para verificar is_admin_global
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/perfil_lider?id=eq.${user.id}&select=is_admin_global&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );

    if (profileRes.ok) {
      const profiles = (await profileRes.json()) as Array<{ is_admin_global?: boolean }>;
      if (profiles && profiles[0]?.is_admin_global) {
        return { ok: true, user };
      }
    }

    return { ok: false, error: 'Acesso restrito a administradores autorizados do AxéCloud.' };
  } catch (e) {
    return { ok: false, error: `Falha ao validar credenciais: ${(e as Error).message}` };
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export default {
  async fetch(request: Request, env: ProspectingEnv, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // Trata preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Health check
    if (url.pathname === '/api/prospecting/health' || url.pathname === '/_health') {
      return jsonResponse({ status: 'ok', service: 'axecloud-prospect-api' });
    }

    const isMetaWebhook =
      url.pathname === '/api/prospecting/webhook/whatsapp' ||
      url.pathname === '/webhook/meta' ||
      url.pathname === '/api/whatsapp/webhook' ||
      url.pathname === '/api/whatsapp/webhook/';

    // Webhook Meta WhatsApp - GET Challenge
    if (isMetaWebhook && request.method === 'GET') {
      const verifyToken = String(env.WA_BUSINESS_TOKEN_WEBHOOK || '').trim();
      return handleMetaWebhookChallenge(url, verifyToken);
    }

    // Webhook Meta WhatsApp - POST Messages & Statuses
    if (isMetaWebhook && request.method === 'POST') {
      const rawBody = await request.text();
      const signature = request.headers.get('x-hub-signature-256');
      const appSecret = String(env.WA_META_APP_SECRET || '').trim();

      if (appSecret) {
        const isValid = await verifyMetaHmacSha256(rawBody, signature, appSecret);
        if (!isValid) {
          console.warn('[Webhook] Assinatura X-Hub-Signature-256 inválida');
          return new Response('Unauthorized', { status: 401 });
        }
      }

      let payload: any;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return new Response('Bad Request', { status: 400 });
      }

      const crm = new CrmService(env);

      // Processa atualizações de status de entrega (sent, delivered, read, failed)
      const statuses = extractStatusesFromMetaPayload(payload);
      for (const st of statuses) {
        ctx.waitUntil(
          crm
            .applyMessageStatusUpdate(st.externalId, st.status, st.errorCode, st.errorMessage)
            .catch((error) => console.error('[Webhook] Falha ao persistir status Meta:', error)),
        );
      }

      const inboundMessages = extractInboundMessagesFromMetaPayload(payload);

      for (const msg of inboundMessages) {
        ctx.waitUntil(
          (async () => {
            try {
              const convId = await crm.recordInboundAdminMessage(msg.from, msg.body, msg.externalId, msg.name);
              const lead = await crm.findLeadByPhone(msg.from);
              const isOptOut = OptInGuard.isOptOutMessage(msg.body);

              if (isOptOut) {
                await OptInGuard.handleOptOut(msg.from, lead ? lead.id : null, crm);
                const meta = new MetaCloudClient(env);
                if (meta.isConfigured()) {
                  const out = await meta.sendTextMessage(
                    msg.from,
                    'Entendido. Registramos sua preferência e você não receberá mais mensagens automáticas. Axé e muito obrigado.',
                  );
                  if (convId && out?.messageId) {
                    await crm.recordOutboundAdminMessage(
                      convId,
                      'Entendido. Registramos sua preferência e você não receberá mais mensagens automáticas. Axé e muito obrigado.',
                      out.messageId,
                    );
                  }
                }
                return;
              }

              // Carrega histórico para ter memória do diálogo
              const history = await crm.getAdminConversationHistory(msg.from, 8);

              // 2. Trava Inteligente: Verifica se o remetente é um Filho de Santo cadastrado no sistema
              const filho = await crm.findFilhoDeSantoByPhone(msg.from);
              if (filho) {
                console.log(`[Webhook] Remetente identificado como Filho de Santo (${filho.nome}, ID: ${filho.id}). Não aciona IA de vendas.`);
                const alreadyNotified = history.some(
                  (h) => h.direction === 'outbound' && h.body.includes('linha de avisos automáticos'),
                );
                if (!alreadyNotified) {
                  const filhoNotice =
                    'Axé! 🙏 Esta é uma linha de avisos automáticos do sistema do seu terreiro. Para recados litúrgicos ou dúvidas, procure diretamente a zeladoria da sua casa.';
                  const meta = new MetaCloudClient(env);
                  let outId: string | undefined;
                  if (meta.isConfigured()) {
                    const sendRes = await meta.sendTextMessage(msg.from, filhoNotice);
                    outId = sendRes?.messageId;
                  }
                  if (convId) {
                    await crm.recordOutboundAdminMessage(convId, filhoNotice, outId);
                  }
                }
                return;
              }

              // 3. Trava Inteligente: Verifica se o remetente já é um Zelador / Líder cadastrado no sistema
              const lider = await crm.findPerfilLiderByPhone(msg.from);
              if (lider) {
                console.log(`[Webhook] Remetente identificado como Zelador cadastrado (${lider.nome_terreiro}, ID: ${lider.id}). Não aciona IA de vendas.`);
                const alreadyNotified = history.some(
                  (h) => h.direction === 'outbound' && h.body.includes('zelador cadastrado'),
                );
                if (!alreadyNotified) {
                  const liderNotice =
                    'Axé! 🙏 Identificamos seu contato como zelador cadastrado no AxéCloud. Caso precise de suporte técnico ou queira falar com nossa equipe, acesse https://axecloud.com.br/login ou nos avise por aqui.';
                  const meta = new MetaCloudClient(env);
                  let outId: string | undefined;
                  if (meta.isConfigured()) {
                    const sendRes = await meta.sendTextMessage(msg.from, liderNotice);
                    outId = sendRes?.messageId;
                  }
                  if (convId) {
                    await crm.recordOutboundAdminMessage(convId, liderNotice, outId);
                  }
                }
                return;
              }

              // 1. Verificação se o lead clicou ou enviou "Quero conhecer"
              const isQueroConhecer = /^\s*quero\s+conhecer\b/i.test(msg.body) || /quero\s+conhecer/i.test(msg.body);

              // 2. Trava Inteligente: Verifica se o contato já possui terreiro/trial ativo
              const isAlreadyTrialOrCustomer = Boolean(
                lead?.status === 'trial' ||
                lead?.status === 'customer' ||
                lead?.terreiro_id
              );

              let replyToSend = '';
              let replyStage: 'conversa' | 'interessado' | 'avaliando' | 'teste' | 'cliente' | 'recusa' = 'conversa';
              let replyAction: 'none' | 'request_trial_data' | 'create_trial_account' = 'none';
              let replyConfidence = 1.0;
              let replyHumanHandoff = false;
              let onboardCreated = false;

              // Expressão para extração de e-mail
              const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i;
              const currentEmailMatch = msg.body.match(emailRegex);
              const currentEmail = currentEmailMatch ? currentEmailMatch[0].toLowerCase().trim() : null;

              // Busca e-mail no histórico recente enviado pelo contato
              let historyEmail: string | null = null;
              for (let i = history.length - 1; i >= 0; i--) {
                if (history[i].direction === 'inbound') {
                  const m = history[i].body.match(emailRegex);
                  if (m) {
                    historyEmail = m[0].toLowerCase().trim();
                    break;
                  }
                }
              }
              const resolvedEmail = currentEmail || historyEmail || null;

              // Pergunta funcional ou operacional sobre o sistema
              const isFunctionalQuestion = /\?|\b(como|quando|onde|qual|quanto|quem|por que|porque|precisa|tem que|consigo|pode|funciona|link|filho|filhos|gira|giras|mensalidade|mensalidades|pix|radar|app|aplicativo|mural|curimba|obrigacao|obrigações|camarinha)\b/i.test(msg.body);

              if (isQueroConhecer) {
                // RESPOSTA OFICIAL AO "QUERO CONHECER"
                replyToSend = `Axé! 🙏 O AxéCloud organiza fichas dos filhos, obrigações litúrgicas, mensalidades com Pix no WhatsApp e aviso de giras. Entre muitos outros Módulos.

Liberei 30 dias grátis para você testar sem cartão:
👉 Crie seu terreiro em 1 minuto: https://axecloud.com.br/register

Ou se preferir, me manda aqui seu e-mail e o nome da casa que eu já gero seu acesso por aqui mesmo!`;
                replyStage = 'interessado';
                replyAction = 'none';
              } else if (!isAlreadyTrialOrCustomer && !isFunctionalQuestion && !isOptOut) {
                // FLUXO DE COLETA DE DADOS EM 2 ETAPAS (E-MAIL + NOME DA CASA)
                let candidateTerreiroName: string | null = null;

                if (currentEmail) {
                  // O e-mail veio nesta mensagem. O restante da mensagem tem o nome da casa?
                  const cleanText = msg.body
                    .replace(emailRegex, '')
                    .replace(/\b(meu|e-mail|email|é|eh|o|a|nome|do|da|meu terreiro|minha casa|terreiro|casa|de|para|por|favor|aqui)\b/gi, ' ')
                    .replace(/[,:;\-]/g, ' ')
                    .trim();
                  if (cleanText.length >= 3 && !/^(ok|sim|nao|não|valeu|obrigad[oa])$/i.test(cleanText)) {
                    candidateTerreiroName = cleanText;
                  }
                } else if (historyEmail) {
                  // E-mail já veio em mensagem anterior. Esta mensagem atual é o nome da casa?
                  const textClean = msg.body.trim();
                  if (textClean.length >= 3 && !/^(ok|sim|nao|não|valeu|obrigad[oa]|bom dia|boa tarde|boa noite|ola|olá)$/i.test(textClean)) {
                    candidateTerreiroName = textClean;
                  }
                }

                const resolvedTerreiroName = candidateTerreiroName || null;

                if (resolvedEmail && resolvedTerreiroName) {
                  // TEMOS AS 2 INFORMAÇÕES! Faz o cadastro na hora
                  console.log(`[ChatOnboarding] 2 etapas concluídas! Criando conta para ${resolvedEmail} | Terreiro: ${resolvedTerreiroName} (fone: ${msg.from})`);
                  const onboardingService = new ChatOnboardingService(env);
                  const onboardRes = await onboardingService.createTenantFromChat({
                    phone: msg.from,
                    email: resolvedEmail,
                    nomeZelador: msg.name || undefined,
                    nomeTerreiro: resolvedTerreiroName,
                    city: lead?.city || undefined,
                    leadId: lead?.id,
                  });

                  if (onboardRes.success) {
                    replyToSend = onboardingService.formatWelcomeMessage(onboardRes);
                    replyStage = 'teste';
                    onboardCreated = true;
                  } else if (onboardRes.alreadyExists) {
                    replyToSend = onboardingService.formatAlreadyExistsMessage(onboardRes);
                    replyStage = 'teste';
                  } else {
                    replyToSend = onboardingService.formatFailureMessage();
                  }
                } else if (currentEmail && !resolvedTerreiroName) {
                  // RECEBEU APENAS O E-MAIL: pede o nome da casa
                  replyToSend = `Recebi seu e-mail! 🙏 Para eu liberar seu acesso certinho, qual é o nome do seu terreiro?`;
                  replyStage = 'interessado';
                  replyAction = 'request_trial_data';
                } else if (!resolvedEmail && msg.body.trim().length >= 3 && /\b(terreiro|tenda|ilê|ile|casa|centro|barracão|barracao|roça|roca|cabana|sear|t\.u|c\.e)\b/i.test(msg.body)) {
                  // RECEBEU APENAS O NOME DA CASA: pede o e-mail
                  replyToSend = `Perfeito! E qual o seu melhor e-mail para eu gerar o seu login de acesso ao terreiro?`;
                  replyStage = 'interessado';
                  replyAction = 'request_trial_data';
                }
              }

              // Se nenhuma regra assumiu a resposta, aciona a IA
              if (!replyToSend) {
                const agent = new AxeCloudSalesAgent(env);
                const reply = await agent.handleInbound({
                  leadName: lead?.name,
                  leadCity: lead?.city || undefined,
                  contactName: msg.name,
                  currentMessage: msg.body,
                  conversationHistory: history,
                });
                replyToSend = reply.replyText;
                replyStage = reply.stage;
                replyAction = reply.action || 'none';
                replyConfidence = reply.confidence;
                replyHumanHandoff = reply.humanHandoff;
              }

              const meta = new MetaCloudClient(env);
              let outMessageId: string | undefined;
              if (meta.isConfigured() && replyToSend) {
                const sendRes = await meta.sendTextMessage(msg.from, replyToSend);
                outMessageId = sendRes.messageId;
              }

              if (convId && replyToSend) {
                await crm.recordOutboundAdminMessage(convId, replyToSend, outMessageId);
              }

              if (lead) {
                const nextStatus = (onboardCreated || isAlreadyTrialOrCustomer)
                  ? 'trial'
                  : replyStage === 'interessado' || replyStage === 'avaliando' || replyStage === 'teste'
                  ? 'interested'
                  : 'replied';

                await crm.updateLead(lead.id, {
                  last_contact_at: new Date().toISOString(),
                  status: nextStatus,
                  ...(resolvedEmail ? { email: resolvedEmail } : {}),
                });
                await crm.recordEvent({
                  lead_id: lead.id,
                  event_type: onboardCreated ? 'trial_started' : 'ai_sales_reply',
                  from_status: lead.status,
                  to_status: nextStatus,
                  description: onboardCreated
                    ? `Acesso de teste de 30 dias criado via WhatsApp para ${resolvedEmail}`
                    : `Resposta gerada pela IA (estágio: ${replyStage})`,
                  metadata: {
                    confidence: replyConfidence,
                    humanHandoff: replyHumanHandoff,
                    messageId: outMessageId,
                    action: replyAction,
                    email: resolvedEmail || undefined,
                  },
                });
              }

            } catch (e) {
              console.error(`[Webhook] Erro ao processar mensagem de ${msg.from}:`, e);
            }
          })(),
        );
      }

      return jsonResponse({ success: true, processed: inboundMessages.length, statuses: statuses.length });
    }

    // Rotas administrativas protegidas
    const auth = await authenticateAdmin(request, env);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error }, 403);
    }

    const crm = new CrmService(env);

    try {
      // GET /api/prospecting/dashboard
      if (url.pathname === '/api/prospecting/dashboard' && request.method === 'GET') {
        const data = await crm.getDashboardMetrics();
        return jsonResponse(data);
      }

    // GET /api/prospecting/leads
    if (url.pathname === '/api/prospecting/leads' && request.method === 'GET') {
      const status = url.searchParams.get('status') || undefined;
      const city = url.searchParams.get('city') || undefined;
      const state = url.searchParams.get('state') || undefined;
      const source = url.searchParams.get('source') || undefined;
      const search = url.searchParams.get('search') || undefined;
      const scoreMin = url.searchParams.get('scoreMin') ? parseInt(url.searchParams.get('scoreMin')!, 10) : undefined;
      const scoreMax = url.searchParams.get('scoreMax') ? parseInt(url.searchParams.get('scoreMax')!, 10) : undefined;
      const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
      const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!, 10) : 0;

      const result = await crm.getLeads({
        status,
        city,
        state,
        source,
        search,
        scoreMin,
        scoreMax,
        limit,
        offset,
      });

      return jsonResponse(result);
    }

    // POST /api/prospecting/leads
    if (url.pathname === '/api/prospecting/leads' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;
      if (!body.name) {
        return jsonResponse({ error: 'O nome do terreiro/organização é obrigatório.' }, 400);
      }

      const created = await crm.createLead(body);
      return jsonResponse(created, 201);
    }

    // Rotas com ID de lead
    const leadMatch = url.pathname.match(/^\/api\/prospecting\/leads\/([a-zA-Z0-9-]+)(?:\/([a-zA-Z0-9-]+))?$/);
    if (leadMatch) {
      const leadId = leadMatch[1];
      const action = leadMatch[2];

      if (!action) {
        // GET /api/prospecting/leads/:id
        if (request.method === 'GET') {
          const lead = await crm.getLeadById(leadId);
          if (!lead) return jsonResponse({ error: 'Lead não encontrado.' }, 404);

          const [analyses, events, conversations] = await Promise.all([
            crm.getAiAnalyses(leadId),
            crm.getEvents(leadId),
            crm.getConversations(leadId),
          ]);

          return jsonResponse({ lead, analyses, events, conversations });
        }

        // PATCH /api/prospecting/leads/:id
        if (request.method === 'PATCH') {
          const patch = (await request.json().catch(() => ({}))) as any;
          const updated = await crm.updateLead(leadId, patch);
          return jsonResponse(updated);
        }
      }

      // POST /api/prospecting/leads/:id/analyze
      if (action === 'analyze' && request.method === 'POST') {
        const lead = await crm.getLeadById(leadId);
        if (!lead) return jsonResponse({ error: 'Lead não encontrado.' }, 404);

        const analyzer = new LeadAnalyzer(env);
        const analysis = await analyzer.analyze(lead);

        const recorded = await crm.recordAiAnalysis({
          lead_id: leadId,
          score: analysis.score,
          confidence: analysis.confidence,
          summary: analysis.summary,
          business_signals: analysis.businessSignals,
          possible_needs: analysis.possibleNeeds,
          digital_presence: analysis.digitalPresence,
          recommended_next_action: analysis.recommendedNextAction,
          raw_response: analysis as unknown as Record<string, unknown>,
        });

        return jsonResponse(recorded);
      }

      // POST /api/prospecting/leads/:id/qualify
      if (action === 'qualify' && request.method === 'POST') {
        const updated = await crm.updateLead(leadId, {
          status: 'qualified',
          next_action_at: new Date(Date.now() + 86400000).toISOString(),
        });

        await crm.recordEvent({
          lead_id: leadId,
          event_type: 'lead_qualified_manually',
          to_status: 'qualified',
          description: 'Lead qualificado manualmente pelo administrador.',
        });

        return jsonResponse(updated);
      }

      // POST /api/prospecting/leads/:id/blacklist
      if (action === 'blacklist' && request.method === 'POST') {
        const lead = await crm.getLeadById(leadId);
        if (!lead) return jsonResponse({ error: 'Lead não encontrado.' }, 404);

        if (lead.phone) {
          await crm.addToBlacklist(lead.phone, 'Bloqueado manualmente no painel admin', 'admin_action');
        }

        const updated = await crm.updateLead(leadId, {
          status: 'do_not_contact',
          whatsapp_opt_in: false,
        });

        await crm.recordEvent({
          lead_id: leadId,
          event_type: 'lead_blacklisted',
          to_status: 'do_not_contact',
          description: 'Lead incluído na blacklist pelo administrador.',
        });

        return jsonResponse(updated);
      }

      // POST /api/prospecting/leads/:id/send-whatsapp
      if (action === 'send-whatsapp' && request.method === 'POST') {
        const lead = await crm.getLeadById(leadId);
        if (!lead) return jsonResponse({ error: 'Lead não encontrado.' }, 404);
        if (!lead.phone) return jsonResponse({ error: 'Lead não possui telefone cadastrado.' }, 400);

        const isBlacklisted = await crm.isPhoneBlacklisted(lead.phone);
        if (isBlacklisted || lead.status === 'do_not_contact') {
          return jsonResponse({ error: 'Lead está na blacklist ou marcado como não contatar.' }, 400);
        }

        const isLider = await crm.findPerfilLiderByPhone(lead.phone);
        if (isLider) {
          await crm.updateLead(leadId, { status: 'customer' });
          return jsonResponse({ error: 'Este número já pertence a um zelador cliente do AxéCloud.', alreadyCustomer: true }, 400);
        }

        const isFilho = await crm.findFilhoDeSantoByPhone(lead.phone);
        if (isFilho) {
          return jsonResponse({ error: 'Este número pertence a um filho de santo cadastrado.', isFilho: true }, 400);
        }

        const meta = new MetaCloudClient(env);
        if (!meta.isConfigured()) {
          return jsonResponse({ error: 'Meta Cloud API não configurada (tokens ausentes).' }, 500);
        }

        const terreiroNome = String(lead.name || 'sua casa').trim().slice(0, 80);
        const imageUrl = 'https://axecloud.com.br/og-image.png';
        let templateName = 'axecloud_prospeccao_imagem_v1';
        let sendRes: { messageId: string };

        try {
          sendRes = await meta.sendTemplateMessage(lead.phone, templateName, 'pt_BR', [terreiroNome], imageUrl);
        } catch (imgErr: any) {
          console.warn(`[Outbound] Falha ao enviar com imagem (${templateName}): ${imgErr?.message}. Usando fallback axecloud_prospeccao_v2.`);
          templateName = 'axecloud_prospeccao_v2';
          sendRes = await meta.sendTemplateMessage(lead.phone, templateName, 'pt_BR', [terreiroNome]);
        }

        const updated = await crm.updateLead(leadId, {
          status: 'contacted',
          last_contact_at: new Date().toISOString(),
          whatsapp_opt_in: true,
        });

        await crm.recordEvent({
          lead_id: leadId,
          event_type: 'whatsapp_message_sent',
          to_status: 'contacted',
          description: `Template oficial "${templateName}" enviado via Meta Cloud API (ID: ${sendRes.messageId}).`,
          metadata: { messageId: sendRes.messageId, template: templateName },
        });

        return jsonResponse({ success: true, messageId: sendRes.messageId, lead: updated });
      }
    }

    // POST /api/prospecting/outbound/batch-send
    if (url.pathname === '/api/prospecting/outbound/batch-send' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;
      const limit = Math.min(Math.max(1, Number(body.limit) || 5), 20);

      const { leads } = await crm.getLeads({
        status: 'qualified',
        limit,
      });

      const eligible = leads.filter((l) => l.phone && l.phone.trim().length >= 8);
      if (!eligible.length) {
        return jsonResponse({ message: 'Nenhum lead qualificado com telefone disponível para envio.', sentCount: 0 });
      }

      const meta = new MetaCloudClient(env);
      if (!meta.isConfigured()) {
        return jsonResponse({ error: 'Meta Cloud API não configurada.' }, 500);
      }

      const results = [];
      for (const lead of eligible) {
        try {
          const isLider = await crm.findPerfilLiderByPhone(lead.phone!);
          if (isLider) {
            console.log(`[BatchSend] Lead ${lead.name} (${lead.phone}) já é cliente ativo (${isLider.nome_terreiro}).`);
            await crm.updateLead(lead.id, { status: 'customer' });
            results.push({ id: lead.id, name: lead.name, status: 'skipped', reason: 'already_customer' });
            continue;
          }

          const isFilho = await crm.findFilhoDeSantoByPhone(lead.phone!);
          if (isFilho) {
            console.log(`[BatchSend] Lead ${lead.name} (${lead.phone}) pertence a um filho de santo (${isFilho.nome}).`);
            results.push({ id: lead.id, name: lead.name, status: 'skipped', reason: 'is_filho_de_santo' });
            continue;
          }

          const isBlacklisted = await crm.isPhoneBlacklisted(lead.phone);
          if (isBlacklisted || lead.status === 'do_not_contact') {
            results.push({ id: lead.id, name: lead.name, status: 'skipped', reason: 'blacklisted' });
            continue;
          }

          const terreiroNome = String(lead.name || 'sua casa').trim().slice(0, 80);
          const imageUrl = 'https://axecloud.com.br/og-image.png';
          let templateName = 'axecloud_prospeccao_imagem_v1';
          let sendRes: { messageId: string };

          try {
            sendRes = await meta.sendTemplateMessage(lead.phone!, templateName, 'pt_BR', [terreiroNome], imageUrl);
          } catch (imgErr: any) {
            console.warn(`[BatchSend] Falha ao enviar com imagem (${templateName}): ${imgErr?.message}. Usando fallback axecloud_prospeccao_v2.`);
            templateName = 'axecloud_prospeccao_v2';
            sendRes = await meta.sendTemplateMessage(lead.phone!, templateName, 'pt_BR', [terreiroNome]);
          }

          await crm.updateLead(lead.id, {
            status: 'contacted',
            last_contact_at: new Date().toISOString(),
            whatsapp_opt_in: true,
          });

          await crm.recordEvent({
            lead_id: lead.id,
            event_type: 'whatsapp_message_sent',
            to_status: 'contacted',
            description: `Mensagem disparada em lote via Meta Cloud API (ID: ${sendRes.messageId}).`,
            metadata: { messageId: sendRes.messageId, template: templateName },
          });

          results.push({ id: lead.id, name: lead.name, status: 'sent', messageId: sendRes.messageId });
          await new Promise((r) => setTimeout(r, 1200));
        } catch (err: any) {
          console.error(`[BatchSend] Erro ao enviar para lead ${lead.id}:`, err);
          results.push({ id: lead.id, name: lead.name, status: 'failed', error: err.message });
        }
      }

      const sentCount = results.filter((r) => r.status === 'sent').length;
      return jsonResponse({ success: true, sentCount, total: eligible.length, results });
    }

    // POST /api/prospecting/outbound/trigger-cycle
    if (url.pathname === '/api/prospecting/outbound/trigger-cycle' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;
      const force = Boolean(body.force);
      const limit = Math.min(Math.max(1, Number(body.limit) || 5), 20);
      const outreach = new AutonomousProspectingService(env);
      const result = await outreach.runAutonomousOutreachCycle(force, limit);
      return jsonResponse(result);
    }

    // GET /api/prospecting/conversations/:leadId
    const convMatch = url.pathname.match(/^\/api\/prospecting\/conversations\/([a-zA-Z0-9-]+)$/);
    if (convMatch && request.method === 'GET') {
      const conversations = await crm.getConversations(convMatch[1]);
      return jsonResponse(conversations);
    }

    // GET /api/prospecting/events/:leadId
    const eventMatch = url.pathname.match(/^\/api\/prospecting\/events\/([a-zA-Z0-9-]+)$/);
    if (eventMatch && request.method === 'GET') {
      const events = await crm.getEvents(eventMatch[1]);
      return jsonResponse(events);
    }

    // GET /api/prospecting/settings
    if (url.pathname === '/api/prospecting/settings' && request.method === 'GET') {
      const providers = listAvailableProviders();
      return jsonResponse({
        providers,
        metaCloudConfigured: Boolean(env.WA_META_TOKEN && env.WA_PHONE_NUMBER_ID),
        aiGatewayConfigured: Boolean(env.GEMINI_API_KEY || env.CLOUDFLARE_AI_GATEWAY_URL),
      });
    }

    // POST /api/prospecting/discovery/start
    if (url.pathname === '/api/prospecting/discovery/start' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;
      const workflow = new ProspectingDiscoveryWorkflow(ctx, env);
      const runner: any = {
        async do<T>(_name: string, configOrFn: any, maybeFn?: () => Promise<T>): Promise<T> {
          const fn = typeof configOrFn === 'function' ? configOrFn : maybeFn;
          return await fn!();
        },
      };

      const result = await workflow.run({
        payload: {
          providerCode: body.providerCode || 'existing_axecloud_database',
          city: body.city || '',
          state: body.state || '',
          limit: body.limit || 50,
        },
        timestamp: new Date(),
        instanceId: `manual-${Date.now()}`,
      }, runner);

      return jsonResponse({ result, status: 'completed' });
    }

    // POST /api/prospecting/followup/run
    if (url.pathname === '/api/prospecting/followup/run' && request.method === 'POST') {
      const followUp = new FollowUpService(env);
      const result = await followUp.processPendingFollowUps(true); // force true para teste manual
      return jsonResponse(result);
    }

    // POST /api/prospecting/onboarding/create
    if (url.pathname === '/api/prospecting/onboarding/create' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;
      if (!body.email) {
        return jsonResponse({ error: 'Campo email é obrigatório.' }, 400);
      }
      const onboarding = new ChatOnboardingService(env);
      const result = await onboarding.createTenantFromChat({
        phone: body.phone || '+5511999999999',
        email: body.email,
        nomeZelador: body.nomeZelador,
        nomeTerreiro: body.nomeTerreiro,
        city: body.city,
        leadId: body.leadId,
      });
      return jsonResponse(result);
    }

      return jsonResponse({ error: 'Endpoint não encontrado.' }, 404);
    } catch (err: any) {
      console.error('[API Error in route handler]', err);
      return jsonResponse({ error: err?.message || 'Erro interno do servidor.' }, 500);
    }
  },

  /**
   * Processamento das filas Cloudflare Queues
   */
  async queue(batch: { queue: string; messages: Array<{ body: any; ack(): void }> }, env: ProspectingEnv): Promise<void> {
    const crm = new CrmService(env);

    if (batch.queue === 'prospecting-enrichment') {
      for (const msg of batch.messages) {
        const data = msg.body as QueueEnrichmentMessage;
        try {
          if (env.LEAD_WORKFLOW) {
            await env.LEAD_WORKFLOW.create({ params: { leadId: data.leadId } });
          } else {
            // Processamento direto
            const lead = await crm.getLeadById(data.leadId);
            if (lead && lead.status === 'discovered') {
              const analyzer = new LeadAnalyzer(env);
              const analysis = await analyzer.analyze(lead);
              await crm.recordAiAnalysis({
                lead_id: lead.id,
                score: analysis.score,
                confidence: analysis.confidence,
                summary: analysis.summary,
                business_signals: analysis.businessSignals,
                possible_needs: analysis.possibleNeeds,
                digital_presence: analysis.digitalPresence,
                recommended_next_action: analysis.recommendedNextAction,
                raw_response: analysis as unknown as Record<string, unknown>,
              });
            }
          }
          msg.ack();
        } catch (e) {
          console.error(`[Queue:Enrichment] Erro ao processar lead ${data.leadId}:`, e);
        }
      }
    } else if (batch.queue === 'prospecting-conversation') {
      for (const msg of batch.messages) {
        const data = msg.body as QueueConversationMessage;
        try {
          const lead = await crm.findLeadByPhone(data.phone);
          const isOptOut = OptInGuard.isOptOutMessage(data.inboundBody);

          if (isOptOut) {
            await OptInGuard.handleOptOut(data.phone, lead ? lead.id : null, crm);
            const meta = new MetaCloudClient(env);
            if (meta.isConfigured()) {
              await meta.sendTextMessage(
                data.phone,
                'Entendido. Registramos sua preferência e você não receberá mais mensagens automáticas. Axé e muito obrigado.',
              );
            }
          } else {
            const agent = new AxeCloudSalesAgent(env);
            const reply = await agent.handleInbound({
              leadName: lead?.name,
              leadCity: lead?.city || undefined,
              currentMessage: data.inboundBody,
              conversationHistory: [],
            });

            const meta = new MetaCloudClient(env);
            if (meta.isConfigured() && reply.replyText) {
              await meta.sendTextMessage(data.phone, reply.replyText);
            }

            if (lead) {
              await crm.updateLead(lead.id, {
                last_contact_at: new Date().toISOString(),
                status: reply.stage === 'interessado' ? 'interested' : 'replied',
              });
            }
          }
          msg.ack();
        } catch (e) {
          console.error(`[Queue:Conversation] Erro ao processar mensagem de ${data.phone}:`, e);
        }
      }
    }
  },

  /**
   * Disparos agendados Cloudflare Crons (executa a cada 1 hora)
   */
  async scheduled(_controller: unknown, env: ProspectingEnv, ctx: any): Promise<void> {
    const now = new Date();
    const utcHours = now.getUTCHours();

    // 1. Descoberta de terreiros roda a cada 4 horas (00, 04, 08, 12, 16, 20 UTC)
    if (utcHours % 4 === 0) {
      console.log('[Cron] Executando descoberta agendada de novos terreiros...');
      const workflow = new ProspectingDiscoveryWorkflow(ctx, env);
      const runner: any = {
        async do<T>(_name: string, configOrFn: any, maybeFn?: () => Promise<T>): Promise<T> {
          const fn = typeof configOrFn === 'function' ? configOrFn : maybeFn;
          return await fn!();
        },
      };
      ctx.waitUntil(
        workflow.run(
          {
            payload: { providerCode: 'existing_axecloud_database', limit: 50 },
            timestamp: now,
            instanceId: `cron-${Date.now()}`,
          },
          runner,
        ),
      );
    }

    // 2. Follow-up humanizado para leads que não responderam há 2+ horas (roda a cada hora)
    ctx.waitUntil(
      (async () => {
        try {
          console.log('[Cron:FollowUp] Verificando conversas para re-engajamento humanizado...');
          const followUp = new FollowUpService(env);
          const res = await followUp.processPendingFollowUps(false);
          console.log('[Cron:FollowUp] Concluído:', res);
        } catch (fErr) {
          console.warn('[Cron:FollowUp] Falha ao processar follow-ups:', fErr);
        }
      })(),
    );

    // 3. Disparo autônomo de novos contatos qualificados com template e imagem (dentro do horário comercial)
    ctx.waitUntil(
      (async () => {
        try {
          console.log('[Cron:Outreach] Verificando leads qualificados para contato autônomo...');
          const outreach = new AutonomousProspectingService(env);
          const res = await outreach.runAutonomousOutreachCycle(false, 5);
          console.log('[Cron:Outreach] Ciclo de prospecção autônoma concluído:', res);
        } catch (oErr) {
          console.warn('[Cron:Outreach] Falha ao processar ciclo de prospecção autônoma:', oErr);
        }
      })(),
    );
  },
};
