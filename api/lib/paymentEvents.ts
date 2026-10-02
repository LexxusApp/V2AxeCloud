import type { SupabaseClient } from "@supabase/supabase-js";
import { safeErrorMessage } from "./safeError.js";

export type PaymentEventStatus =
  | "processing" | "pending" | "paid" | "failed" | "expired" | "cancelled" | "processed";
export type PaymentMethod = "pix" | "card" | "unknown";

export type RecordPaymentEventInput = {
  provider: string;
  externalId: string;
  tenantId?: string | null;
  eventType: string;
  status: PaymentEventStatus;
  paymentMethod?: PaymentMethod;
  amountCents?: number | null;
  billingCycle?: string | null;
  chargeId?: string | number | null;
  errorCode?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
};

const PAYMENT_STATUS_MAP: Record<string, PaymentEventStatus> = {
  concluida: "paid", paid: "paid", settled: "paid", approved: "paid", active: "paid",
  ativa: "pending", new: "pending", waiting: "pending", pending: "pending", unpaid: "pending",
  processing: "processing", expired: "expired",
  removida_pelo_usuario_recebedor: "cancelled", removida_pelo_psp: "cancelled",
  canceled: "cancelled", cancelled: "cancelled", refunded: "cancelled",
  chargeback: "failed", refused: "failed", failed: "failed", error: "failed",
};

export function normalizePaymentStatus(value: unknown): PaymentEventStatus {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return PAYMENT_STATUS_MAP[normalized] || "processed";
}

function cleanText(value: unknown, max = 500): string | null {
  const valueText = String(value || "").trim();
  return valueText ? valueText.slice(0, max) : null;
}

/** Registra auditoria financeira sem nunca interromper o checkout. */
export async function recordPaymentEvent(
  supabaseAdmin: SupabaseClient,
  input: RecordPaymentEventInput
): Promise<{ recorded: boolean; error?: string }> {
  const provider = cleanText(input.provider, 60);
  const externalId = cleanText(input.externalId, 240);
  if (!provider || !externalId) return { recorded: false, error: "payment_event_key_missing" };

  const amount = input.amountCents == null ? null : Number(input.amountCents);
  const row = {
    provider,
    external_id: externalId,
    tenant_id: cleanText(input.tenantId, 80),
    event_type: cleanText(input.eventType, 100) || "payment_event",
    status: input.status,
    payment_method: input.paymentMethod || "unknown",
    amount_cents: amount != null && Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : null,
    billing_cycle: cleanText(input.billingCycle, 30),
    charge_id: input.chargeId == null ? null : cleanText(input.chargeId, 160),
    error_code: cleanText(input.errorCode, 120),
    message: cleanText(input.message, 500),
    payload: input.metadata || {},
    occurred_at: input.occurredAt || new Date().toISOString(),
    processed_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabaseAdmin.from("payment_webhook_events")
      .upsert(row, { onConflict: "provider,external_id" });
    if (error) throw error;
    return { recorded: true };
  } catch (error) {
    const message = safeErrorMessage(error, "Falha ao registrar evento financeiro.");
    console.warn("[payment-events]", message);
    return { recorded: false, error: message };
  }
}

export function paymentEventKey(parts: Array<string | number | null | undefined>): string {
  return parts.map((part) => String(part ?? "").trim()).filter(Boolean).join(":").slice(0, 240);
}
