/**
 * Cria/consulta os templates de prospecção do AxéCloud na Meta Cloud API.
 * Usa apenas variáveis do ambiente do servidor e nunca imprime o token.
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
    name: "axecloud_prospeccao_inicial",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      {
        type: "BODY",
        text: "Olá! Falo do AxéCloud, uma plataforma de gestão criada para apoiar terreiros na organização de membros, agenda, financeiro e comunicação. Você pediu informações para {{1}}. Posso enviar uma apresentação curta e o acesso ao teste gratuito de 30 dias? Para não receber mensagens, responda SAIR.",
        example: { body_text: [["Ilê Axé Exemplo"]] },
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Quero conhecer" },
          { type: "QUICK_REPLY", text: "Sair" },
        ],
      },
    ],
  },
  {
    name: "axecloud_prospeccao_retorno_1",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      {
        type: "BODY",
        text: "Olá! Retomando seu interesse no AxéCloud para {{1}}. O teste dura 30 dias, não exige cartão e funciona pelo celular. Quer receber o link e um resumo de como funciona? Para não receber novas mensagens, responda SAIR.",
        example: { body_text: [["Ilê Axé Exemplo"]] },
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Enviar apresentação" },
          { type: "QUICK_REPLY", text: "Sair" },
        ],
      },
    ],
  },
  {
    name: "axecloud_prospeccao_retorno_final",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      {
        type: "BODY",
        text: "Esta é a última mensagem sobre o AxéCloud para {{1}}. Se ainda quiser conhecer a plataforma de gestão para terreiros, responda QUERO. Caso contrário, encerraremos este contato. Para sair agora, responda SAIR.",
        example: { body_text: [["Ilê Axé Exemplo"]] },
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Quero conhecer" },
          { type: "QUICK_REPLY", text: "Sair" },
        ],
      },
    ],
  },
];

async function graph(method, path, body) {
  const response = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

const results = [];
for (const template of templates) {
  const lookup = await graph(
    "GET",
    `${wabaId}/message_templates?name=${encodeURIComponent(template.name)}&fields=id,name,status,category,language,rejected_reason`,
  );
  const existing = Array.isArray(lookup.data?.data) ? lookup.data.data[0] : null;
  if (existing) {
    results.push({ name: template.name, action: "existing", status: existing.status, category: existing.category, rejectedReason: existing.rejected_reason || null });
    continue;
  }

  const created = await graph("POST", `${wabaId}/message_templates`, template);
  results.push({
    name: template.name,
    action: created.ok ? "submitted" : "failed",
    status: created.data?.status || null,
    id: created.data?.id || null,
    error: created.ok ? null : String(created.data?.error?.message || `HTTP ${created.status}`).slice(0, 300),
  });
}

console.log(JSON.stringify(results, null, 2));
if (results.some((item) => item.action === "failed")) process.exitCode = 1;
