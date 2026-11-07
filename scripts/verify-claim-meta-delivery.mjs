/**
 * Verifica na base/Meta o que aconteceu com o envio da reivindicação aprovada.
 *   node scripts/verify-claim-meta-delivery.mjs [claimId] [wamid]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(resolve(root, ".env"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 1) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

const claimId = String(process.argv[2] || "1f1ad65a-43c5-4052-819b-d31a3d5d3ff1").trim();
const wamid = String(process.argv[3] || "wamid.HBgMNTU2MTk5MDczNDI5FQIAERgSOTA4RjZBQkJBNEIyMjFCNEVBAA==").trim();
const phone = "5561999073429";

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const token = process.env.WA_META_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || "";
const phoneId = process.env.WA_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID || "";
const version = process.env.WA_BUSINESS_VERSION || process.env.META_WHATSAPP_API_VERSION || "v21.0";

const { data: claim } = await sb
  .from("terreiro_claim_requests")
  .select("id, status, requester_phone, reviewed_at, claimed_tenant_id")
  .eq("id", claimId)
  .maybeSingle();

const { data: access } = await sb
  .from("access_logs")
  .select("event_type, description, metadata, created_at, target_id")
  .or(`target_id.eq.${claimId},event_type.ilike.%claim%`)
  .order("created_at", { ascending: false })
  .limit(20);

const { data: waByExt } = await sb
  .from("whatsapp_logs")
  .select("id, tipo, telefone, status, mensagem, external_id, created_at")
  .eq("external_id", wamid)
  .maybeSingle();

const { data: waByPhone } = await sb
  .from("whatsapp_logs")
  .select("id, tipo, telefone, status, mensagem, external_id, created_at")
  .or(`telefone.eq.${phone},telefone.eq.55${phone},telefone.like.%99073429%`)
  .order("created_at", { ascending: false })
  .limit(15);

const { data: inbox } = await sb
  .from("admin_whatsapp_messages")
  .select("id, direction, status, external_id, body, created_at, phone")
  .or(`external_id.eq.${wamid},phone.ilike.%99073429%`)
  .order("created_at", { ascending: false })
  .limit(15)
  .then((r) => r)
  .catch(() => ({ data: null, error: { message: "table missing" } }));

// Meta Graph: não há GET de status por wamid; checamos phone number + template list + debug.
let metaPhone = null;
let metaTemplate = null;
let metaDebug = null;
if (token && phoneId) {
  const phoneRes = await fetch(
    `https://graph.facebook.com/${version}/${phoneId}?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  metaPhone = { ok: phoneRes.ok, status: phoneRes.status, body: await phoneRes.json().catch(() => ({})) };

  const waba = process.env.WA_BUSINESS_ACCOUNT_ID || process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || process.env.WA_WABA_ID || "";
  if (waba) {
    const tplRes = await fetch(
      `https://graph.facebook.com/${version}/${waba}/message_templates?name=reivindicacao_aprovada_axecloud&fields=id,name,status,rejected_reason,category,language`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const tplJson = await tplRes.json().catch(() => ({}));
    metaTemplate = { ok: tplRes.ok, row: tplJson?.data?.[0] || null, error: tplJson?.error || null };
  }

  // Algumas contas aceitam debug do wamid via graph (pode falhar — reportamos).
  const debugRes = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(wamid)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  metaDebug = { ok: debugRes.ok, status: debugRes.status, body: await debugRes.json().catch(() => ({})) };
}

console.log(
  JSON.stringify(
    {
      claim,
      accessClaimEvents: (access || []).filter(
        (r) => String(r.target_id || "") === claimId || /claim/i.test(String(r.event_type || "")),
      ),
      whatsappLogByWamid: waByExt,
      whatsappLogsByPhone: waByPhone,
      inbox,
      metaPhone: metaPhone
        ? {
            ok: metaPhone.ok,
            display: metaPhone.body?.display_phone_number,
            verifiedName: metaPhone.body?.verified_name,
            quality: metaPhone.body?.quality_rating,
            tier: metaPhone.body?.messaging_limit_tier,
            error: metaPhone.body?.error?.message || null,
          }
        : null,
      metaTemplate,
      metaWamidLookup: metaDebug,
      knownResendWamid: wamid,
    },
    null,
    2,
  ),
);
