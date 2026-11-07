/**
 * Verifica cadastro + vínculo da claim + boas-vindas WhatsApp.
 *   node scripts/check-claim-register-welcome.mjs [claimId]
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
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: claim, error: claimError } = await sb
  .from("terreiro_claim_requests")
  .select("id, status, requester_name, requester_email, requester_phone, claimed_tenant_id, reviewed_at, updated_at, terreiro_id")
  .eq("id", claimId)
  .maybeSingle();
if (claimError) throw claimError;

let profile = null;
let terreiro = null;
let sub = null;
if (claim?.claimed_tenant_id) {
  const [{ data: p }, { data: s }] = await Promise.all([
    sb
      .from("perfil_lider")
      .select("id, nome_terreiro, cargo, email, created_at, casa_verificada, whatsapp_publico")
      .eq("id", claim.claimed_tenant_id)
      .maybeSingle(),
    sb.from("subscriptions").select("id, status, plan, expires_at, created_at").eq("id", claim.claimed_tenant_id).maybeSingle(),
  ]);
  profile = p;
  sub = s;
}

if (claim?.terreiro_id) {
  const { data: t } = await sb
    .from("terreiros_diretorio")
    .select("id, nome, slug, claimed_by_tenant_id, verified_at")
    .eq("id", claim.terreiro_id)
    .maybeSingle();
  terreiro = t;
}

const tenantId = claim?.claimed_tenant_id || terreiro?.claimed_by_tenant_id || null;
const phone = String(claim?.requester_phone || "").replace(/\D/g, "");
const phoneVariants = [...new Set([phone, phone.startsWith("55") ? phone : `55${phone}`, phone.startsWith("55") ? phone.slice(2) : phone].filter(Boolean))];

const { data: waWelcome } = await sb
  .from("whatsapp_logs")
  .select("id, tipo, telefone, status, mensagem, external_id, created_at, tenant_id")
  .in("tipo", ["boas_vindas_zelador", "admin_boas_vindas", "welcome"])
  .order("created_at", { ascending: false })
  .limit(30);

const welcomeForTenant = (waWelcome || []).filter((r) => tenantId && String(r.tenant_id) === String(tenantId));
const welcomeForPhone = (waWelcome || []).filter((r) => phoneVariants.some((p) => String(r.telefone || "").includes(p.slice(-8))));

const { data: waRecentPhone } = await sb
  .from("whatsapp_logs")
  .select("id, tipo, telefone, status, mensagem, external_id, created_at, tenant_id")
  .or(phoneVariants.map((p) => `telefone.eq.${p}`).join(","))
  .order("created_at", { ascending: false })
  .limit(20);

const { data: access } = await sb
  .from("access_logs")
  .select("event_type, description, metadata, created_at, target_id, terreiro_id")
  .or(
    [
      `target_id.eq.${claimId}`,
      tenantId ? `terreiro_id.eq.${tenantId}` : null,
      tenantId ? `target_id.eq.${tenantId}` : null,
      "event_type.ilike.%register%",
      "event_type.ilike.%welcome%",
      "event_type.ilike.%boas%",
    ]
      .filter(Boolean)
      .join(","),
  )
  .order("created_at", { ascending: false })
  .limit(40);

const relevantAccess = (access || []).filter((r) => {
  const et = String(r.event_type || "");
  const tid = String(r.target_id || "");
  const ter = String(r.terreiro_id || "");
  return (
    tid === claimId ||
    (tenantId && (tid === tenantId || ter === tenantId)) ||
    /register|welcome|boas|claim/i.test(et)
  );
});

console.log(
  JSON.stringify(
    {
      claim: claim
        ? {
            id: claim.id,
            status: claim.status,
            linkedTenantId: claim.claimed_tenant_id,
            email: claim.requester_email,
            phone: claim.requester_phone,
            reviewedAt: claim.reviewed_at,
            updatedAt: claim.updated_at,
          }
        : null,
      terreiro: terreiro
        ? {
            nome: terreiro.nome,
            slug: terreiro.slug,
            claimedBy: terreiro.claimed_by_tenant_id,
            verifiedAt: terreiro.verified_at,
            linkedOk: Boolean(tenantId && terreiro.claimed_by_tenant_id === tenantId),
          }
        : null,
      profile,
      subscription: sub,
      welcomeByTenant: welcomeForTenant,
      welcomeByPhone: welcomeForPhone,
      recentWhatsappToPhone: waRecentPhone || [],
      accessEvents: relevantAccess.slice(0, 15),
    },
    null,
    2,
  ),
);
