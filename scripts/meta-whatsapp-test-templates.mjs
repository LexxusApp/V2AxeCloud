/**
 * Testa os templates Meta aprovados via Evolution (instância oficial).
 *
 * Uso (na VPS ou local com .env):
 *   node scripts/meta-whatsapp-test-templates.mjs
 *   node scripts/meta-whatsapp-test-templates.mjs 5511999999999
 *   node scripts/meta-whatsapp-test-templates.mjs 5511999999999 financeiro
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
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

const INSTANCE = process.env.EVOLUTION_CONSOLE_INSTANCE || "axecloud_console_admin";
const API_KEY = process.env.EVOLUTION_API_KEY || "";
const BASE = (process.env.EVOLUTION_API_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const LANG = (process.env.WA_META_TEMPLATE_LANGUAGE || "pt_BR").trim();
const TO = (process.argv[2] || process.env.AUTOPOST_WHATSAPP_TO || "5511920033501").replace(/\D/g, "");
const ONLY = (process.argv[3] || "").trim().toLowerCase();

const TEMPLATES = {
  financeiro: {
    name: process.env.WA_META_TEMPLATE_FINANCEIRO || "financeiro_axecloud",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: "Maria Silva (teste)" },
          { type: "text", text: "150,00" },
          { type: "text", text: "10/06/2026" },
          { type: "text", text: "Terreiro AxéCloud Teste" },
        ],
      },
    ],
  },
  cobranca_mensalidade: {
    name: process.env.WA_META_TEMPLATE_COBRANCA_MENSALIDADE || "cobranca_mensalidade_axecloud",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: "João Santos (teste)" },
          { type: "text", text: "06/2026" },
          { type: "text", text: "150,00" },
          { type: "text", text: "Casa de Umbanda Axé" },
        ],
      },
    ],
  },
  mensalidade_confirmada: {
    name: process.env.WA_META_TEMPLATE_MENSALIDADE_CONFIRMADA || "mensalidade_confirmada_axecloud",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: "Ana Costa (teste)" },
          { type: "text", text: "06/2026" },
          { type: "text", text: "150,00" },
          { type: "text", text: "Terreiro de Ogum" },
        ],
      },
    ],
  },
  estoque_critico: {
    name: process.env.WA_META_TEMPLATE_ESTOQUE_CRITICO || "estoque_critico_axecloud",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: "Vela branca 7 dias" },
          { type: "text", text: "2" },
          { type: "text", text: "Terreiro AxéCloud Teste" },
        ],
      },
    ],
  },
  comunicado: {
    name: process.env.WA_META_TEMPLATE_BROADCAST || "comunicado_terreiro_axecloud",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: "Lucas (teste)" },
          { type: "text", text: "Terreiro AxéCloud Teste" },
          {
            type: "text",
            text: "Teste de template aprovado na Meta. Se você recebeu isto, o canal oficial está OK.",
          },
        ],
      },
    ],
  },
};

async function evolutionApi(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { apikey: API_KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function main() {
  if (!API_KEY) {
    console.error("EVOLUTION_API_KEY não definido.");
    process.exit(1);
  }

  console.log("=== connectionState ===");
  const conn = await evolutionApi("GET", `/instance/connectionState/${INSTANCE}`);
  console.log(JSON.stringify(conn, null, 2));

  const entries = Object.entries(TEMPLATES).filter(([k]) => !ONLY || k === ONLY || k.includes(ONLY));
  if (!entries.length) {
    console.error(`Template desconhecido: ${ONLY}`);
    process.exit(1);
  }

  const results = [];
  for (const [key, tpl] of entries) {
    console.log(`\n=== ${key} → ${tpl.name} ===`);
    const body = {
      number: TO,
      name: tpl.name,
      language: LANG,
      components: tpl.components,
    };
    const res = await evolutionApi("POST", `/message/sendTemplate/${INSTANCE}`, body);
    console.log("Status:", res.status);
    console.log("Resposta:", JSON.stringify(res.data, null, 2));
    results.push({ key, template: tpl.name, ok: res.status >= 200 && res.status < 300, status: res.status });
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log("\n=== RESUMO ===");
  for (const r of results) {
    console.log(`${r.ok ? "OK" : "FALHA"}  ${r.key} (${r.template}) — HTTP ${r.status}`);
  }

  const failed = results.filter((r) => !r.ok);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
