const token = Boolean(process.env.WA_META_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN);
const phone = Boolean(process.env.WA_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID);
const keys = [
  "WA_META_TEMPLATE_DADOS_ACESSO",
  "WA_META_TEMPLATE_BROADCAST",
  "WA_META_TEMPLATE_AVISO_GIRA",
  "WA_META_TEMPLATE_CONVITE_EVENTO",
  "WA_META_TEMPLATE_PEDIDO_REZA_NOVO_ZELADOR",
  "WA_META_TEMPLATE_PEDIDO_REZA_ACEITO_FIEL",
  "WA_META_TEMPLATE_FINANCEIRO",
  "WA_META_TEMPLATE_ESTOQUE_CRITICO",
];
console.log(`META_CLOUD=${token && phone ? "READY" : "NOT_READY"}`);
for (const key of keys) {
  console.log(`${key}=${process.env[key] ? "SET" : "MISSING"}`);
}

if (token && phone) {
  const version = String(process.env.WA_BUSINESS_VERSION || "v21.0").trim();
  const phoneId = String(process.env.WA_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const access = String(process.env.WA_META_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || "").trim();
  const url = `https://graph.facebook.com/${version}/${phoneId}?fields=display_phone_number,verified_name`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
  const body = await res.json().catch(() => ({}));
  const err = body && typeof body === "object" ? body.error : null;
  const code = err && typeof err === "object" ? err.code : undefined;
  const subcode = err && typeof err === "object" ? err.error_subcode : undefined;
  const msg = err && typeof err === "object" ? String(err.message || "").slice(0, 160) : "";
  console.log(`GRAPH_HTTP=${res.status}`);
  console.log(`GRAPH_API=${res.ok ? "OK" : "FAIL"}`);
  if (!res.ok) {
    console.log(`GRAPH_CODE=${code ?? "?"}`);
    console.log(`GRAPH_SUBCODE=${subcode ?? "?"}`);
    console.log(`GRAPH_MSG=${msg || "n/a"}`);
  }
}
