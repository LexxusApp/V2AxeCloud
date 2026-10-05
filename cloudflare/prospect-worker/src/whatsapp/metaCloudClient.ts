import type { ProspectingEnv } from '../types.js';

export class MetaCloudClient {
  private token: string;
  private phoneNumberId: string;
  private version: string;

  constructor(private env: ProspectingEnv) {
    this.token = String(env.WA_META_TOKEN || '').trim();
    this.phoneNumberId = String(env.WA_PHONE_NUMBER_ID || '').trim();
    this.version = 'v21.0';
  }

  isConfigured(): boolean {
    return Boolean(this.token && this.phoneNumberId);
  }

  async sendTextMessage(toPhone: string, text: string): Promise<{ messageId: string }> {
    const to = String(toPhone).replace(/\D/g, '');
    if (!to) throw new Error('Número de telefone destinatário inválido.');
    if (!this.isConfigured()) {
      throw new Error('Meta Cloud API não configurada (WA_META_TOKEN / WA_PHONE_NUMBER_ID ausentes).');
    }

    const url = `https://graph.facebook.com/${this.version}/${this.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: true, body: text },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } };
    if (!res.ok) {
      throw new Error(`Meta Cloud API erro (${res.status}): ${data.error?.message || 'Falha no envio'}`);
    }

    const messageId = data.messages?.[0]?.id || 'unknown';
    return { messageId };
  }

  async sendTemplateMessage(
    toPhone: string,
    templateName: string,
    language = 'pt_BR',
    bodyParameters: string[] = [],
  ): Promise<{ messageId: string }> {
    const to = String(toPhone).replace(/\D/g, '');
    if (!to) throw new Error('Número de telefone destinatário inválido.');
    if (!this.isConfigured()) {
      throw new Error('Meta Cloud API não configurada (WA_META_TOKEN / WA_PHONE_NUMBER_ID ausentes).');
    }

    const url = `https://graph.facebook.com/${this.version}/${this.phoneNumberId}/messages`;
    const components = bodyParameters.length
      ? [
          {
            type: 'body',
            parameters: bodyParameters.map((text) => ({ type: 'text', text })),
          },
        ]
      : [];

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        ...(components.length ? { components } : {}),
      },
    };

    let res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let data = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } };

    // Se falhar e tínhamos passado parâmetros, tenta sem componentes (caso o template seja estático)
    if (!res.ok && components.length > 0) {
      const fallbackPayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: language },
        },
      };
      const resFallback = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fallbackPayload),
      });

      if (resFallback.ok) {
        data = (await resFallback.json()) as any;
        return { messageId: data.messages?.[0]?.id || 'unknown' };
      }
    }

    if (!res.ok) {
      throw new Error(`Meta Cloud API erro (${res.status}): ${data.error?.message || 'Falha no envio de template'}`);
    }

    const messageId = data.messages?.[0]?.id || 'unknown';
    return { messageId };
  }
}

