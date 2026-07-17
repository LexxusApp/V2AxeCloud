const key = process.env.EVOLUTION_API_KEY;
const base = String(process.env.EVOLUTION_API_BASE_URL || "http://evolution:8080").replace(/\/$/, "");
const res = await fetch(`${base}/instance/fetchInstances`, { headers: { apikey: key } });
const data = await res.json().catch(() => []);
const list = Array.isArray(data) ? data : data?.response || [];
for (const item of list) {
  const name = item.name || item.instance?.instanceName || "?";
  const integration = item.integration || item.instance?.integration || "?";
  const status =
    item.connectionStatus || item.instance?.connectionStatus || item.state || item.status || "?";
  console.log(`${name} | ${integration} | ${status}`);
}
console.log(`COUNT=${list.length}`);
