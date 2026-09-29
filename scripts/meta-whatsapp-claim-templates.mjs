/**
 * Cria/consulta os templates de reivindicação de terreiro na Meta Cloud API.
 *
 *   node --env-file=.env scripts/meta-whatsapp-claim-templates.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    /* ok */
  }
}

loadEnvFile(resolve(root, ".env"));

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
    name: "reivindicacao_ativacao_v2_axecloud",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}! Confirmamos que você é responsável por {{2}}. O perfil da casa já está pronto no AxéCloud.\n\nAgora falta somente criar uma senha. Os dados da reivindicação já estarão preenchidos e a ativação leva cerca de 1 minuto.",
        example: { body_text: [["Mailson", "Terreiro de Umbanda Xango"]] },
      },
      {
        type: "FOOTER",
        text: "Convite de ativação do AxéCloud.",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Ativar minha casa",
            url: "https://axecloud.com.br/register?claim={{1}}",
            example: ["11111111-1111-4111-8111-111111111111"],
          },
        ],
      },
    ],
  },
  {
    name: "reivindicacao_lembrete_24h_axecloud",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}! A aprovação de {{2}} está confirmada, mas a ativação ainda não foi concluída.\n\nSeus dados já estão preenchidos. Crie uma senha para entrar no painel e administrar o perfil público da casa.",
        example: { body_text: [["Mailson", "Terreiro de Umbanda Xango"]] },
      },
      {
        type: "FOOTER",
        text: "Lembrete automático do AxéCloud.",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Continuar ativação",
            url: "https://axecloud.com.br/register?claim={{1}}",
            example: ["11111111-1111-4111-8111-111111111111"],
          },
        ],
      },
    ],
  },
  {
    name: "reivindicacao_lembrete_72h_axecloud",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}! O perfil de {{2}} continua aguardando sua ativação.\n\nCrie sua senha para assumir as fotos, a biografia, os contatos e as informações públicas da casa no Radar AxéCloud.",
        example: { body_text: [["Mailson", "Terreiro de Umbanda Xango"]] },
      },
      {
        type: "FOOTER",
        text: "Lembrete automático do AxéCloud.",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Ativar perfil da casa",
            url: "https://axecloud.com.br/register?claim={{1}}",
            example: ["11111111-1111-4111-8111-111111111111"],
          },
        ],
      },
    ],
  },
  {
    name: "reivindicacao_aprovada_axecloud",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}! A reivindicação do perfil {{2}} no diretório AxéCloud foi aprovada.\n\nCrie o acesso com o mesmo e-mail da solicitação. Ao concluir, a casa será conectada automaticamente à sua conta.\n\nUse o botão abaixo para cadastrar.",
        example: { body_text: [["Mailson", "Terreiro de Umbanda Xango"]] },
      },
      {
        type: "FOOTER",
        text: "Mensagem automática. Não responda.",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Criar acesso",
            url: "https://axecloud.com.br/register?claim={{1}}",
            example: ["11111111-1111-4111-8111-111111111111"],
          },
        ],
      },
    ],
  },
  {
    name: "reivindicacao_conectada_axecloud",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}! A reivindicação do perfil {{2}} no diretório AxéCloud foi aprovada e a casa já está conectada à sua conta.\n\nEntre no painel com o mesmo e-mail da solicitação.\n\nUse o botão abaixo para acessar.",
        example: { body_text: [["Mailson", "Terreiro de Umbanda Xango"]] },
      },
      {
        type: "FOOTER",
        text: "Mensagem automática. Não responda.",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Entrar no painel",
            url: "https://axecloud.com.br/entrar",
          },
        ],
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
    `${wabaId}/message_templates?name=${encodeURIComponent(template.name)}&fields=id,name,status,category,language,rejected_reason`,
  );
  const existing = listed.json?.data?.[0];
  if (existing?.status === "APPROVED" || existing?.status === "PENDING") {
    return {
      name: template.name,
      status: existing.status,
      id: existing.id,
      action: "exists",
      rejectedReason: existing.rejected_reason || null,
    };
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
if (results.some((item) => item.status === "error")) process.exitCode = 1;
