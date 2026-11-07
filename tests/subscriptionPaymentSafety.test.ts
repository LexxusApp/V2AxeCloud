import test from "node:test";
import assert from "node:assert/strict";
import { isReusableEfiPixCharge } from "../api/lib/efiCheckoutRoutes.js";
import { reconcilePendingEfiPixPayments } from "../api/lib/pendingPixReconcile.js";
import {
  isPixActivationAlreadyApplied,
  isTrustedEfiPixWebhook,
} from "../cloudflare/pixWebhookEdge.js";

test("reuses only a still-valid open Pix charge", () => {
  const now = Date.parse("2026-11-04T15:00:00Z");
  assert.equal(isReusableEfiPixCharge({
    status: "ATIVA",
    paid: false,
    copyPaste: "000201...",
    createdAt: "2026-11-04T14:00:00Z",
    expirationSeconds: 86400,
    raw: {},
  }, now), true);
  assert.equal(isReusableEfiPixCharge({
    status: "ATIVA",
    paid: false,
    copyPaste: "000201...",
    createdAt: "2026-11-03T14:00:00Z",
    expirationSeconds: 3600,
    raw: {},
  }, now), false);
  assert.equal(isReusableEfiPixCharge({
    status: "CONCLUIDA",
    paid: true,
    copyPaste: "000201...",
    raw: {},
  }, now), false);
});

test("edge webhook recognizes the same Pix activation and cannot extend twice", () => {
  assert.equal(isPixActivationAlreadyApplied("pix:abc123", "abc123"), true);
  assert.equal(isPixActivationAlreadyApplied("pix:other", "abc123"), false);
  assert.equal(isPixActivationAlreadyApplied(null, "abc123"), false);
});

test("Pix webhook accepts only the official Efí source or the configured HMAC", () => {
  assert.equal(isTrustedEfiPixWebhook({
    sourceIp: "34.193.116.226",
    expectedSecret: "secret",
    suppliedSecret: null,
  }), true);
  assert.equal(isTrustedEfiPixWebhook({
    sourceIp: "203.0.113.7",
    expectedSecret: "secret",
    suppliedSecret: "secret",
  }), true);
  assert.equal(isTrustedEfiPixWebhook({
    sourceIp: "203.0.113.7",
    expectedSecret: "secret",
    suppliedSecret: "wrong",
  }), false);
});

test("scheduled Pix reconciliation activates a paid charge while the browser is closed", async () => {
  const rows = [{
    id: "tenant-1",
    efi_pix_txid: "tx-paid",
    billing_cycle: "monthly",
    pending_billing_cycle: "annual",
    last_activated_charge_id: null,
  }];
  const query: any = {
    select() { return this; },
    not() { return this; },
    limit() { return Promise.resolve({ data: rows, error: null }); },
  };
  const sb: any = { from: () => query };
  const activations: any[] = [];
  const events: any[] = [];

  const result = await reconcilePendingEfiPixPayments(sb, {
    deps: {
      resolveEnv: () => ({ sandbox: false } as any),
      getCharge: async () => ({ status: "CONCLUIDA", paid: true, raw: {} }),
      activate: async (_sb: any, tenantId: string, options: any) => {
        activations.push({ tenantId, options });
        return { alreadyActive: false };
      },
      record: async (_sb: any, event: any) => {
        events.push(event);
        return { recorded: true };
      },
    },
  });

  assert.deepEqual(result, {
    configured: true,
    scanned: 1,
    activated: 1,
    pending: 0,
    failed: 0,
  });
  assert.deepEqual(activations, [{
    tenantId: "tenant-1",
    options: { chargeId: "pix:tx-paid", provider: "efi_pix", billingCycle: "annual" },
  }]);
  assert.equal(events[0].status, "paid");
});
