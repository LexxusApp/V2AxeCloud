/**
 * Verifica status da reivindicação e se o WhatsApp de aprovação saiu.
 *   node scripts/check-claim-notify.mjs [claimId]
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

const { data: claim, error } = await sb
  .from("terreiro_claim_requests")
  .select("id, status, requester_name, requester_phone, requester_email, claimed_tenant_id, reviewed_at, updated_at")
  .eq("id", claimId)
  .maybeSingle();
if (error) throw error;

const phoneDigits = String(claim?.requester_phone || "").replace(/\D/g, "");
const phoneVariants = [];
if (phoneDigits) {
  phoneVariants.push(phoneDigits);
  if (!phoneDigits.startsWith("55")) phoneVariants.push(`55${phoneDigits}`);
  if (phoneDigits.startsWith("55")) phoneVariants.push(phoneDigits.slice(2));
}

const { data: audits } = await sb
  .from("audit_logs")
  .select("event_type, description, metadata, created_at")
  .eq("target_id", claimId)
  .order("created_at", { ascending: false })
  .limit(5);

let logs = [];
if (phoneVariants.length) {
  const { data } = await sb
    .from("whatsapp_logs")
    .select("id, tipo, telefone, status, mensagem, external_id, created_at, tenant_id")
    .in("telefone", phoneVariants)
    .order("created_at", { ascending: false })
    .limit(10);
  logs = data || [];
}

const { data: tipoLogs } = await sb
  .from("whatsapp_logs")
  .select("id, tipo, telefone, status, mensagem, external_id, created_at")
  .in("tipo", ["reivindicacao_aprovada", "reivindicacao_conectada"])
  .order("created_at", { ascending: false })
  .limit(10);

console.log(
  JSON.stringify(
    {
      claim: claim
        ? {
            id: claim.id,
            status: claim.status,
            linked: Boolean(claim.claimed_tenant_id),
            requester: claim.requester_name,
            phone: claim.requester_phone,
            email: claim.requester_email,
            reviewedAt: claim.reviewed_at,
          }
        : null,
      audits: (audits || []).map((a) => ({
        event: a.event_type,
        description: a.description,
        notify: a.metadata?.notify || null,
        at: a.created_at,
      })),
      whatsappByPhone: logs,
      whatsappByTipo: tipoLogs || [],
    },
    null,
    2,
  ),
);
