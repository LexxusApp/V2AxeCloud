import assert from "node:assert/strict";
import test from "node:test";
import { buildPixPayload, calculateCrc16 } from "../api/lib/pixPayload.js";
import { shouldRunAutomaticMensalidadeNotification } from "../api/lib/cronWhatsAppJobs.js";
import { isSubscriptionAccessActive, isSubscriptionExpired } from "../api/lib/subscriptionAccess.js";

test("PixPayload: calcula CRC-16 e payload EMV padrão BACEN", () => {
  const crc = calculateCrc16("00020126360014br.gov.bcb.pix0114+551199999999520400005303986540589.905802BR5908TERREIRO6009SAO PAULO62150511AXECLOUD6304");
  assert.equal(typeof crc, "string");
  assert.equal(crc.length, 4);

  const payload = buildPixPayload(
    {
      chave_pix: "11999999999",
      nome_beneficiario: "Terreiro do Caboclo",
      cidade: "Sao Paulo",
    },
    89.9,
    "MENS1234",
    "MENSALIDADE"
  );

  assert.ok(payload.startsWith("000201"));
  assert.ok(payload.includes("br.gov.bcb.pix"));
  assert.ok(payload.includes("11999999999"));
  assert.ok(payload.includes("89.90"));
  assert.equal(payload.length > 50, true);
});

test("Mensalidades: aviso automático só ocorre no dia 1 em São Paulo", () => {
  assert.equal(shouldRunAutomaticMensalidadeNotification(new Date("2026-10-01T15:00:00.000Z")), true);
  assert.equal(shouldRunAutomaticMensalidadeNotification(new Date("2026-10-02T15:00:00.000Z")), false);
  assert.equal(shouldRunAutomaticMensalidadeNotification(new Date("2026-11-01T02:00:00.000Z")), false);
  assert.equal(shouldRunAutomaticMensalidadeNotification(new Date("2026-11-01T15:00:00.000Z")), true);
});

test("Subscription access: considera assinatura ativa e expirada conforme a validade", () => {
  const active = { status: "active", expires_at: "2099-10-10T12:00:00.000Z" };
  assert.equal(isSubscriptionAccessActive(active), true);
  assert.equal(isSubscriptionExpired(active, new Date("2026-10-10T12:00:00.000Z")), false);

  const expired = { status: "active", expires_at: "2026-10-10T12:00:00.000Z" };
  assert.equal(isSubscriptionExpired(expired, new Date("2026-10-10T13:00:00.000Z")), true);
});
