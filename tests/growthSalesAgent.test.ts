import assert from "node:assert/strict";
import test from "node:test";
import { completeSalesReplyPrefix, isCompleteSalesReply } from "../api/lib/growthGemini.js";
import { mergeSalesStage, nextStage, statusForSalesStage } from "../api/lib/growthSalesAgent.js";

test("resposta comercial incompleta é detectada e reduzida à última frase completa", () => {
  const interrupted = "O financeiro organiza mensalidades e recebimentos via Pix. Isso facilitaria o dia";
  assert.equal(isCompleteSalesReply(interrupted), false);
  assert.equal(completeSalesReplyPrefix(interrupted), "O financeiro organiza mensalidades e recebimentos via Pix.");
  assert.equal(isCompleteSalesReply("Qual recurso mais ajudaria sua casa?"), true);
  assert.equal(isCompleteSalesReply("Teste em https://axecloud.com.br/cadastro"), true);
});

test("estágio comercial avança sem regredir", () => {
  assert.equal(nextStage("Quero conhecer e testar"), "interessado");
  assert.equal(nextStage("Qual é o valor da mensalidade?"), "avaliando");
  assert.equal(mergeSalesStage("interessado", "conversa"), "interessado");
  assert.equal(mergeSalesStage("interessado", "avaliando"), "avaliando");
  assert.equal(statusForSalesStage("qualificado", "conversa"), "qualificado");
  assert.equal(statusForSalesStage("respondeu", "avaliando"), "qualificado");
});
