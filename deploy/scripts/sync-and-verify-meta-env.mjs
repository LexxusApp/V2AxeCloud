/**
 * Lê Meta token/phone da Evolution (instância console) e atualiza /opt/axecloud/.env.
 * Não imprime segredos.
 */
import { readFileSync, writeFileSync } from "node:fs";

const envPath = process.env.AXE_ENV_PATH || "/opt/axecloud/.env";
const key = String(process.env.EVOLUTION_API_KEY || "").trim();
const base = String(process.env.EVOLUTION_API_BASE_URL || "http://evolution:8080")
  .trim()
  .replace(/\/$/, "");
const instance = String(process.env.WA_INSTANCE_NAME || "axecloud_console_admin").trim();

function parseEnv(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

function upsertEnv(text, updates) {
  const seen = new Set();
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#") || !line.includes("=")) {
      out.push(line);
      continue;
    }
    const keyName = line.slice(0, line.indexOf("=")).trim();
    if (Object.prototype.hasOwnProperty.call(updates, keyName)) {
      out.push(`${keyName}=${updates[keyName]}`);
      seen.add(keyName);
    } else {
      out.push(line);
    }
  }
  for (const [k, v] of Object.entries(updates)) {
    if (!seen.has(k)) out.push(`${k}=${v}`);
  }
  return out.join("\n").replace(/\n*$/, "\n");
}

if (!key) {
  console.error("EVOLUTION_API_KEY ausente no runtime");
  process.exit(1);
}

const res = await fetch(`${base}/instance/fetchInstances`, {
  headers: { apikey: key },
});
const data = await res.json().catch(() => []);
const list = Array.isArray(data) ? data : data?.response || [];
const row = list.find((i) => (i.name || i.instance?.instanceName) === instance);
if (!row) {
  console.error(`INSTANCIA_NAO_ENCONTRADA=${instance}`);
  console.log(`INSTANCIAS=${list.map((i) => i.name || i.instance?.instanceName).filter(Boolean).join(",")}`);
  process.exit(2);
}

const token = String(row.token || row.instance?.token || "").trim();
const number = String(row.number || row.instance?.number || row.ownerJid || "").trim();
const businessId = String(row.businessId || row.instance?.businessId || "").trim();
const integration = String(row.integration || row.instance?.integration || "").trim();

console.log(`INSTANCE=${instance}`);
console.log(`INTEGRATION=${integration || "?"}`);
console.log(`TOKEN_FROM_EVO=${token ? "SET" : "MISSING"}`);
console.log(`PHONE_FROM_EVO=${number ? "SET" : "MISSING"}`);
console.log(`BUSINESS_FROM_EVO=${businessId ? "SET" : "MISSING"}`);

if (!token || !number) {
  process.exit(3);
}

// number na Evolution Cloud costuma ser phone_number_id; se parecer telefone, ainda assim gravamos.
const updates = {
  WA_META_TOKEN: token,
  WA_PHONE_NUMBER_ID: number.replace(/\D/g, "") || number,
};
if (businessId) updates.WA_BUSINESS_ACCOUNT_ID = businessId;

const original = readFileSync(envPath, "utf8");
const next = upsertEnv(original, updates);
writeFileSync(envPath, next);
console.log("ENV_UPDATED=yes");

const version = String(parseEnv(next).WA_BUSINESS_VERSION || "v21.0").trim();
const phoneId = updates.WA_PHONE_NUMBER_ID;
const graphRes = await fetch(
  `https://graph.facebook.com/${version}/${phoneId}?fields=display_phone_number,verified_name`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const body = await graphRes.json().catch(() => ({}));
const err = body?.error;
console.log(`GRAPH_HTTP=${graphRes.status}`);
console.log(`GRAPH_API=${graphRes.ok ? "OK" : "FAIL"}`);
if (!graphRes.ok) {
  console.log(`GRAPH_CODE=${err?.code ?? "?"}`);
  console.log(`GRAPH_MSG=${String(err?.message || "").slice(0, 180)}`);
} else {
  console.log(`DISPLAY=${body.display_phone_number ? "SET" : "MISSING"}`);
  console.log(`VERIFIED_NAME=${body.verified_name ? "SET" : "MISSING"}`);
}
