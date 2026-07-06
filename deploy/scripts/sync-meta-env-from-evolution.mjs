/**
 * Lê token/phone da instância WHATSAPP-BUSINESS na Evolution e imprime linhas para .env
 * (não grava automaticamente — operador cola no .env da VPS).
 */
const key = process.env.EVOLUTION_API_KEY;
const base = (process.env.EVOLUTION_API_BASE_URL || "http://evolution:8080").replace(/\/$/, "");
const instance = process.env.WA_INSTANCE_NAME || "axecloud_console_admin";

if (!key) {
  console.error("EVOLUTION_API_KEY ausente");
  process.exit(1);
}

const res = await fetch(`${base}/instance/fetchInstances`, { headers: { apikey: key } });
const data = await res.json().catch(() => []);
const list = Array.isArray(data) ? data : data?.response || [];
const row = list.find((i) => (i.name || i.instance?.instanceName) === instance);
if (!row) {
  console.error(`Instância ${instance} não encontrada`);
  process.exit(1);
}

const token = String(row.token || row.instance?.token || "").trim();
const number = String(row.number || row.instance?.number || "").trim();
const businessId = String(row.businessId || row.instance?.businessId || "").trim();

if (!token || !number) {
  console.error("Token ou phone number id ausente na instância Evolution");
  process.exit(1);
}

console.log(`WA_META_TOKEN=${token}`);
console.log(`WA_PHONE_NUMBER_ID=${number}`);
if (businessId) console.log(`WA_BUSINESS_ACCOUNT_ID=${businessId}`);
