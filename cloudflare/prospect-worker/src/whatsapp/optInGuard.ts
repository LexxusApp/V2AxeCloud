import type { ProspectingLead } from '../types.js';
import type { CrmService } from '../services/crm/crmService.js';

const OPT_OUT_REGEX = /\b(parar|pare|remover|removerme|nao quero|não quero|cancelar|sair|bloquear|sem interesse|nao mande|não mande|descadastrar)\b/i;

export interface OptInCheckResult {
  allowed: boolean;
  reason?: string;
}

export class OptInGuard {
  static isOptOutMessage(message: string): boolean {
    const norm = String(message || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return OPT_OUT_REGEX.test(norm);
  }

  static canSendMessage(lead: ProspectingLead, isBlacklisted: boolean): OptInCheckResult {
    if (isBlacklisted) {
      return { allowed: false, reason: 'Número presente na lista negra (blacklist).' };
    }

    if (lead.status === 'do_not_contact') {
      return { allowed: false, reason: 'Lead marcado como não contatar (do_not_contact).' };
    }

    if (lead.status === 'duplicate' || lead.status === 'invalid') {
      return { allowed: false, reason: `Lead possui status inválido: ${lead.status}.` };
    }

    // Se for mensagem proativa iniciada pelo AxéCloud, exige opt-in verificado
    if (!lead.whatsapp_opt_in) {
      return {
        allowed: false,
        reason: 'Lead não possui opt-in verificado para WhatsApp. Disparos frios sem consentimento são proibidos.',
      };
    }

    return { allowed: true };
  }

  static async handleOptOut(
    phone: string,
    leadId: string | null,
    crm: CrmService,
  ): Promise<void> {
    await crm.addToBlacklist(phone, 'Solicitação expressa de interrupção (opt-out)', 'whatsapp_inbound');

    if (leadId) {
      await crm.updateLead(leadId, {
        status: 'do_not_contact',
        whatsapp_opt_in: false,
      });

      await crm.recordEvent({
        lead_id: leadId,
        event_type: 'opt_out_received',
        to_status: 'do_not_contact',
        description: 'Contato solicitou interrupção de mensagens. Adicionado à blacklist.',
      });
    }
  }
}
