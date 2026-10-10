import type { ProspectingEnv } from '../../types.js';
import { MetaCloudClient } from '../../whatsapp/metaCloudClient.js';

/**
 * Notificador de Falha de Entrega de Acesso do Membro / Médium para o Zelador.
 * Quando a Meta retorna status "failed" (ex.: #131026 undeliverable),
 * recupera os dados de matrícula, CPF/senha e link do médium e envia
 * imediatamente para o WhatsApp do Zelador entregar em mãos.
 * Idempotente com janela anti-duplicação de 6 horas.
 */
export class MemberAccessFailureNotifier {
  private meta: MetaCloudClient;
  private supabaseUrl: string;
  private serviceKey: string;

  constructor(private env: ProspectingEnv) {
    this.meta = new MetaCloudClient(env);
    this.supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/$/, '');
    this.serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  }

  async handleDeliveryFailure(opts: {
    externalId: string;
    errorCode?: string | null;
    errorMessage?: string | null;
  }): Promise<boolean> {
    if (!this.meta.isConfigured() || !opts.externalId) return false;

    const headers = {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      'Content-Type': 'application/json',
    };

    try {
      // 1. Localiza a mensagem nos logs para verificar se era envio de dados_acesso
      const logRes = await fetch(
        `${this.supabaseUrl}/rest/v1/whatsapp_logs?external_id=eq.${encodeURIComponent(opts.externalId)}&select=id,tenant_id,filho_id,tipo,telefone&limit=1`,
        { headers }
      );
      if (!logRes.ok) return false;
      const logs = (await logRes.json().catch(() => [])) as Array<{
        id: string;
        tenant_id?: string;
        filho_id?: string;
        tipo?: string;
        telefone?: string;
      }>;
      const log = logs[0];
      if (!log || !log.tenant_id || !log.filho_id) return false;

      const tipo = String(log.tipo || '').toLowerCase();
      if (!['dados_acesso', 'conta_membro', 'acesso_membro'].includes(tipo)) {
        return false;
      }

      const tenantId = String(log.tenant_id);
      const filhoId = String(log.filho_id);

      // 2. Anti-duplicação de 6 horas
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const dedupRes = await fetch(
        `${this.supabaseUrl}/rest/v1/whatsapp_logs?tenant_id=eq.${encodeURIComponent(tenantId)}&filho_id=eq.${encodeURIComponent(filhoId)}&tipo=eq.falha_acesso_membro_zelador&created_at=gte.${encodeURIComponent(sixHoursAgo)}&limit=1`,
        { headers }
      );
      if (dedupRes.ok) {
        const dedupLogs = (await dedupRes.json().catch(() => [])) as unknown[];
        if (dedupLogs.length > 0) return false;
      }

      // 3. Busca dados do Filho de Santo
      const filhoRes = await fetch(
        `${this.supabaseUrl}/rest/v1/filhos_de_santo?id=eq.${encodeURIComponent(filhoId)}&select=id,nome,cpf,whatsapp_phone,data_entrada&limit=1`,
        { headers }
      );
      if (!filhoRes.ok) return false;
      const filhos = (await filhoRes.json().catch(() => [])) as Array<{
        id: string;
        nome?: string;
        cpf?: string;
        whatsapp_phone?: string;
        data_entrada?: string;
      }>;
      const filho = filhos[0];
      if (!filho) return false;

      const nomeFilho = String(filho.nome || 'Médium / Filho').trim();
      const cpfDigits = String(filho.cpf || '').replace(/\D/g, '');
      const senha = cpfDigits.length >= 6 ? cpfDigits.slice(0, 6) : 'Cadastrada';
      const anoEntrada = filho.data_entrada ? new Date(filho.data_entrada).getFullYear() : new Date().getFullYear();
      const registro = `AXC-${anoEntrada}-${filho.id.substring(0, 4).toUpperCase()}`;
      const loginUrl = 'https://axecloud.com.br/entrar?modo=filho';
      const waFilho = String(filho.whatsapp_phone || log.telefone || '').replace(/\D/g, '');

      // 4. Busca telefone do Zelador
      const profRes = await fetch(
        `${this.supabaseUrl}/rest/v1/perfil_lider?id=eq.${encodeURIComponent(tenantId)}&select=whatsapp_publico,cargo,nome_terreiro&limit=1`,
        { headers }
      );
      const profiles = profRes.ok ? ((await profRes.json().catch(() => [])) as any[]) : [];
      const profile = profiles[0];

      const authRes = await fetch(`${this.supabaseUrl}/auth/v1/admin/users/${tenantId}`, { headers });
      const authData = authRes.ok ? ((await authRes.json().catch(() => ({}))) as any) : {};
      const meta = (authData.user_metadata || {}) as Record<string, unknown>;

      let zeladorPhone = String(meta.whatsapp || profile?.whatsapp_publico || '').replace(/\D/g, '');
      if (!zeladorPhone) return false;
      if (!zeladorPhone.startsWith('55')) zeladorPhone = `55${zeladorPhone}`;

      // Não envia se o número do filho for exatamente o mesmo do zelador
      if (waFilho && zeladorPhone === waFilho) return false;

      const nomeZelador = String(profile?.cargo || meta.nome_zelador || 'Zelador(a)').trim();
      const dadosManuais = `Registro: ${registro} · Senha (6 dígitos CPF): ${senha} · Link: ${loginUrl}`;

      let sent = false;
      let messageId: string | undefined;

      // 5. Envia template oficial ou texto formatado
      try {
        // Template dedicado oficial da Meta: conta_membro_aviso_zelador_axc
        const tmplRes = await this.meta.sendTemplateMessage(
          zeladorPhone,
          'conta_membro_aviso_zelador_axc',
          'pt_BR',
          [nomeZelador, `${nomeFilho} ${waFilho ? `(WA ${waFilho})` : ''}`.trim(), dadosManuais]
        );
        sent = true;
        messageId = tmplRes.messageId;
      } catch (e1) {
        try {
          // Fallback texto livre
          const freeText =
            `Olá, ${nomeZelador}! Axé.\n\n` +
            `⚠️ Não foi possível entregar o WhatsApp de acesso ao membro *${nomeFilho}*` +
            (waFilho ? ` (${waFilho})` : '') + `.\n\n` +
            `Passe os dados manualmente para que ele possa acessar o portal:\n` +
            `• *Registro:* ${registro}\n` +
            `• *Senha (6 primeiros dígitos do CPF):* ${senha}\n` +
            `• *Link de Login:* ${loginUrl}\n\n` +
            `_Aviso gerado automaticamente pelo AxéCloud._`;
          const txtRes = await this.meta.sendTextMessage(zeladorPhone, freeText);
          sent = true;
          messageId = txtRes.messageId;
        } catch (e2) {
          try {
            // Fallback template utility aprovado
            const packed = `Falha WhatsApp acesso ${nomeFilho}: ${dadosManuais}`;
            const genRes = await this.meta.sendTemplateMessage(
              zeladorPhone,
              'aviso_geral_axecloud',
              'pt_BR',
              [nomeZelador, packed.slice(0, 1000)]
            );
            sent = true;
            messageId = genRes.messageId;
          } catch (e3) {
            console.error('[MemberAccessFailureNotifier] Falha em todos os disparos ao zelador:', e3);
          }
        }
      }

      if (sent) {
        // 6. Grava log para deduplicação
        await fetch(`${this.supabaseUrl}/rest/v1/whatsapp_logs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            tenant_id: tenantId,
            filho_id: filhoId,
            tipo: 'falha_acesso_membro_zelador',
            telefone: zeladorPhone,
            mensagem: `Falha entrega acesso → avisado zelador: ${nomeFilho} (${registro})`,
            status: 'sent',
            external_id: messageId || null,
          }),
        });
        console.log(`[MemberAccessFailureNotifier] Zelador ${nomeZelador} avisado com sucesso da falha de entrega de ${nomeFilho}`);
      }

      return sent;
    } catch (err) {
      console.error('[MemberAccessFailureNotifier] Erro inesperado:', err);
      return false;
    }
  }
}
