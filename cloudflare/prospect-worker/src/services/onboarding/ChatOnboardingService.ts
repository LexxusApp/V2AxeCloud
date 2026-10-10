import type { ProspectingEnv } from '../../types.js';
import { MetaCloudClient } from '../../whatsapp/metaCloudClient.js';

export interface ChatOnboardingInput {
  phone: string;
  email: string;
  nomeZelador?: string;
  nomeTerreiro?: string;
  city?: string;
  leadId?: string;
}

export interface ChatOnboardingResult {
  success: boolean;
  alreadyExists?: boolean;
  userId?: string;
  email: string;
  tempPassword?: string;
  loginUrl: string;
  nomeZelador: string;
  nomeTerreiro: string;
  expiresAt?: string;
  errorMessage?: string;
}

export class ChatOnboardingService {
  private supabaseUrl: string;
  private serviceKey: string;

  constructor(private env: ProspectingEnv) {
    this.supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/$/, '');
    this.serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
    if (!this.supabaseUrl || !this.serviceKey) {
      throw new Error('Supabase credentials ausentes no ChatOnboardingService.');
    }
  }

  /**
   * Gera uma senha temporária em conformidade com a política oficial do AxéCloud:
   * Mínimo 8 caracteres, maiúscula, minúscula, número e símbolo.
   * Formato: Axe@XXXX (ex: Axe@4821)
   */
  generateCompliantPassword(): string {
    const code = Math.floor(1000 + Math.random() * 9000);
    return `Axe@${code}`;
  }

  /**
   * Normaliza e valida endereço de e-mail.
   */
  normalizeEmail(raw: string): string {
    return String(raw || '')
      .trim()
      .replace(/[.,;:!?]+$/, '')
      .trim()
      .toLowerCase();
  }

  /**
   * Cria o tenant diretamente a partir do WhatsApp com período de teste Premium de 30 dias.
   */
  async createTenantFromChat(input: ChatOnboardingInput): Promise<ChatOnboardingResult> {
    const email = this.normalizeEmail(input.email);
    const phoneDigits = String(input.phone || '').replace(/\D/g, '');
    const nomeZelador = String(input.nomeZelador || '').trim() || 'Zelador';
    const nomeTerreiro = String(input.nomeTerreiro || '').trim() || 'Terreiro';
    const loginUrl = 'https://axecloud.com.br/login';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        success: false,
        email,
        loginUrl,
        nomeZelador,
        nomeTerreiro,
        errorMessage: 'E-mail inválido.',
      };
    }

    const tempPassword = this.generateCompliantPassword();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Cria usuário no Supabase Auth Admin
    const authHeaders = {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      'Content-Type': 'application/json',
    };

    const authRes = await fetch(`${this.supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          nome_terreiro: nomeTerreiro,
          nome_zelador: nomeZelador,
          whatsapp: phoneDigits,
          cidade: input.city || undefined,
          onboarding: 'chat_onboarding',
          is_trial: true,
          billing_cycle: 'monthly',
        },
      }),
    });

    if (!authRes.ok) {
      const errText = await authRes.text().catch(() => '');
      const isAlready =
        authRes.status === 422 ||
        /already|registered|duplicate|exists/i.test(errText);

      if (isAlready) {
        return {
          success: false,
          alreadyExists: true,
          email,
          loginUrl,
          nomeZelador,
          nomeTerreiro,
          errorMessage: 'E-mail já cadastrado.',
        };
      }

      return {
        success: false,
        email,
        loginUrl,
        nomeZelador,
        nomeTerreiro,
        errorMessage: `Erro Supabase Auth (${authRes.status}): ${errText}`,
      };
    }

    const authData = (await authRes.json().catch(() => ({}))) as any;
    const userId = authData.id || authData.user?.id;
    if (!userId) {
      return {
        success: false,
        email,
        loginUrl,
        nomeZelador,
        nomeTerreiro,
        errorMessage: 'ID do usuário não retornado pelo Supabase Auth.',
      };
    }

    // 2. Upsert em perfil_lider
    const profRes = await fetch(`${this.supabaseUrl}/rest/v1/perfil_lider`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: userId,
        email,
        nome_terreiro: nomeTerreiro,
        cargo: nomeZelador,
        role: 'admin',
        tenant_id: userId,
        whatsapp: phoneDigits.slice(0, 15) || null,
        whatsapp_publico: phoneDigits.slice(0, 15) || null,
        cidade: input.city || null,
        cidade_publica: input.city || null,
        updated_at: now,
      }),
    });

    if (!profRes.ok) {
      console.warn('[ChatOnboarding] Aviso ao atualizar perfil_lider:', await profRes.text().catch(() => ''));
    }

    // 3. Upsert em subscriptions (Plano Premium, 30 dias de teste ativo)
    const subRes = await fetch(`${this.supabaseUrl}/rest/v1/subscriptions`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: userId,
        plan: 'premium',
        status: 'active',
        expires_at: expiresAt,
        billing_cycle: 'monthly',
        updated_at: now,
      }),
    });

    if (!subRes.ok) {
      console.warn('[ChatOnboarding] Aviso ao atualizar subscriptions:', await subRes.text().catch(() => ''));
    }

    // 4. Se houver lead associado no CRM, atualiza status para 'trial'
    if (input.leadId) {
      try {
        await fetch(`${this.supabaseUrl}/rest/v1/prospecting_leads?id=eq.${encodeURIComponent(input.leadId)}`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({
            status: 'trial',
            email,
            name: nomeTerreiro,
            terreiro_id: userId,
            last_contact_at: now,
          }),
        });

        await fetch(`${this.supabaseUrl}/rest/v1/prospecting_events`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            lead_id: input.leadId,
            event_type: 'trial_started',
            from_status: 'interested',
            to_status: 'trial',
            description: `Acesso de teste de 30 dias criado via WhatsApp para ${email}`,
            metadata: {
              userId,
              email,
              source: 'whatsapp_chat_onboarding',
            },
          }),
        });
      } catch (crmErr) {
        console.warn('[ChatOnboarding] Falha ao registrar evento CRM:', crmErr);
      }
    }

    // 5. Notifica o administrador (Lucas) via WhatsApp sobre o novo terreiro criado
    try {
      const meta = new MetaCloudClient(this.env);
      const adminPhone = String((this.env as any).WA_OPS_ALERT_PHONE || '').replace(/\D/g, '');
      if (meta.isConfigured() && adminPhone) {
        const contactInfo = `E-mail: ${email} · WA: ${phoneDigits} · origem: WhatsApp Chat IA`;
        try {
          await meta.sendTemplateMessage(
            adminPhone,
            'novo_cadastro_terreiro_ops_axecloud',
            'pt_BR',
            [nomeTerreiro, nomeZelador || 'Zelador', contactInfo],
          );
          console.log(`[ChatOnboarding] Alerta de novo terreiro enviado via template para admin ${adminPhone}`);
        } catch (tmplErr) {
          console.warn('[ChatOnboarding] Falha ao enviar template de alerta para admin, tentando texto livre:', tmplErr);
          const alertText = `🎉 *Novo Terreiro Cadastrado no AxéCloud!*\n\n🏛️ *Terreiro:* ${nomeTerreiro}\n👤 *Zelador:* ${nomeZelador || 'Não informado'}\n📧 *E-mail:* ${email}\n📱 *WhatsApp:* +${phoneDigits}\n🚀 *Origem:* Chat de Prospecção IA (30 dias de teste)`;
          await meta.sendTextMessage(adminPhone, alertText).catch(() => {});
        }
      }
    } catch (alertErr) {
      console.warn('[ChatOnboarding] Falha ao notificar admin sobre novo cadastro:', alertErr);
    }

    return {
      success: true,
      userId,
      email,
      tempPassword,
      loginUrl,
      nomeZelador,
      nomeTerreiro,
      expiresAt,
    };
  }

  /**
   * Mensagem amigável e calorosa com as credenciais criadas para envio no WhatsApp.
   */
  formatWelcomeMessage(result: ChatOnboardingResult): string {
    const saudacao =
      result.nomeZelador && result.nomeZelador.toLowerCase() !== 'zelador'
        ? `Pronto, ${result.nomeZelador}!`
        : 'Pronto!';

    return `${saudacao} Seu acesso de 30 dias grátis ao AxéCloud foi criado com sucesso! 🎉

Aqui estão os dados para você entrar:
🌐 Link de Acesso: ${result.loginUrl}
📧 E-mail: ${result.email}
🔑 Senha temporária: ${result.tempPassword}

Você já pode entrar agora mesmo pelo celular ou computador para conhecer todos os recursos da casa. Se precisar de qualquer ajuda na configuração inicial ou quiser tirar dúvidas, estou por aqui!

Bom proveito e muito axé! 🌿`;
  }

  /**
   * Mensagem caso o e-mail já esteja cadastrado no sistema.
   */
  formatAlreadyExistsMessage(result: ChatOnboardingResult): string {
    return `Identifiquei que o e-mail *${result.email}* já possui uma conta cadastrada no AxéCloud!

Você pode acessar diretamente pelo link:
🌐 ${result.loginUrl}

Caso precise redefinir sua senha, é só acessar:
🔑 https://axecloud.com.br/recuperar-senha

Qualquer dúvida, é só me chamar por aqui!`;
  }

  /**
   * Mensagem de contingência caso ocorra algum erro técnico inesperado.
   */
  formatFailureMessage(): string {
    return `Tive um probleminha temporário ao gerar seu acesso automático agora. Mas você pode liberar seus 30 dias gratuitos em menos de 1 minuto pelo nosso cadastro oficial: https://axecloud.com.br/register

Se preferir, me avise que chamo nossa equipe para te ajudar!`;
  }
}
