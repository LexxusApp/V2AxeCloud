/**
 * Mensagem de boas-vindas enviada por WhatsApp (instância do console admin)
 * sempre que um terreiro é criado em /api/admin/create-tenant.
 *
 * Persistência: tabela `global_settings`, id = `welcome_message`.
 * O catálogo aceita esta linha — não é necessária migração extra.
 */

export type WelcomeMessageConfig = {
  enabled: boolean;
  template: string;
  loginUrl: string;
  signature: string;
};

export const WELCOME_MESSAGE_DEFAULT: WelcomeMessageConfig = {
  enabled: true,
  loginUrl: "https://axecloud.com.br",
  signature: "Equipe AxéCloud",
  template:
    "Axé, {{nome_zelador}}! 🌿\n" +
    "Seu terreiro *{{nome_terreiro}}* foi cadastrado no AxéCloud com sucesso.\n\n" +
    "🔐 *Acesso ao painel:*\n" +
    "Site: {{site}}\n" +
    "E-mail: {{email}}\n" +
    "Senha: {{senha}}\n\n" +
    "📘 *Instruções de uso e acesso:*\n" +
    "https://axecloud.com.br/instrucoes\n\n" +
    "Lá explicamos o painel e como seus filhos de santo entram (Registro + 6 dígitos do CPF).\n" +
    "No app do membro: giras, mensalidade, obrigações, recados e chat com a casa.\n\n" +
    "Qualquer dúvida estamos aqui.\n\n" +
    "— {{assinatura}}",
};

const WELCOME_KEYS: ReadonlyArray<keyof WelcomeMessageConfig> = [
  "enabled",
  "template",
  "loginUrl",
  "signature",
];

/**
 * Frase antiga (recomendação de troca de senha) removida — a senha gerada é permanente.
 * Mantemos esta limpeza para migrar templates salvos antes desta mudança.
 */
const DEPRECATED_PHRASES: ReadonlyArray<string> = [
  "Recomendamos entrar e alterar a sua senha no primeiro acesso. ",
  "Recomendamos entrar e alterar a sua senha no primeiro acesso.",
  "Recomendamos entrar e alterar sua senha no primeiro acesso. ",
  "Recomendamos entrar e alterar sua senha no primeiro acesso.",
];

function stripDeprecatedPhrases(template: string): string {
  let out = template;
  for (const ph of DEPRECATED_PHRASES) {
    out = out.split(ph).join("");
  }
  // Limpa eventuais espaços/linhas duplicadas deixadas pela remoção.
  out = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return out;
}

function coerceConfig(raw: unknown): WelcomeMessageConfig {
  if (!raw || typeof raw !== "object") return { ...WELCOME_MESSAGE_DEFAULT };
  const o = raw as Record<string, unknown>;
  const rawTemplate =
    typeof o.template === "string" && o.template.trim() ? o.template : WELCOME_MESSAGE_DEFAULT.template;
  return {
    enabled:
      typeof o.enabled === "boolean" ? o.enabled : WELCOME_MESSAGE_DEFAULT.enabled,
    template: stripDeprecatedPhrases(rawTemplate),
    loginUrl:
      typeof o.loginUrl === "string" && o.loginUrl.trim()
        ? o.loginUrl.trim()
        : WELCOME_MESSAGE_DEFAULT.loginUrl,
    signature:
      typeof o.signature === "string" && o.signature.trim()
        ? o.signature.trim()
        : WELCOME_MESSAGE_DEFAULT.signature,
  };
}

export async function loadWelcomeMessageConfig(
  supabaseAdmin: { from: (t: string) => any }
): Promise<WelcomeMessageConfig> {
  try {
    const { loadGlobalSettingPayload } = await import("./globalSettings.js");
    const raw = await loadGlobalSettingPayload(supabaseAdmin as any, "welcome_message");
    return coerceConfig(raw);
  } catch (e: any) {
    console.warn("[welcomeMessage] load exception:", e?.message || e);
    return { ...WELCOME_MESSAGE_DEFAULT };
  }
}

