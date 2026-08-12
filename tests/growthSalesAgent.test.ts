import assert from "node:assert/strict";
import test from "node:test";
import {
  completeSalesReplyPrefix,
  fallbackSalesReply,
  isCompleteSalesReply,
  salesGreetingInstruction,
} from "../api/lib/growthGemini.js";
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

test("saudação é permitida somente na primeira resposta e não usa nome automático", () => {
  const first = salesGreetingInstruction([{ direction: "inbound", body: "Quero conhecer" }]);
  assert.match(first, /primeira resposta/i);
  assert.match(first, /sem usar o nome automático/i);

  const continuation = salesGreetingInstruction([
    { direction: "inbound", body: "Quero conhecer" },
    { direction: "outbound", body: "Axé! Como posso ajudar?" },
    { direction: "inbound", body: "Como funciona?" },
  ]);
  assert.match(continuation, /não repita 'Axé'/i);
  assert.match(continuation, /diretamente do assunto/i);
});

test("contingência nunca deixa pedido de teste sem resposta", () => {
  const reply = fallbackSalesReply({
    history: [
      { direction: "outbound", body: "Como posso ajudar?" },
      { direction: "inbound", body: "Quero fazer o teste gratuito, como faço?" },
    ],
    monthlyPriceLabel: "R$ 49,90",
    registrationUrl: "https://axecloud.com.br/cadastro",
  });
  assert.match(reply, /30 dias/i);
  assert.match(reply, /sem cartão/i);
  assert.match(reply, /https:\/\/axecloud\.com\.br\/cadastro/);
  assert.doesNotMatch(reply, /^Axé/i);
  assert.doesNotMatch(reply, /Lucas/i);
});
