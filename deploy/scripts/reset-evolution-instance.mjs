/**
 * Uso na VPS (rede Docker):
 * docker compose -f deploy/docker-compose.yml --env-file .env exec -T app node /opt/axecloud/deploy/scripts/reset-evolution-instance.mjs <instanceName> [phoneDigits]
 */
const inst = process.argv[2];
const phone = process.argv[3];
const key = process.env.EVOLUTION_API_KEY;
const base = (process.env.EVOLUTION_API_BASE_URL || "http://evolution:8080").replace(/\/$/, "");

if (!inst || !key) {
  console.error("Uso: node reset-evolution-instance.mjs <instanceName> [phone]");
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
  console.log(method, path, res.status, text.slice(0, 500));
  return { status: res.status, text };
}

await call("DELETE", `/instance/logout/${encodeURIComponent(inst)}`);
await call("DELETE", `/instance/delete/${encodeURIComponent(inst)}`);
if (phone) {
  await call("POST", "/instance/create", {
    instanceName: inst,
    integration: "WHATSAPP-BAILEYS",
    qrcode: false,
    number: phone.replace(/\D/g, "").startsWith("55") ? phone.replace(/\D/g, "") : `55${phone.replace(/\D/g, "")}`,
  });
}
