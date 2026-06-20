import "dotenv/config";

const key = process.env.EVOLUTION_API_KEY;
const base = (process.env.EVOLUTION_API_BASE_URL || "http://evolution:8080").replace(/\/$/, "");
const instance = process.env.EVOLUTION_INSTANCE_NAME || "axecloud_console_admin";
const to = (process.env.AUTOPOST_WHATSAPP_TO || "5511920033501").replace(/\D/g, "");

async function api(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { apikey: key, "Content-Type": "application/json" },
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

console.log("=== connectionState ===");
console.log(JSON.stringify(await api("GET", `/instance/connectionState/${instance}`), null, 2));

console.log("\n=== fetchInstances (slice) ===");
const inst = await api("GET", "/instance/fetchInstances");
const list = Array.isArray(inst.data) ? inst.data : inst.data?.response || [];
console.log(JSON.stringify(list.map((i) => ({
  name: i.name || i.instance?.instanceName,
  integration: i.integration || i.instance?.integration,
  status: i.connectionStatus || i.instance?.status,
})), null, 2));

console.log("\n=== public image URL ===");
const imgUrl = "https://axecloud.com.br/ready-posts/2026-06-14.jpg";
const imgRes = await fetch(imgUrl, { method: "HEAD" });
console.log(imgUrl, imgRes.status, imgRes.headers.get("content-type"));

for (const tpl of ["aviso_geral_axecloud", "hello_world"]) {
  console.log(`\n=== sendTemplate ${tpl} ===`);
  const body =
    tpl === "hello_world"
      ? { number: to, name: tpl, language: "en_US", components: [] }
      : {
          number: to,
          name: tpl,
          language: "pt_BR",
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: "Lucas" },
                { type: "text", text: "Post diário AxéCloud — teste" },
              ],
            },
          ],
        };
  console.log(JSON.stringify(await api("POST", `/message/sendTemplate/${instance}`, body), null, 2));
}
