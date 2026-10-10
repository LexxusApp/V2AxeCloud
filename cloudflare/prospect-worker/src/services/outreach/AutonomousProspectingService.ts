import type { ProspectingEnv, ProspectingLead } from '../../types.js';
import { CrmService } from '../crm/crmService.js';
import { MetaCloudClient } from '../../whatsapp/metaCloudClient.js';

export interface AutonomousProspectingResult {
  dispatched: boolean;
  reason?: string;
  sentCount: number;
  skippedCount: number;
  leadsProcessed: Array<{ id: string; name: string; phone?: string | null; status: string; reason?: string }>;
}

export class AutonomousProspectingService {
  private crm: CrmService;
  private meta: MetaCloudClient;

  constructor(private env: ProspectingEnv) {
    this.crm = new CrmService(env);
    this.meta = new MetaCloudClient(env);
  }

  /**
   * Verifica se o momento atual está dentro do horário comercial no Brasil (Horário de Brasília: America/Sao_Paulo).
   * Janela oficial segura: Segunda a Sábado das 09:00 às 18:00.
   */
  isWithinBusinessHours(date = new Date()): boolean {
    const spTimeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hourCycle: 'h23',
      weekday: 'short',
    }).format(date);

    // Formato: "Mon, 14" ou "Tue, 09"
    const weekday = spTimeStr.split(',')[0]?.trim() || '';
    const hour = parseInt(spTimeStr.split(',')[1]?.trim() || '0', 10);

    // Nunca enviar aos Domingos (Sun)
    if (weekday === 'Sun') {
      return false;
    }

    // Janela das 09h00 às 18h00 (ou seja, 9 <= hour < 18)
    return hour >= 9 && hour < 18;
  }

  /**
   * Executa um ciclo autônomo de prospecção:
   * 1. Valida janela de horário comercial de Brasília.
   * 2. Consulta leads qualificados (status: qualified).
   * 3. Valida se o lead não é cliente ativo, filho de santo ou opt-out.
   * 4. Dispara mensagem humanizada via Meta Cloud API com template aprovado.
   * 5. Atualiza CRM e registra histórico.
   */
  async runAutonomousOutreachCycle(force = false, batchSize = 5): Promise<AutonomousProspectingResult> {
    if (!force && !this.isWithinBusinessHours()) {
      return {
        dispatched: false,
        reason: 'outside_business_hours',
        sentCount: 0,
        skippedCount: 0,
        leadsProcessed: [],
      };
    }

    if (!this.meta.isConfigured()) {
      return {
        dispatched: false,
        reason: 'meta_not_configured',
        sentCount: 0,
        skippedCount: 0,
        leadsProcessed: [],
      };
    }

    // 1. Busca leads qualificados ordenados por maior score
    const limit = Math.min(Math.max(1, batchSize), 10);
    const { leads } = await this.crm.getLeads({
      status: 'qualified',
      limit,
    });

    const eligible = leads.filter((l) => l.phone && l.phone.trim().length >= 8);
    if (!eligible.length) {
      return {
        dispatched: false,
        reason: 'no_qualified_leads',
        sentCount: 0,
        skippedCount: 0,
        leadsProcessed: [],
      };
    }

    const processed: Array<{ id: string; name: string; phone?: string | null; status: string; reason?: string }> = [];
    let sentCount = 0;
    let skippedCount = 0;

    for (const lead of eligible) {
      try {
        // Validação 1: Já é cliente/líder no AxéCloud?
        const isLider = await this.crm.findPerfilLiderByPhone(lead.phone!);
        if (isLider) {
          await this.crm.updateLead(lead.id, { status: 'customer' });
          processed.push({ id: lead.id, name: lead.name, phone: lead.phone, status: 'skipped', reason: 'already_customer' });
          skippedCount++;
          continue;
        }

        // Validação 2: É médium / filho de santo em algum terreiro?
        const isFilho = await this.crm.findFilhoDeSantoByPhone(lead.phone!);
        if (isFilho) {
          processed.push({ id: lead.id, name: lead.name, phone: lead.phone, status: 'skipped', reason: 'is_filho_de_santo' });
          skippedCount++;
          continue;
        }

        // Validação 3: Está em blacklist ou opt-out?
        const isBlacklisted = await this.crm.isPhoneBlacklisted(lead.phone);
        if (isBlacklisted || lead.status === 'do_not_contact') {
          processed.push({ id: lead.id, name: lead.name, phone: lead.phone, status: 'skipped', reason: 'blacklisted' });
          skippedCount++;
          continue;
        }

        // Disparo oficial com o template com imagem para máxima credibilidade (e fallback seguro)
        const terreiroNome = String(lead.name || 'sua casa').trim().slice(0, 80);
        const imageUrl = 'https://axecloud.com.br/og-image.png';
        let templateName = 'axecloud_prospeccao_imagem_v1';
        let sendRes: { messageId: string };

        try {
          sendRes = await this.meta.sendTemplateMessage(lead.phone!, templateName, 'pt_BR', [terreiroNome], imageUrl);
        } catch (imgErr: any) {
          console.warn(`[AutonomousProspecting] Template com imagem (${templateName}) indisponível ou pendente: ${imgErr?.message}. Usando fallback axecloud_prospeccao_v2.`);
          templateName = 'axecloud_prospeccao_v2';
          sendRes = await this.meta.sendTemplateMessage(lead.phone!, templateName, 'pt_BR', [terreiroNome]);
        }

        await this.crm.updateLead(lead.id, {
          status: 'contacted',
          last_contact_at: new Date().toISOString(),
          whatsapp_opt_in: true,
        });

        await this.crm.recordEvent({
          lead_id: lead.id,
          event_type: 'whatsapp_message_sent',
          to_status: 'contacted',
          description: `Disparo autônomo agendado via Meta Cloud API (ID: ${sendRes.messageId}).`,
          metadata: { messageId: sendRes.messageId, template: templateName, automated: true },
        });

        processed.push({ id: lead.id, name: lead.name, phone: lead.phone, status: 'sent' });
        sentCount++;

        // Intervalo de segurança anti-rajada entre mensagens
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err: any) {
        console.error(`[AutonomousProspecting] Erro no envio para ${lead.name} (${lead.phone}):`, err);
        processed.push({ id: lead.id, name: lead.name, phone: lead.phone, status: 'failed', reason: err.message });
      }
    }

    return {
      dispatched: true,
      sentCount,
      skippedCount,
      leadsProcessed: processed,
    };
  }
}
