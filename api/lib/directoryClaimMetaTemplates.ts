type ClaimTemplateKind = "approval" | "reminder_24h" | "reminder_72h";

const LEGACY_APPROVAL_TEMPLATE = "reivindicacao_aprovada_axecloud";
const DESIRED_TEMPLATE_NAMES: Record<ClaimTemplateKind, string> = {
  approval: "reivindicacao_ativacao_v2_axecloud",
  reminder_24h: "reivindicacao_lembrete_24h_axecloud",
  reminder_72h: "reivindicacao_lembrete_72h_axecloud",
};

const ENV_BY_KIND: Record<ClaimTemplateKind, string> = {
  approval: "WA_META_TEMPLATE_REIVINDICACAO_ATIVACAO",
  reminder_24h: "WA_META_TEMPLATE_REIVINDICACAO_LEMBRETE_24H",
  reminder_72h: "WA_META_TEMPLATE_REIVINDICACAO_LEMBRETE_72H",
};

const TEMPLATE_DEFINITIONS = [
  {
    name: DESIRED_TEMPLATE_NAMES.approval,
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}! Confirmamos que você é responsável por {{2}}. O perfil da casa já está pronto no AxéCloud.\n\nAgora falta somente criar uma senha. Os dados da reivindicação já estarão preenchidos e a ativação leva cerca de 1 minuto.",
        example: { body_text: [["Mailson", "Terreiro de Umbanda Xango"]] },
      },
      { type: "FOOTER", text: "Convite de ativação do AxéCloud." },
      {
        type: "BUTTONS",
        buttons: [{
          type: "URL",
          text: "Ativar minha casa",
          url: "https://axecloud.com.br/register?claim={{1}}",
          example: ["11111111-1111-4111-8111-111111111111"],
        }],
      },
    ],
  },
  {
    name: DESIRED_TEMPLATE_NAMES.reminder_24h,
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}! A aprovação de {{2}} está confirmada, mas a ativação ainda não foi concluída.\n\nSeus dados já estão preenchidos. Crie uma senha para entrar no painel e administrar o perfil público da casa.",
        example: { body_text: [["Mailson", "Terreiro de Umbanda Xango"]] },
      },
      { type: "FOOTER", text: "Lembrete automático do AxéCloud." },
      {
        type: "BUTTONS",
        buttons: [{
          type: "URL",
          text: "Continuar ativação",
          url: "https://axecloud.com.br/register?claim={{1}}",
          example: ["11111111-1111-4111-8111-111111111111"],
        }],
      },
    ],
  },
  {
    name: DESIRED_TEMPLATE_NAMES.reminder_72h,
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}! O perfil de {{2}} continua aguardando sua ativação.\n\nCrie sua senha para assumir as fotos, a biografia, os contatos e as informações públicas da casa no Radar AxéCloud.",
        example: { body_text: [["Mailson", "Terreiro de Umbanda Xango"]] },
      },
      { type: "FOOTER", text: "Lembrete automático do AxéCloud." },
      {
        type: "BUTTONS",
        buttons: [{
          type: "URL",
          text: "Ativar perfil da casa",
          url: "https://axecloud.com.br/register?claim={{1}}",
          example: ["11111111-1111-4111-8111-111111111111"],
        }],
      },
    ],
  },
] as const;

type TemplateStatus = { name: string; status: string; id?: string; rejectedReason?: string | null };
let statusCache: { expiresAt: number; values: Map<string, TemplateStatus> } | null = null;

function metaConfig() {
  const token = String(process.env.WA_META_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || "").trim();
  const wabaId = String(
    process.env.WA_BUSINESS_ACCOUNT_ID ||
    process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID ||
    process.env.WA_WABA_ID ||
    "",
  ).trim();
  const version = String(process.env.WA_BUSINESS_VERSION || process.env.META_WHATSAPP_API_VERSION || "v21.0").trim();
  return token && wabaId ? { token, wabaId, version } : null;
}

async function graph(path: string, init?: RequestInit) {
  const config = metaConfig();
  if (!config) throw new Error("Meta Cloud não configurada para sincronizar templates.");
  const response = await fetch(`https://graph.facebook.com/${config.version}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) {
    const message = String(payload?.error?.message || `Meta respondeu HTTP ${response.status}`);
    throw new Error(message.slice(0, 280));
  }
  return payload;
}

async function loadStatuses(force = false): Promise<Map<string, TemplateStatus>> {
  if (!force && statusCache && statusCache.expiresAt > Date.now()) return statusCache.values;
  const config = metaConfig();
  if (!config) return new Map();
  const fields = "id,name,status,category,language,rejected_reason";
  const payload = await graph(`${config.wabaId}/message_templates?limit=250&fields=${encodeURIComponent(fields)}`);
  const values = new Map<string, TemplateStatus>();
  for (const row of Array.isArray(payload.data) ? payload.data : []) {
    const name = String(row?.name || "");
    if (name) values.set(name, {
      name,
      status: String(row?.status || "UNKNOWN").toUpperCase(),
      id: row?.id ? String(row.id) : undefined,
      rejectedReason: row?.rejected_reason ? String(row.rejected_reason) : null,
    });
  }
  statusCache = { expiresAt: Date.now() + 10 * 60 * 1000, values };
  return values;
}

export async function resolveDirectoryClaimTemplateName(kind: ClaimTemplateKind): Promise<string> {
  const explicit = String(process.env[ENV_BY_KIND[kind]] || "").trim();
  if (explicit) return explicit;
  const desired = DESIRED_TEMPLATE_NAMES[kind];
  try {
    const statuses = await loadStatuses();
    return statuses.get(desired)?.status === "APPROVED" ? desired : LEGACY_APPROVAL_TEMPLATE;
  } catch (error) {
    console.warn("[directory-claim/templates] status:", error instanceof Error ? error.message : error);
    return LEGACY_APPROVAL_TEMPLATE;
  }
}

export async function ensureDirectoryClaimTemplates(): Promise<Array<TemplateStatus & { action: string }>> {
  const config = metaConfig();
  if (!config) return [];
  const statuses = await loadStatuses(true);
  const results: Array<TemplateStatus & { action: string }> = [];
  for (const definition of TEMPLATE_DEFINITIONS) {
    const existing = statuses.get(definition.name);
    if (existing) {
      results.push({ ...existing, action: "exists" });
      continue;
    }
    try {
      const created = await graph(`${config.wabaId}/message_templates`, {
        method: "POST",
        body: JSON.stringify(definition),
      });
      const item = {
        name: definition.name,
        status: String(created?.status || "PENDING").toUpperCase(),
        id: created?.id ? String(created.id) : undefined,
        action: "created",
      };
      statuses.set(definition.name, item);
      results.push(item);
    } catch (error) {
      results.push({
        name: definition.name,
        status: "ERROR",
        rejectedReason: error instanceof Error ? error.message : String(error),
        action: "failed",
      });
    }
  }
  statusCache = { expiresAt: Date.now() + 10 * 60 * 1000, values: statuses };
  return results;
}
