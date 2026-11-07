import { createClient } from "@supabase/supabase-js";
import { notifyApprovedTerreiroClaim } from "../api/lib/diretorioClaimNotify.js";
import { configureWhatsAppDeliveryTracking } from "../api/lib/whatsappDeliveryTracking.js";

const CLAIM_IDS = process.argv.slice(2).map((value) => String(value || "").trim()).filter(Boolean);

async function main() {
  if (!CLAIM_IDS.length) throw new Error("Informe ao menos um protocolo de reivindicação.");
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase administrativo não configurado.");

  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  configureWhatsAppDeliveryTracking(sb);
  const results: Array<Record<string, unknown>> = [];

  for (const claimId of CLAIM_IDS) {
    const { data: claim, error } = await sb
      .from("terreiro_claim_requests")
      .select("id,status,requester_name,requester_phone,terreiro_id,claimed_tenant_id")
      .eq("id", claimId)
      .maybeSingle();
    if (error) throw error;
    if (!claim || claim.status !== "approved" || claim.claimed_tenant_id) {
      results.push({ claimId, sent: false, skipped: true, reason: !claim ? "missing" : claim.status !== "approved" ? "not_approved" : "already_linked" });
      continue;
    }

    const { data: terreiro, error: terreiroError } = await sb
      .from("terreiros_diretorio")
      .select("nome")
      .eq("id", claim.terreiro_id)
      .maybeSingle();
    if (terreiroError) throw terreiroError;

    const notify = await notifyApprovedTerreiroClaim(sb, {
      claimId,
      requesterName: String(claim.requester_name || ""),
      requesterPhone: String(claim.requester_phone || ""),
      terreiroNome: String(terreiro?.nome || "Terreiro"),
      linkedTenantId: null,
      requestedBy: null,
      notificationKind: "approval",
    });
    results.push({
      claimId,
      requester: claim.requester_name,
      terreiro: terreiro?.nome || null,
      sent: notify.sent,
      template: notify.template,
      phoneMasked: notify.phoneMasked,
      deliveryId: notify.deliveryId || null,
      reason: notify.reason || null,
      error: notify.error || null,
    });
  }

  console.log(JSON.stringify(results, null, 2));
  if (results.some((item) => item.sent !== true)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
