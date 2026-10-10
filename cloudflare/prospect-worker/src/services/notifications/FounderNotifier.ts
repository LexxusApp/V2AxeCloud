import type { ProspectingEnv } from '../../types.js';
import { MetaCloudClient } from '../../whatsapp/metaCloudClient.js';

/**
 * Notificador de Operações para o WhatsApp pessoal do fundador (Lucas).
 * Envia mensagens ricas e, caso a janela de 24h esteja fechada na Meta,
 * utiliza o template oficial 'aviso_geral_axecloud' como fallback.
 */
export class FounderNotifier {
  private meta: MetaCloudClient;
  private founderPhones: string[];

  constructor(private env: ProspectingEnv) {
    this.meta = new MetaCloudClient(env);
    const raw = String(env.WA_OPS_ALERT_PHONES || '5511920033501').trim();
    this.founderPhones = raw
      .split(/[,;\s]+/)
      .map((p) => p.replace(/\D/g, ''))
      .filter(Boolean);
  }

  private async sendAlert(text: string, summary: string): Promise<void> {
    if (!this.meta.isConfigured() || !this.founderPhones.length) return;

    for (const phone of this.founderPhones) {
      try {
        await this.meta.sendTextMessage(phone, text);
      } catch (err: unknown) {
        // Fallback para template UTILITY aprovado caso a janela de 24h esteja inativa
        try {
          await this.meta.sendTemplateMessage(
            phone,
            'aviso_geral_axecloud',
            'pt_BR',
            ['Lucas', summary.slice(0, 100)],
          );
        } catch (tmplErr) {
          console.warn(`[FounderNotifier] Falha ao enviar alerta para ${phone}:`, tmplErr);
        }
      }
    }
  }

  /**
   * Alerta quando um lead comercial pede para falar com um ser humano
   */
  async notifyHumanHandoff(opts: {
    contactName?: string;
    phone: string;
    message: string;
    reason?: string;
  }): Promise<void> {
    const cleanPhone = opts.phone.replace(/\D/g, '');
    const text =
      `🚨 *[AxéCloud] Atendimento Humano Solicitado!*\n\n` +
      `• *Contato:* ${opts.contactName || 'Visitante'}\n` +
      `• *WhatsApp:* https://wa.me/${cleanPhone}\n` +
      `• *Mensagem:* "${opts.message}"\n` +
      `• *Motivo:* ${opts.reason || 'Pedido explícito de atendente'}\n\n` +
      `_Acesse o link do WhatsApp acima para responder ao lead._`;

    const summary = `Lead pediu atendente: ${opts.contactName || cleanPhone} (wa.me/${cleanPhone})`;
    await this.sendAlert(text, summary);
  }

  /**
   * Alerta quando um novo teste gratuito de 30 dias é criado
   */
  async notifyTrialCreated(opts: {
    nomeTerreiro: string;
    nomeZelador: string;
    email: string;
    phone: string;
    city?: string;
    source: string;
  }): Promise<void> {
    const cleanPhone = opts.phone.replace(/\D/g, '');
    const text =
      `🎉 *[AxéCloud] Novo Teste de 30 Dias Ativado!*\n\n` +
      `• *Terreiro:* ${opts.nomeTerreiro}\n` +
      `• *Zelador(a):* ${opts.nomeZelador}\n` +
      `• *E-mail:* ${opts.email}\n` +
      `• *WhatsApp:* https://wa.me/${cleanPhone}\n` +
      (opts.city ? `• *Cidade:* ${opts.city}\n` : '') +
      `• *Origem:* ${opts.source}\n\n` +
      `_Conta Premium criada automaticamente no Supabase._`;

    const summary = `Novo teste ativado: ${opts.nomeTerreiro} (${opts.email})`;
    await this.sendAlert(text, summary);
  }

  /**
   * Alerta quando uma assinatura é paga via Pix ou cartão
   */
  async notifyPaymentReceived(opts: {
    nomeTerreiro: string;
    email: string;
    valor: string;
    ciclo: string;
  }): Promise<void> {
    const text =
      `💰 *[AxéCloud] Pagamento de Assinatura Confirmado!*\n\n` +
      `• *Terreiro:* ${opts.nomeTerreiro}\n` +
      `• *E-mail:* ${opts.email}\n` +
      `• *Plano:* Premium (${opts.ciclo})\n` +
      `• *Valor:* R$ ${opts.valor}\n\n` +
      `_Assinatura renovada/ativada com sucesso._`;

    const summary = `Assinatura paga: ${opts.nomeTerreiro} - R$ ${opts.valor}`;
    await this.sendAlert(text, summary);
  }
}
