import assert from "node:assert/strict";
import test from "node:test";
import { subscriptionBillingReminderOffset } from "../api/lib/subscriptionBillingWhatsApp.ts";

test("cobranca de assinatura roda somente em D-1 e D-0 no fuso de Sao Paulo", () => {
  const noon = new Date("2026-10-06T15:00:00.000Z");
  assert.equal(subscriptionBillingReminderOffset("2026-10-07T23:59:59.000Z", noon), 1);
  assert.equal(subscriptionBillingReminderOffset("2026-10-06T23:59:59.000Z", noon), 0);
  assert.equal(subscriptionBillingReminderOffset("2026-10-08T23:59:59.000Z", noon), null);
  assert.equal(subscriptionBillingReminderOffset("2026-10-05T23:59:59.000Z", noon), null);
});
