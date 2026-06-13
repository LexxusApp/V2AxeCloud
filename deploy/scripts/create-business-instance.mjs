/**
 * Cria instância WHATSAPP-BUSINESS (Meta Cloud API) na Evolution v2.
 * Uso na VPS:
 *   docker compose -f deploy/docker-compose.yml --env-file .env exec -T app \
 *     node /opt/axecloud/deploy/scripts/create-business-instance.mjs
 *
 * Variáveis (env):
 *   EVOLUTION_API_KEY, EVOLUTION_API_BASE_URL
 *   WA_INSTANCE_NAME (default: axecloud_console_admin)
 *   WA_META_TOKEN, WA_PHONE_NUMBER_ID, WA_BUSINESS_ACCOUNT_ID
 */
const key = process.env.EVOLUTION_API_KEY;
const base = (process.env.EVOLUTION_API_BASE_URL || "http://evolution:8080").replace(/\/$/, "");

const instanceName = process.env.WA_INSTANCE_NAME || "axecloud_console_admin";
const token = process.env.WA_META_TOKEN;
const number = process.env.WA_PHONE_NUMBER_ID;
const businessId = process.env.WA_BUSINESS_ACCOUNT_ID;

if (!key || !token || !number || !businessId) {
  console.error("Faltam env: EVOLUTION_API_KEY, WA_META_TOKEN, WA_PHONE_NUMBER_ID, WA_BUSINESS_ACCOUNT_ID");
  process.exit(1);
}

const headers = { apikey: key, "Content-Type": "application/json" };

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  console.log(JSON.stringify({ method, path, status: res.status, body: parsed }, null, 2));
  return { status: res.status, parsed };
}

const existing = await call("GET", "/instance/fetchInstances");
const list = Array.isArray(existing.parsed) ? existing.parsed : existing.parsed?.response || [];
const found = list.find((i) => (i.name || i.instance?.instanceName) === instanceName);

if (found) {
  console.log(`Instância "${instanceName}" já existe — removendo para recriar com Cloud API...`);
  await call("DELETE", `/instance/logout/${encodeURIComponent(instanceName)}`);
  await call("DELETE", `/instance/delete/${encodeURIComponent(instanceName)}`);
}

const createBody = {
  instanceName,
  token,
  number: String(number),
  businessId: String(businessId),
  qrcode: false,
  integration: "WHATSAPP-BUSINESS",
};

const created = await call("POST", "/instance/create", createBody);
if (created.status >= 400) {
  process.exit(1);
}

await call("GET", `/instance/connectionState/${encodeURIComponent(instanceName)}`);
await call("GET", `/instance/fetchInstances`);
