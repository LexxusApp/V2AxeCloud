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
  loginUrl: "https://axecloud-app.vercel.app",
  signature: "Equipe AxéCloud",
  template:
    "Axé, {{nome_zelador}}! 🌿\n" +
    "Seu terreiro *{{nome_terreiro}}* foi cadastrado no AxéCloud com sucesso.\n\n" +
    "🔐 *Acesso ao painel:*\n" +
    "Site: {{site}}\n" +
    "E-mail: {{email}}\n" +
    "Senha: {{senha}}\n\n" +
    "Recomendamos entrar e alterar a sua senha no primeiro acesso. Qualquer dúvida estamos aqui.\n\n" +
    "— {{assinatura}}",
};

const WELCOME_KEYS: ReadonlyArray<keyof WelcomeMessageConfig> = [
  "enabled",
  "template",
  "loginUrl",
  "signature",
];

function coerceConfig(raw: unknown): WelcomeMessageConfig {
  if (!raw || typeof raw !== "object") return { ...WELCOME_MESSAGE_DEFAULT };
  const o = raw as Record<string, unknown>;
  return {
    enabled:
      typeof o.enabled === "boolean" ? o.enabled : WELCOME_MESSAGE_DEFAULT.enabled,
    template:
      typeof o.template === "string" && o.template.trim()
        ? o.template
        : WELCOME_MESSAGE_DEFAULT.template,
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
    const { data, error } = await supabaseAdmin
      .from("global_settings")
      .select("value")
      .eq("id", "welcome_message")
      .maybeSingle();
    if (error) {
      console.warn("[welcomeMessage] load:", error.message);
      return { ...WELCOME_MESSAGE_DEFAULT };
    }
    return coerceConfig(data?.value);
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
  const { error } = await supabaseAdmin
    .from("global_settings")
    .upsert({ id: "welcome_message", value: next }, { onConflict: "id" });
  if (error) {
    console.error("[welcomeMessage] save:", error.message);
    throw new Error(error.message);
  }
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
