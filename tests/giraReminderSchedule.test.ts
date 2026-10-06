import assert from "node:assert/strict";
import test from "node:test";
import { shouldSendGiraReminderToday } from "../api/lib/giraReminderSchedule.ts";

test("lembrete recorrente respeita o intervalo e sempre inclui o dia da gira", () => {
  const base = { todayYmd: "2026-10-06", eventYmd: "2026-10-10" };
  assert.equal(shouldSendGiraReminderToday({ ...base, daysUntil: 4, config: { intervalDays: 2 } }), true);
  assert.equal(shouldSendGiraReminderToday({ ...base, daysUntil: 3, config: { intervalDays: 2 } }), false);
  assert.equal(shouldSendGiraReminderToday({ todayYmd: "2026-10-10", eventYmd: "2026-10-10", daysUntil: 0, config: { intervalDays: 7 } }), true);
});

test("lembrete antes envia uma unica vez", () => {
  assert.equal(shouldSendGiraReminderToday({ todayYmd: "2026-10-06", eventYmd: "2026-10-08", daysUntil: 2, config: { mode: "antes", intervalDays: 2 } }), true);
  assert.equal(shouldSendGiraReminderToday({ todayYmd: "2026-10-07", eventYmd: "2026-10-08", daysUntil: 1, config: { mode: "antes", intervalDays: 2 } }), false);
});
