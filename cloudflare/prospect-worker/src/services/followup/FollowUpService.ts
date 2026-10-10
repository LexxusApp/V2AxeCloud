import type { ProspectingEnv } from '../../types.js';
import { CrmService } from '../crm/crmService.js';
import { MetaCloudClient } from '../../whatsapp/metaCloudClient.js';
import { AiGatewayClient } from '../ai/aiGatewayClient.js';
import { AXECLOUD_KNOWLEDGE_BASE } from '../../sales-agent/knowledgeBase.js';

export interface FollowUpResult {
  processed: number;
  skippedReason?: string;
  results: Array<{ phone: string; status: 'sent' | 'skipped' | 'failed'; reason?: string }>;
}

export class FollowUpService {
  private crm: CrmService;
  private meta: MetaCloudClient;
  private ai: AiGatewayClient;
  private supabaseUrl: string;
  private serviceKey: string;

  constructor(private env: ProspectingEnv) {
    this.crm = new CrmService(env);
    this.meta = new MetaCloudClient(env);
    this.ai = new AiGatewayClient(env);
    this.supabaseUrl = (env.SUPABASE_URL || '').replace(/\/$/, '');
    this.serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  }

  /**
   * Executa a verificação e envio de follow-ups automáticos e humanizados
   */
  async processPendingFollowUps(forceHoursCheck = false): Promise<FollowUpResult> {
    const results: FollowUpResult['results'] = [];

    // 1. Verificação de Horário Comercial no Brasil (09:00 às 20:00 BRT)
    if (!forceHoursCheck) {
      const now = new Date();
      const utcHours = now.getUTCHours();
      const brtHours = (utcHours - 3 + 24) % 24;
      if (brtHours < 9 || brtHours >= 20) {
        return {
          processed: 0,
          skippedReason: `Fora do horário comercial respeitoso (${brtHours}h BRT). Envios permitidos apenas entre 09h e 20h.`,
          results: [],
        };
      }
    }

    if (!this.meta.isConfigured()) {
      return {
        processed: 0,
        skippedReason: 'Meta Cloud API não configurada no ambiente.',
        results: [],
      };
    }

    // 2. Busca conversas abertas cuja última mensagem ocorreu entre 18h e 48h atrás (intervalo respeitoso para não incomodar)
    const minHoursAgo = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString();
    const maxHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const convsRes = await fetch(
      `${this.supabaseUrl}/rest/v1/admin_whatsapp_conversations?status=eq.open&last_message_at=lte.${encodeURIComponent(
        minHoursAgo,
      )}&last_message_at=gte.${encodeURIComponent(maxHoursAgo)}&order=last_message_at.asc&limit=10`,
      {
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!convsRes.ok) {
      const errText = await convsRes.text().catch(() => '');
      throw new Error(`Falha ao buscar conversas para follow-up (${convsRes.status}): ${errText}`);
    }

    const conversations = (await convsRes.json().catch(() => [])) as Array<{
      id: string;
      phone_e164: string;
      contact_name?: string | null;
      last_message_at?: string | null;
    }>;

    for (const conv of conversations) {
      try {
        const phone = conv.phone_e164;

        // 3. Verifica se a última mensagem da conversa foi enviada pelo assistente (outbound)
        const msgsRes = await fetch(
          `${this.supabaseUrl}/rest/v1/admin_whatsapp_messages?conversation_id=eq.${conv.id}&order=created_at.desc&limit=1`,
          {
            headers: {
              apikey: this.serviceKey,
              Authorization: `Bearer ${this.serviceKey}`,
            },
          },
        );
        const lastMsgs = (await msgsRes.json().catch(() => [])) as Array<{
          id: string;
          direction: string;
          created_at: string;
          body: string;
        }>;

        if (!lastMsgs.length || lastMsgs[0].direction !== 'outbound') {
          results.push({ phone, status: 'skipped', reason: 'Última mensagem não foi outbound' });
          continue;
        }

        // 4. Verifica se o lead existe e se já não é cliente ou está bloqueado
        const lead = await this.crm.findLeadByPhone(phone);
        if (lead && (lead.status === 'customer' || lead.status === 'do_not_contact')) {
          results.push({ phone, status: 'skipped', reason: 'Lead é cliente ou do_not_contact' });
          continue;
        }

        const isBlacklisted = await this.crm.isPhoneBlacklisted(phone);
        if (isBlacklisted) {
          results.push({ phone, status: 'skipped', reason: 'Telefone em blacklist' });
          continue;
        }

        // 5. Verifica se já recebeu follow-up recente (garantia de nunca ser insistente)
        if (lead) {
          const eventsRes = await fetch(
            `${this.supabaseUrl}/rest/v1/prospecting_events?lead_id=eq.${lead.id}&event_type=eq.ai_followup_sent&limit=1`,
            {
              headers: {
                apikey: this.serviceKey,
                Authorization: `Bearer ${this.serviceKey}`,
              },
            },
          );
          const events = (await eventsRes.json().catch(() => [])) as any[];
          if (events && events.length > 0) {
            results.push({ phone, status: 'skipped', reason: 'Follow-up já enviado anteriormente' });
            continue;
          }
        }

        // 6. Carrega histórico recente da conversa para contextualizar
        const history = await this.crm.getAdminConversationHistory(phone, 6);
        const historyFormatted = history
          .map((m) => `${m.direction === 'inbound' ? 'Zelador' : 'AxéCloud'}: ${m.body}`)
          .join('\n');

        // 7. Gera mensagem humanizada de re-engajamento via IA
        const followUpPrompt = `Você é o assistente inteligente do AxéCloud no WhatsApp.
Mais cedo você conversou com este contato e respondeu a dúvida dele, mas ele não disse mais nada há algumas horas.
Escreva uma mensagem de follow-up curta (1 ou 2 parágrafos breves), extremamente educada, respeitosa e natural, perguntando se ficou alguma dúvida e oferecendo para liberar os 30 dias de teste gratuito sem compromisso para ele conhecer o sistema na prática.

DIRETRIZES:
- Tom acolhedor e natural de WhatsApp, sem afobação, sem parecer cobrança e sem parecer telemarketing.
- NÃO use listas com marcadores (proibido usar "•", "-", "*").
- Se fizer sentido com a conversa anterior, cite de forma sutil o assunto que estavam falando.
- NUNCA envie links de cadastro externos (/register). O fechamento é 100% nativo pelo WhatsApp: diga que ele não precisa preencher formulários externos nem entrar em site, basta responder aqui com o e-mail que você mesmo já ativa o teste de 30 dias na hora.
- Exemplo de estilo: "Oi! Passando só pra ver se ficou alguma dúvida sobre o que conversamos mais cedo. Se você quiser ver como funciona na prática na sua casa, posso liberar os 30 dias de teste gratuito agora mesmo por aqui. É só me responder com o seu melhor e-mail que eu já gero seu acesso! Qualquer dúvida estou à disposição."

Histórico recente da conversa:
${historyFormatted}

Escreva apenas o texto exato da mensagem para o WhatsApp:`;

        const replyText = await this.ai.generate(followUpPrompt, {
          temperature: 0.75,
          maxTokens: 300,
        });

        const cleanReply = (replyText || '').replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();

        if (!cleanReply) {
          results.push({ phone, status: 'failed', reason: 'IA não gerou texto de follow-up' });
          continue;
        }

        // 8. Dispara mensagem via Meta Cloud API
        const sendRes = await this.meta.sendTextMessage(phone, cleanReply);

        // 9. Registra mensagem outbound e evento
        await this.crm.recordOutboundAdminMessage(conv.id, cleanReply, sendRes.messageId);

        if (lead) {
          await this.crm.recordEvent({
            lead_id: lead.id,
            event_type: 'ai_followup_sent',
            from_status: lead.status,
            to_status: lead.status,
            description: 'Mensagem humanizada de re-engajamento enviada automaticamente após período de inatividade.',
            metadata: {
              messageId: sendRes.messageId,
              hoursInactive: '>=2h',
            },
          });
        }

        results.push({ phone, status: 'sent' });
      } catch (err: any) {
        console.error(`[FollowUpService] Erro ao processar conversa ${conv.id}:`, err);
        results.push({ phone: conv.phone_e164, status: 'failed', reason: err.message });
      }
    }

    const processed = results.filter((r) => r.status === 'sent').length;
    return { processed, results };
  }
}
