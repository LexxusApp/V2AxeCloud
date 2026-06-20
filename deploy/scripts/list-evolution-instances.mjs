const key = process.env.EVOLUTION_API_KEY;
const base = String(process.env.EVOLUTION_API_BASE_URL || "http://evolution:8080").replace(/\/$/, "");
const headers = { apikey: key };

const res = await fetch(`${base}/instance/fetchInstances`, { headers });
console.log("fetchInstances", res.status, (await res.text()).slice(0, 3000));

const st = await fetch(`${base}/instance/connectionState/axecloud_console_admin`, { headers });
console.log("connectionState", st.status, await st.text());
