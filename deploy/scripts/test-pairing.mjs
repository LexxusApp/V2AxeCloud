const inst = process.argv[2] || "a90db681-e55f-4668-8715-34e23ffbb591";
const number = process.argv[3] || "5511912276156";
const key = process.env.EVOLUTION_API_KEY;
const base = (process.env.EVOLUTION_API_BASE_URL || "http://evolution:8080").replace(/\/$/, "");
const headers = { apikey: key, "Content-Type": "application/json" };

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  console.log(method, path, res.status, text);
}

await call("DELETE", `/instance/logout/${encodeURIComponent(inst)}`);
await call("DELETE", `/instance/delete/${encodeURIComponent(inst)}`);
await new Promise((r) => setTimeout(r, 2000));
await call("POST", "/instance/create", {
  instanceName: inst,
  integration: "WHATSAPP-BAILEYS",
  qrcode: false,
  pairing: true,
  number,
});
for (let i = 0; i < 8; i += 1) {
  await new Promise((r) => setTimeout(r, 3000));
  const res = await fetch(
    `${base}/instance/connect/${encodeURIComponent(inst)}?number=${encodeURIComponent(number)}`,
    { headers: { apikey: key } },
  );
  const text = await res.text();
  console.log("GET connect attempt", i + 1, res.status, text);
  if (text.includes("pairingCode") || text.includes("base64") || (text.includes("code") && !text.includes('"count":0'))) {
    break;
  }
}
