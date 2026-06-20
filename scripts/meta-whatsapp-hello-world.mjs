/**
 * Teste isolado — WhatsApp Cloud API (Meta) — template hello_world
 *
 * Uso:
 *   set META_WHATSAPP_ACCESS_TOKEN=SEU_TOKEN_TEMPORARIO
 *   node scripts/meta-whatsapp-hello-world.mjs
 *
 * Ou passando o token como 1º argumento:
 *   node scripts/meta-whatsapp-hello-world.mjs SEU_TOKEN_TEMPORARIO
 *
 * Destinatário opcional como 2º argumento (padrão: 5511920033501):
 *   node scripts/meta-whatsapp-hello-world.mjs SEU_TOKEN 5511999999999
 */

const PHONE_NUMBER_ID = "1145309432000023";
const API_VERSION = "v25.0";
const DEFAULT_TO = "5511920033501";

const accessToken = process.argv[2] || process.env.META_WHATSAPP_ACCESS_TOKEN;
const to = (process.argv[3] || process.env.META_WHATSAPP_TO || DEFAULT_TO).replace(/\D/g, "");

if (!accessToken) {
  console.error(
    "Defina META_WHATSAPP_ACCESS_TOKEN ou passe o token como 1º argumento.\n" +
      "Ex.: node scripts/meta-whatsapp-hello-world.mjs EAAxxxx..."
  );
  process.exit(1);
}

const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

/** Payload idêntico ao exemplo "hello_world" do painel Meta / Getting Started. */
const body = {
  messaging_product: "whatsapp",
  to,
  type: "template",
  template: {
    name: "hello_world",
    language: {
      code: "en_US",
    },
  },
};

console.log("POST", url);
console.log("Para:", to);
console.log("Body:", JSON.stringify(body, null, 2));

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await res.text();
let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  parsed = text;
}

console.log("Status:", res.status, res.statusText);
console.log("Resposta:", typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));

if (!res.ok) {
  process.exit(1);
}