export async function saveWelcomeMessageConfig(
  supabaseAdmin: { from: (t: string) => any },
  partial: Partial<WelcomeMessageConfig>
): Promise<WelcomeMessageConfig> {
  const current = await loadWelcomeMessageConfig(supabaseAdmin);
  const next: WelcomeMessageConfig = { ...current };
  for (const k of WELCOME_KEYS) {
    if (k in partial && partial[k] !== undefined) {
      // @ts-expect-error narrowing por chave
      next[k] = partial[k];
    }
  }
  next.template = String(next.template || WELCOME_MESSAGE_DEFAULT.template);
  next.loginUrl = String(next.loginUrl || WELCOME_MESSAGE_DEFAULT.loginUrl).trim();
  next.signature = String(next.signature || WELCOME_MESSAGE_DEFAULT.signature).trim();
  const { saveGlobalSettingPayload } = await import("./globalSettings.js");
  await saveGlobalSettingPayload(supabaseAdmin as any, "welcome_message", next);
  return next;
}

export function renderWelcomeMessage(
  template: string,
  vars: {
    nome_terreiro?: string;
    nome_zelador?: string;
    email?: string;
    senha?: string;
    site?: string;
    assinatura?: string;
  }
): string {
  const map: Record<string, string> = {
    nome_terreiro: vars.nome_terreiro || "",
    nome_zelador: vars.nome_zelador || "",
    email: vars.email || "",
    senha: vars.senha || "",
    site: vars.site || "",
    assinatura: vars.assinatura || "Equipe AxéCloud",
  };
  return String(template || "").replace(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g, (_, key) => {
    const v = map[String(key)];
    return typeof v === "string" ? v : "";
  });
}

/**
 * Normaliza um WhatsApp BR para o formato MSISDN (DDI + DDD + linha) aceito
 * pela Evolution. Devolve null se o número não tiver dígitos suficientes.
 */
export function normalizeBrazilMsisdn(raw: string): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length >= 11) return digits; // outro DDI estrangeiro
  return null;
}

/**
 * Envia boas-vindas do zelador.
 * Se `WA_META_TEMPLATE_BOAS_VINDAS_ZELADOR` estiver setada e a Cloud API direta
 * estiver configurada, tenta o template Meta (abre janela 24h) + follow-up com
 * senha em texto livre. Caso contrário (ou se o template falhar), usa texto livre.
 */
export async function dispatchZeladorWelcomeWhatsApp(opts: {
  msisdn: string;
  freeText: string;
  nome_zelador: string;
  nome_terreiro: string;
  email: string;
  senha?: string;
  site?: string;
}): Promise<{ channel: "meta_template" | "text"; messageId?: string }> {
  const { sendEvolutionTextQueued } = await import("./evolutionSendQueue.js");
  const { CONSOLE_ADMIN_INSTANCE_NAME } = await import("../../src/services/evolution.service.js");
  const envTemplate = String(process.env.WA_META_TEMPLATE_BOAS_VINDAS_ZELADOR || "").trim();

  if (envTemplate) {
    try {
      const { isMetaCloudDirectConfigured, sendMetaCloudTemplate, sendMetaCloudText } =
        await import("./metaCloudSend.js");
      if (isMetaCloudDirectConfigured()) {
        const {
          buildBoasVindasZeladorComponents,
          resolveMetaTemplateLanguage,
          resolveMetaTemplateName,
        } = await import("./whatsappMetaCloud.js");
        const templateName = resolveMetaTemplateName("boas_vindas_zelador");
        const components = buildBoasVindasZeladorComponents(
          opts.nome_zelador,
          opts.nome_terreiro,
          {
            nome_zelador: opts.nome_zelador,
            nome_terreiro: opts.nome_terreiro,
            email: opts.email,
          }
        );
        const out = await sendMetaCloudTemplate(
          opts.msisdn,
          templateName,
          resolveMetaTemplateLanguage(),
          components
        );
        const senha = String(opts.senha || "").trim();
        if (senha) {
          const site = String(opts.site || "https://axecloud.com.br").trim();
          const followUp =
            `🔐 Acesso ao painel:\nSite: ${site}\nE-mail: ${opts.email}\nSenha: ${senha}\n\n— Equipe AxéCloud`;
          try {
            await sendMetaCloudText(opts.msisdn, followUp);
          } catch (followErr: unknown) {
            console.warn(
              "[welcome] follow-up senha após template falhou:",
              followErr instanceof Error ? followErr.message : followErr
            );
          }
        }
        return { channel: "meta_template", messageId: out?.messageId };
      }
    } catch (err: unknown) {
      console.warn(
        "[welcome] template Meta boas_vindas_zelador falhou, fallback texto:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const out = await sendEvolutionTextQueued(
    CONSOLE_ADMIN_INSTANCE_NAME,
    opts.msisdn,
    opts.freeText
  );
  return { channel: "text", messageId: out?.messageId };
}
