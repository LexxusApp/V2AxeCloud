import assert from "node:assert/strict";
import test from "node:test";
import { shouldRunAutomaticMensalidadeNotification } from "../api/lib/cronWhatsAppJobs.js";

test("disparo automático de mensalidade só é permitido no dia 1 em São Paulo", () => {
  assert.equal(shouldRunAutomaticMensalidadeNotification(new Date("2026-10-01T15:00:00.000Z")), true);
  assert.equal(shouldRunAutomaticMensalidadeNotification(new Date("2026-10-02T15:00:00.000Z")), false);
});

test("o limite usa o dia civil de São Paulo, não o dia UTC", () => {
  assert.equal(shouldRunAutomaticMensalidadeNotification(new Date("2026-10-01T02:00:00.000Z")), false);
  assert.equal(shouldRunAutomaticMensalidadeNotification(new Date("2026-11-01T03:30:00.000Z")), true);
});
