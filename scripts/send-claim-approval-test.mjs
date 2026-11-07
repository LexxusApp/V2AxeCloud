/**
 * Teste: envia template reivindicacao_aprovada_axecloud para um número.
 *
 *   node scripts/send-claim-approval-test.mjs 5511920033501 [claimId]
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
const phoneId = env("WA_PHONE_NUMBER_ID", "META_WHATSAPP_PHONE_NUMBER_ID");
const version = env("WA_BUSINESS_VERSION", "META_WHATSAPP_API_VERSION") || "v21.0";
const template =
  env("WA_META_TEMPLATE_REIVINDICACAO_APROVADA") || "reivindicacao_aprovada_axecloud";
const language = env("WA_META_TEMPLATE_LANGUAGE") || "pt_BR";

let to = String(process.argv[2] || "").replace(/\D/g, "");
if (!to) {
  console.error("Uso: node scripts/send-claim-approval-test.mjs 5511920033501 [claimId]");
  process.exit(1);
}
if (!to.startsWith("55") && (to.length === 10 || to.length === 11)) to = `55${to}`;

const claimId =
  String(process.argv[3] || "").trim() || "11111111-1111-4111-8111-111111111111";
const nome = String(process.argv[4] || "Lucas").trim() || "Lucas";
const terreiro = String(process.argv[5] || "Terreiro de teste AxéCloud").trim();

if (!token || !phoneId) {
  console.error("Meta Cloud não configurada (token / phone number id).");
  process.exit(1);
}

const body = {
  messaging_product: "whatsapp",
  to,
  type: "template",
  template: {
    name: template,
    language: { code: language },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: nome.slice(0, 60) },
          { type: "text", text: terreiro.slice(0, 80) },
        ],
      },
      {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: claimId.slice(0, 80) }],
      },
    ],
  },
};

const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});
const json = await res.json().catch(() => ({}));
const link = `https://axecloud.com.br/register?claim=${encodeURIComponent(claimId)}`;
console.log(
  JSON.stringify(
    {
      ok: res.ok,
      status: res.status,
      to,
      template,
      link,
      messageId: json?.messages?.[0]?.id || null,
      error: json?.error || null,
    },
    null,
    2,
  ),
);
if (!res.ok) process.exitCode = 1;
