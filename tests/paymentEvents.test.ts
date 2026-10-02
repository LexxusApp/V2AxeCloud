import assert from "node:assert/strict";
import test from "node:test";
import { normalizePaymentStatus, paymentEventKey } from "../api/lib/paymentEvents.js";
import { summarizePaymentEvents, type PaymentEventRow } from "../api/lib/adminPaymentRoutes.js";

test("normaliza estados do PIX e da cobrança para a central financeira", () => {
  assert.equal(normalizePaymentStatus("CONCLUIDA"), "paid");
  assert.equal(normalizePaymentStatus("ATIVA"), "pending");
  assert.equal(normalizePaymentStatus("REMOVIDA_PELO_PSP"), "cancelled");
  assert.equal(normalizePaymentStatus("refused"), "failed");
  assert.equal(normalizePaymentStatus("expired"), "expired");
  assert.equal(normalizePaymentStatus("qualquer_novo_estado"), "processed");
});

test("monta chaves idempotentes sem separadores vazios", () => {
  assert.equal(paymentEventKey(["pix", "abc", null, "created"]), "pix:abc:created");
});

test("não conta webhook e checkout como dois pagamentos da mesma cobrança", () => {
  const base: PaymentEventRow = {
    id: "1", tenant_id: "tenant", provider: "efi_card", external_id: "123:created",
    event_type: "card_created", status: "pending", payment_method: "card",
    amount_cents: 6990, billing_cycle: "monthly", charge_id: "123", error_code: null,
    message: null, payload: {}, occurred_at: "2026-10-02T12:00:00.000Z", processed_at: null,
  };
  const summary = summarizePaymentEvents([
    base,
    { ...base, id: "2", provider: "efi", external_id: "123:notification",
      event_type: "payment_confirmed", status: "paid", amount_cents: null,
      occurred_at: "2026-10-02T12:01:00.000Z" },
  ]);
  assert.equal(summary.generated, 1);
  assert.equal(summary.paid, 1);
  assert.equal(summary.revenueCents, 6990);
});
