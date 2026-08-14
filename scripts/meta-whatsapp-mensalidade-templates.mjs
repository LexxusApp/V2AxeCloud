/**
 * Cria os templates de mensalidade (disponível + pendente + vence hoje) na Meta Cloud API.
 *
 *   node --env-file=.env scripts/meta-whatsapp-mensalidade-templates.mjs
 */
function env(...keys) {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (value) return value;
  }
  return "";
}

const token = env("WA_META_TOKEN", "META_WHATSAPP_ACCESS_TOKEN");
const wabaId = env("WA_BUSINESS_ACCOUNT_ID", "META_WHATSAPP_BUSINESS_ACCOUNT_ID", "WA_WABA_ID");
const version = env("WA_BUSINESS_VERSION", "META_WHATSAPP_API_VERSION") || "v21.0";

if (!token || !wabaId) {
  console.error("Meta Cloud não configurada: token ou WABA ausente.");
  process.exit(1);
}

const templates = [
  {
    name: "mensalidade_disponivel_axecloud",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}! A mensalidade de {{2}} no valor de R$ {{3}} já está disponível para pagamento no {{4}}.\n\nSua contribuição fortalece a casa. Axé!",
        example: { body_text: [["Maria Silva", "agosto de 2026", "150,00", "Terreiro de Oxum"]] },
      },
    ],
  },
  {
    name: "lembrete_mensalidade_pendente_axecloud",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}! Lembramos que sua mensalidade de {{2}} no valor de R$ {{3}} ainda está pendente no {{4}}.\n\nQuando puder, regularize pelo portal da casa. Axé!",
        example: { body_text: [["Maria Silva", "08/2026 (venc. 15/08/2026)", "150,00", "Terreiro de Oxum"]] },
      },
    ],
  },
  {
    name: "mensalidade_vence_hoje_axecloud",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}! Sua mensalidade de {{2}} no valor de R$ {{3}} vence hoje no {{4}}.\n\nQuando puder, regularize pelo portal da casa. Axé!",
        example: { body_text: [["Maria Silva", "agosto de 2026", "150,00", "Terreiro de Oxum"]] },
      },
    ],
  },
];

async function graph(method, path, body) {
  const res = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function ensureTemplate(template) {
  const listed = await graph(
    "GET",
    `${wabaId}/message_templates?name=${encodeURIComponent(template.name)}&fields=id,name,status,category,language,rejected_reason`
  );
  const existing = listed.json?.data?.[0];
  if (existing?.status === "APPROVED" || existing?.status === "PENDING") {
    return { name: template.name, status: existing.status, id: existing.id, action: "exists" };
  }
  const created = await graph("POST", `${wabaId}/message_templates`, template);
  if (!created.ok) {
    return { name: template.name, status: "error", error: created.json, action: "create" };
  }
  return {
    name: template.name,
    status: created.json?.status || "submitted",
    id: created.json?.id,
    action: "create",
  };
}

const results = [];
for (const template of templates) {
  results.push(await ensureTemplate(template));
}
console.log(JSON.stringify(results, null, 2));
