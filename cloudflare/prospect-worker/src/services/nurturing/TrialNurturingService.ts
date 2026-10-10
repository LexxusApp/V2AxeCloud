import type { ProspectingEnv } from '../../types.js';
import { MetaCloudClient } from '../../whatsapp/metaCloudClient.js';

export interface TrialNurturingResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
  results: Array<{ tenantId: string; step: string; status: 'sent' | 'skipped' | 'error'; reason?: string }>;
}

export class TrialNurturingService {
  private meta: MetaCloudClient;
  private supabaseUrl: string;
  private serviceKey: string;

  constructor(private env: ProspectingEnv) {
    this.meta = new MetaCloudClient(env);
    this.supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/$/, '');
    this.serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  }

  /**
   * Processa a régua de ativação e conversão dos 30 dias de teste gratuito
   */
  async processTrialNurturing(forceHourCheck = false): Promise<TrialNurturingResult> {
    const output: TrialNurturingResult = {
      processed: 0,
      sent: 0,
      skipped: 0,
      errors: 0,
      results: [],
    };

    if (!this.meta.isConfigured()) {
      return output;
    }

    // Janela respeitosa de horário comercial (10h às 19h BRT)
    if (!forceHourCheck) {
      const now = new Date();
      const utcHours = now.getUTCHours();
      const brtHours = (utcHours - 3 + 24) % 24;
      if (brtHours < 10 || brtHours >= 19) {
        return output;
      }
    }

    const headers = {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      'Content-Type': 'application/json',
    };

    // 1. Busca assinaturas em período de teste (sem payment_provider e não expiradas)
    const nowIso = new Date().toISOString();
    const subsRes = await fetch(
      `${this.supabaseUrl}/rest/v1/subscriptions?status=in.(active,trial)&payment_provider=is.null&expires_at=gte.${encodeURIComponent(
        nowIso,
      )}&order=created_at.desc&limit=50`,
      { headers },
    );

    if (!subsRes.ok) {
      console.warn('[TrialNurturing] Falha ao consultar assinaturas:', await subsRes.text().catch(() => ''));
      return output;
    }

    const subscriptions = (await subsRes.json().catch(() => [])) as Array<{
      id: string;
      plan: string;
      expires_at: string;
      created_at: string;
    }>;

    for (const sub of subscriptions) {
      output.processed++;
      const tenantId = sub.id;
      const expiresAt = new Date(sub.expires_at);
      const daysRemaining = Math.round((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

      const createdAt = new Date(sub.created_at || (expiresAt.getTime() - 30 * 24 * 60 * 60 * 1000));
      const daysElapsed = Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000));

      // Determina qual estágio da régua corresponde ao tempo decorrido ou dias restantes
      let stageKey = '';
      let relativeTime = '';
      let customMessage = '';

      if (daysRemaining <= 0) {
        stageKey = 'dia_30';
        relativeTime = 'encerra hoje';
      } else if (daysRemaining === 1) {
        stageKey = 'dia_29';
        relativeTime = 'encerra amanhã';
      } else if (daysRemaining <= 3) {
        stageKey = 'dia_27';
        relativeTime = 'encerra em 3 dias';
      } else if (daysElapsed >= 20 && daysElapsed <= 23) {
        stageKey = 'dia_20';
      } else if (daysElapsed >= 7 && daysElapsed <= 9) {
        stageKey = 'dia_7';
      } else if (daysElapsed >= 1 && daysElapsed <= 3) {
        stageKey = 'dia_1';
      } else {
        // Fora dos checkpoints da régua
        output.skipped++;
        continue;
      }

      // 2. Verifica deduplicação em whatsapp_logs (se já recebeu este estágio)
      const dedupeType = `trial_nurture_${stageKey}`;
      const checkRes = await fetch(
        `${this.supabaseUrl}/rest/v1/whatsapp_logs?tenant_id=eq.${encodeURIComponent(tenantId)}&tipo=eq.${encodeURIComponent(dedupeType)}&limit=1`,
        { headers },
      );
      if (checkRes.ok) {
        const events = (await checkRes.json().catch(() => [])) as unknown[];
        if (events.length > 0) {
          output.skipped++;
          continue;
        }
      }

      // 3. Obtém dados do zelador e terreiro
      const profRes = await fetch(
        `${this.supabaseUrl}/rest/v1/perfil_lider?id=eq.${encodeURIComponent(tenantId)}&limit=1`,
        { headers },
      );
      if (!profRes.ok) {
        output.skipped++;
        continue;
      }
      const profiles = (await profRes.json().catch(() => [])) as Array<{
        nome_terreiro?: string;
        cargo?: string;
        whatsapp?: string;
        whatsapp_publico?: string;
        email?: string;
      }>;
      const profile = profiles[0];
      let phone = String(profile?.whatsapp || profile?.whatsapp_publico || '').replace(/\D/g, '');

      if (!phone) {
        // Tenta obter do Auth metadata
        const authRes = await fetch(`${this.supabaseUrl}/auth/v1/admin/users/${tenantId}`, { headers });
        if (authRes.ok) {
          const authUser = (await authRes.json().catch(() => ({}))) as any;
          phone = String(authUser.user_metadata?.whatsapp || authUser.phone || '').replace(/\D/g, '');
        }
      }

      if (!phone) {
        // Fallback: busca último whatsapp_logs do terreiro
        const lastLogRes = await fetch(
          `${this.supabaseUrl}/rest/v1/whatsapp_logs?tenant_id=eq.${encodeURIComponent(tenantId)}&order=created_at.desc&limit=1`,
          { headers },
        );
        if (lastLogRes.ok) {
          const logs = (await lastLogRes.json().catch(() => [])) as Array<{ telefone?: string }>;
          phone = String(logs[0]?.telefone || '').replace(/\D/g, '');
        }
      }

      if (!phone) {
        output.skipped++;
        output.results.push({ tenantId, step: stageKey, status: 'skipped', reason: 'Telefone ausente' });
        continue;
      }

      // Normaliza para formato BR com 55 e 9 dígitos no celular
      if (phone.length === 10) {
        // DDD + 8 dígitos -> adiciona nono dígito 9
        phone = `${phone.slice(0, 2)}9${phone.slice(2)}`;
      }
      if (!phone.startsWith('55')) phone = `55${phone}`;

      // 3.1. Proteção de supressão: ignora Flávia e verifica tabela de blacklist
      if (tenantId === '29baae98-c2eb-4191-99db-1f26e970f285' || phone.includes('995755589')) {
        output.skipped++;
        output.results.push({ tenantId, step: stageKey, status: 'skipped', reason: 'Suprimido pelo suporte humano' });
        continue;
      }

      const blRes = await fetch(
        `${this.supabaseUrl}/rest/v1/prospecting_blacklist?phone=eq.${encodeURIComponent(phone)}&limit=1`,
        { headers },
      );
      if (blRes.ok) {
        const blRows = (await blRes.json().catch(() => [])) as unknown[];
        if (blRows.length > 0) {
          output.skipped++;
          output.results.push({ tenantId, step: stageKey, status: 'skipped', reason: 'Número na blacklist de supressão' });
          continue;
        }
      }

      const nomeZelador = String(profile?.cargo || 'Zelador(a)').trim();
      const nomeTerreiro = String(profile?.nome_terreiro || 'Terreiro').trim();
      const dataFimBr = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(expiresAt);

      try {
        let sentOk = false;

        if (stageKey === 'dia_27' || stageKey === 'dia_29' || stageKey === 'dia_30') {
          // Template oficial aprovado pela Meta
          await this.meta.sendTemplateMessage(
            phone,
            'teste_encerrando_zelador_axecloud',
            'pt_BR',
            [nomeZelador, nomeTerreiro, dataFimBr, relativeTime],
          );
          sentOk = true;
        } else if (stageKey === 'dia_1') {
          customMessage =
            `Olá, ${nomeZelador}! Axé! 🙏\n\n` +
            `Passando para desejar um excelente início no teste de 30 dias do *${nomeTerreiro}* no AxéCloud.\n\n` +
            `💡 *Dica de ouro:* O primeiro passo ideal é cadastrar 3 filhos de santo para ver como a ficha litúrgica e a carteirinha da casa funcionam.\n\n` +
            `Acesse seu painel: https://axecloud.com.br/entrar\n\n` +
            `Se precisar de qualquer apoio, é só responder por aqui!`;
          try {
            await this.meta.sendTextMessage(phone, customMessage);
            sentOk = true;
          } catch (textErr) {
            console.warn(`[TrialNurturing] Janela 24h fechada para ${phone}, tentando template fallback:`, textErr);
            await this.meta.sendTemplateMessage(
              phone,
              'aviso_geral_axecloud',
              'pt_BR',
              [nomeZelador, `Seu teste de 30 dias do ${nomeTerreiro} está ativo! Cadastre os primeiros filhos em https://axecloud.com.br`],
            );
            sentOk = true;
          }
        } else if (stageKey === 'dia_7') {
          customMessage =
            `Olá, ${nomeZelador}! Tudo bem?\n\n` +
            `Você sabia que marcando a próxima gira no AxéCloud, o sistema já calcula as datas de preceito e monta a lista de presença automaticamente?\n\n` +
            `📅 Experimente agendar uma gira: https://axecloud.com.br/calendar\n\n` +
            `Muito axé para sua casa! 🌿`;
          try {
            await this.meta.sendTextMessage(phone, customMessage);
            sentOk = true;
          } catch (textErr) {
            console.warn(`[TrialNurturing] Janela 24h fechada para ${phone}, tentando template fallback:`, textErr);
            await this.meta.sendTemplateMessage(
              phone,
              'aviso_geral_axecloud',
              'pt_BR',
              [nomeZelador, `Dica AxéCloud: agende a próxima gira do ${nomeTerreiro} para calcular preceitos e lista de presença.`],
            );
            sentOk = true;
          }
        } else if (stageKey === 'dia_20') {
          customMessage =
            `Olá, ${nomeZelador}! Como estão os preparativos e a organização do *${nomeTerreiro}*?\n\n` +
            `Restam 10 dias do seu período de teste gratuito. Esperamos que o AxéCloud esteja trazendo paz e clareza para a rotina da casa.\n\n` +
            `Se tiver alguma dúvida sobre recursos ou sobre os planos anual e mensal, estou à disposição! ✨`;
          try {
            await this.meta.sendTextMessage(phone, customMessage);
            sentOk = true;
          } catch (textErr) {
            console.warn(`[TrialNurturing] Janela 24h fechada para ${phone}, tentando template fallback:`, textErr);
            await this.meta.sendTemplateMessage(
              phone,
              'aviso_geral_axecloud',
              'pt_BR',
              [nomeZelador, `Acompanhamento AxéCloud: restam 10 dias de teste no ${nomeTerreiro}. Dúvidas? Fale conosco!`],
            );
            sentOk = true;
          }
        }

        if (sentOk) {
          // Registra envio e deduplicação em whatsapp_logs
          await fetch(`${this.supabaseUrl}/rest/v1/whatsapp_logs`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              tenant_id: tenantId,
              tipo: dedupeType,
              telefone: phone,
              mensagem: (customMessage || `Régua de teste: ${stageKey}`).slice(0, 1000),
              status: 'delivered',
            }),
          });

          output.sent++;
          output.results.push({ tenantId, step: stageKey, status: 'sent' });
        }
      } catch (sendErr: unknown) {
        output.errors++;
        output.results.push({
          tenantId,
          step: stageKey,
          status: 'error',
          reason: sendErr instanceof Error ? sendErr.message : String(sendErr),
        });
      }
    }

    return output;
  }
}
