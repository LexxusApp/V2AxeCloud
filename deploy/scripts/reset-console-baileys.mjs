/**
 * Remove instância axecloud_console_admin e recria como WHATSAPP-BAILEYS.
 * Uso na VPS: docker compose exec -T app node - < deploy/scripts/reset-console-baileys.mjs
 */
const inst = "axecloud_console_admin";
const key = process.env.EVOLUTION_API_KEY;
const base = String(process.env.EVOLUTION_API_BASE_URL || "http://evolution:8080").replace(/\/$/, "");

if (!key) {
  console.error("EVOLUTION_API_KEY ausente");
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
  return res.status;
}

await call("DELETE", `/instance/logout/${encodeURIComponent(inst)}`);
await call("DELETE", `/instance/delete/${encodeURIComponent(inst)}`);
await call("POST", "/instance/create", {
  instanceName: inst,
  integration: "WHATSAPP-BAILEYS",
  qrcode: false,
});

const st = await fetch(`${base}/instance/connectionState/${encodeURIComponent(inst)}`, {
  headers: { apikey: key },
});
console.log("connectionState", st.status, (await st.text()).slice(0, 500));
