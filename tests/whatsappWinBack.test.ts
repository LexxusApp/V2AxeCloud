import test from "node:test";
import assert from "node:assert/strict";
import { detectTerreiroWinBackAction } from "../api/lib/whatsappWinBackHandler.js";

test("WinBack: reconhece ação de + 15 Dias nos botões e texto", () => {
  assert.equal(detectTerreiroWinBackAction("+ 15 Dias"), "winback_15d");
  assert.equal(detectTerreiroWinBackAction("+15 Dias"), "winback_15d");
  assert.equal(detectTerreiroWinBackAction("15 dias gratis"), "winback_15d");
  assert.equal(detectTerreiroWinBackAction("+ 15"), "winback_15d");
  assert.equal(detectTerreiroWinBackAction("quero mais 15 dias"), "winback_15d");
});

test("WinBack: reconhece ação de 15 Dias + 50% de desconto", () => {
  assert.equal(detectTerreiroWinBackAction("15 Dias + 50%"), "winback_15d_plus_50");
  assert.equal(detectTerreiroWinBackAction("15D + 50%"), "winback_15d_plus_50");
  assert.equal(detectTerreiroWinBackAction("15 dias e 50%"), "winback_15d_plus_50");
  assert.equal(detectTerreiroWinBackAction("15d+50%"), "winback_15d_plus_50");
});

test("WinBack: reconhece ação de 50% de Desconto imediato", () => {
  assert.equal(detectTerreiroWinBackAction("50% de Desconto"), "winback_discount_50");
  assert.equal(detectTerreiroWinBackAction("50% Desconto"), "winback_discount_50");
  assert.equal(detectTerreiroWinBackAction("50%"), "winback_discount_50");
  assert.equal(detectTerreiroWinBackAction("50% off"), "winback_discount_50");
  assert.equal(detectTerreiroWinBackAction("quero os 50%"), "winback_discount_50");
});

test("WinBack: ignora mensagens não relacionadas a resgate", () => {
  assert.equal(detectTerreiroWinBackAction("Confirmar presença"), null);
  assert.equal(detectTerreiroWinBackAction("Bom dia!"), null);
  assert.equal(detectTerreiroWinBackAction("Não poderei ir"), null);
});
