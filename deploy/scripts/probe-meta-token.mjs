/** Probe Meta token — lista WABAs/phones acessíveis sem imprimir segredos. */
const token = String(process.env.WA_META_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || "").trim();
const phoneId = String(process.env.WA_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID || "").trim();
const wabaId = String(process.env.WA_BUSINESS_ACCOUNT_ID || "").trim();
const version = String(process.env.WA_BUSINESS_VERSION || "v21.0").trim();

if (!token) {
  console.log("TOKEN=MISSING");
  process.exit(1);
}

async function get(path) {
  const res = await fetch(`https://graph.facebook.com/${version}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const debug = await get(`/debug_token?input_token=${encodeURIComponent(token)}`);
const d = debug.body?.data || {};
console.log(`DEBUG_VALID=${d.is_valid ? "yes" : "no"}`);
console.log(`DEBUG_TYPE=${d.type || "?"}`);
console.log(`CONFIG_PHONE=${phoneId ? "SET" : "MISSING"}`);
console.log(`CONFIG_WABA=${wabaId ? "SET" : "MISSING"}`);
if (Array.isArray(d.granular_scopes)) {
  for (const g of d.granular_scopes) {
    const scope = g.scope || "?";
    const ids = Array.isArray(g.target_ids) ? g.target_ids : [];
    console.log(`SCOPE=${scope} targets=${ids.length}`);
    for (const id of ids.slice(0, 8)) {
      console.log(`TARGET ${scope} id_prefix=${String(id).slice(0, 6)}… match_waba=${String(id) === wabaId ? "yes" : "no"} match_phone=${String(id) === phoneId ? "yes" : "no"}`);
    }
  }
}

const shared = await get(`/me/accounts?fields=id,name`);
console.log(`ACCOUNTS_HTTP=${shared.status}`);

const businesses = await get(`/me/businesses?fields=id,name`);
console.log(`BUSINESSES_HTTP=${businesses.status}`);
if (Array.isArray(businesses.body?.data)) {
  console.log(`BUSINESSES_COUNT=${businesses.body.data.length}`);
  for (const b of businesses.body.data.slice(0, 5)) {
    console.log(`BUSINESS name=${b.name ? "SET" : "MISSING"} id_prefix=${String(b.id).slice(0, 6)}…`);
    const wabas = await get(`/${b.id}/owned_whatsapp_business_accounts?fields=id,name,currency`);
    console.log(`WABAS_HTTP=${wabas.status}`);
    if (Array.isArray(wabas.body?.data)) {
      for (const w of wabas.body.data) {
        console.log(`WABA id_prefix=${String(w.id).slice(0, 6)}… match_config=${String(w.id) === wabaId ? "yes" : "no"}`);
        const phones = await get(`/${w.id}/phone_numbers?fields=id,display_phone_number,verified_name`);
        console.log(`WABA_PHONES_HTTP=${phones.status} count=${Array.isArray(phones.body?.data) ? phones.body.data.length : 0}`);
        for (const p of phones.body?.data || []) {
          console.log(
            `WABA_PHONE match=${String(p.id) === phoneId ? "yes" : "no"} id_prefix=${String(p.id).slice(0, 6)}… display=${p.display_phone_number || "?"}`
          );
        }
      }
    } else if (wabas.body?.error) {
      console.log(`WABAS_ERR=${String(wabas.body.error.message || "").slice(0, 120)}`);
    }
  }
} else if (businesses.body?.error) {
  console.log(`BUSINESSES_ERR=${String(businesses.body.error.message || "").slice(0, 140)}`);
}

// Algumas system users só tem acesso direto a WABA via client_whatsapp_business_accounts
const clientWabas = await get(`/me/client_whatsapp_business_accounts?fields=id,name`);
console.log(`CLIENT_WABAS_HTTP=${clientWabas.status}`);
if (Array.isArray(clientWabas.body?.data)) {
  console.log(`CLIENT_WABAS_COUNT=${clientWabas.body.data.length}`);
  for (const w of clientWabas.body.data.slice(0, 5)) {
    console.log(`CLIENT_WABA match=${String(w.id) === wabaId ? "yes" : "no"} id_prefix=${String(w.id).slice(0, 6)}…`);
    const phones = await get(`/${w.id}/phone_numbers?fields=id,display_phone_number,verified_name`);
    console.log(`CLIENT_PHONES_HTTP=${phones.status} count=${Array.isArray(phones.body?.data) ? phones.body.data.length : 0}`);
    for (const p of phones.body?.data || []) {
      console.log(
        `CLIENT_PHONE match=${String(p.id) === phoneId ? "yes" : "no"} id_prefix=${String(p.id).slice(0, 6)}… display=${p.display_phone_number || "?"}`
      );
    }
  }
} else if (clientWabas.body?.error) {
  console.log(`CLIENT_WABAS_ERR=${String(clientWabas.body.error.message || "").slice(0, 140)}`);
}
