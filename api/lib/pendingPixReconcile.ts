import type { SupabaseClient } from "@supabase/supabase-js";
import {
  efiPixGetCob,
  resolveEfiPixEnv,
  type EfiPixEnv,
} from "./efiPixApi.js";
import { activateTenantSubscription } from "./tenantOnboarding.js";
import { normalizeBillingCycle } from "./plansCatalog.js";
import {
  normalizePaymentStatus,
  paymentEventKey,
  recordPaymentEvent,
} from "./paymentEvents.js";

type PendingPixRow = {
  id: string;
  efi_pix_txid: string;
  billing_cycle?: string | null;
  pending_billing_cycle?: string | null;
  last_activated_charge_id?: string | null;
};

type ReconcileDeps = {
  resolveEnv: () => EfiPixEnv | null;
  getCharge: typeof efiPixGetCob;
  activate: typeof activateTenantSubscription;
  record: typeof recordPaymentEvent;
};

const defaultDeps: ReconcileDeps = {
  resolveEnv: resolveEfiPixEnv,
  getCharge: efiPixGetCob,
  activate: activateTenantSubscription,
  record: recordPaymentEvent,
};

/**
 * Segunda linha de confirmação do Pix.
 *
 * O webhook continua sendo o caminho instantâneo. Este reconciliador consulta
 * apenas cobranças ainda pendentes, de modo que um pagamento também libera a
 * conta quando o navegador foi fechado ou a entrega do webhook sofreu atraso.
 */
export async function reconcilePendingEfiPixPayments(
  sb: SupabaseClient,
  options?: { maxBatch?: number; deps?: Partial<ReconcileDeps> }
) {
  const deps = { ...defaultDeps, ...(options?.deps || {}) };
  const env = deps.resolveEnv();
  if (!env) {
    return { configured: false, scanned: 0, activated: 0, pending: 0, failed: 0 };
  }

  const maxBatch = Math.min(50, Math.max(1, options?.maxBatch || 20));
  const { data, error } = await sb
    .from("subscriptions")
    .select("id, efi_pix_txid, billing_cycle, pending_billing_cycle, last_activated_charge_id")
    .not("efi_pix_txid", "is", null)
    .not("pending_billing_cycle", "is", null)
    .limit(maxBatch);
  if (error) throw error;

  const rows = (data || []) as PendingPixRow[];
  let activated = 0;
  let pending = 0;
  let failed = 0;

  for (const row of rows) {
    const txid = String(row.efi_pix_txid || "").trim();
    if (!txid || String(row.last_activated_charge_id || "") === `pix:${txid}`) continue;
    const billingCycle = normalizeBillingCycle(row.pending_billing_cycle || row.billing_cycle);
    try {
      const charge = await deps.getCharge(env, txid);
      if (charge.paid) {
        await deps.activate(sb, row.id, {
          chargeId: `pix:${txid}`,
          provider: "efi_pix",
          billingCycle,
        });
        await deps.record(sb, {
          provider: "efi_pix",
          externalId: paymentEventKey([txid, "status", "paid"]),
          tenantId: row.id,
          eventType: "payment_confirmed",
          status: "paid",
          paymentMethod: "pix",
          billingCycle,
          chargeId: txid,
          message: "Pagamento PIX confirmado pela reconciliação automática.",
          metadata: { providerStatus: charge.status, source: "scheduled_reconcile" },
        });
        activated += 1;
      } else {
        const normalizedStatus = normalizePaymentStatus(charge.status);
        await deps.record(sb, {
          provider: "efi_pix",
          externalId: paymentEventKey([txid, "status", normalizedStatus]),
          tenantId: row.id,
          eventType: "pix_status_checked",
          status: normalizedStatus,
          paymentMethod: "pix",
          billingCycle,
          chargeId: txid,
          message: "Status do PIX consultado pela reconciliação automática.",
          metadata: { providerStatus: charge.status, source: "scheduled_reconcile" },
        });
        if (normalizedStatus === "expired" || normalizedStatus === "cancelled") {
          const { error: clearError } = await sb
            .from("subscriptions")
            .update({ pending_billing_cycle: null, updated_at: new Date().toISOString() })
            .eq("id", row.id)
            .eq("efi_pix_txid", txid);
          if (clearError) throw clearError;
        }
        pending += 1;
      }
    } catch (error) {
      failed += 1;
      console.warn(`[EFI PIX RECONCILE] txid=${txid}:`, error);
    }
  }

  return {
    configured: true,
    scanned: rows.length,
    activated,
    pending,
    failed,
  };
}
