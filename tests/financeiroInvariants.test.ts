import assert from "node:assert/strict";
import test from "node:test";
import { countsTowardSaldo } from "../src/lib/financeiroSaldo.ts";
import {
  comprovanteBeneficiarioMatches,
  isComprovanteDateCompatible,
  normalizeComprovanteDate,
  normalizeComprovanteTransactionId,
} from "../api/lib/comprovanteValidation.ts";

test("mensalidade pendente nunca compõe o saldo", () => {
  assert.equal(
    countsTowardSaldo({
      tipo: "entrada",
      categoria: "Mensalidade",
      status: "pendente",
      descricao: "Mensalidade - Ana (vencimento 2026-07-10)",
    }),
    false
  );
  assert.equal(
    countsTowardSaldo({ tipo: "conta_receber", categoria: "Mensalidade", status: "pendente" }),
    false
  );
});

test("somente mensalidade paga ou legado quitado compõe o saldo", () => {
  assert.equal(
    countsTowardSaldo({ tipo: "entrada", categoria: "Mensalidade", status: "pago" }),
    true
  );
  assert.equal(
    countsTowardSaldo({
      tipo: "entrada",
      categoria: "Mensalidade",
      descricao: "Mensalidade - Ana (competência 2026-07-10)",
    }),
    true
  );
  assert.equal(
    countsTowardSaldo({ tipo: "entrada", categoria: "Mensalidade", status: "desconhecido" }),
    false
  );
});

test("lançamentos comuns continuam compondo o caixa", () => {
  assert.equal(countsTowardSaldo({ tipo: "entrada", categoria: "Doação" }), true);
  assert.equal(countsTowardSaldo({ tipo: "saida", categoria: "Aluguel" }), true);
  assert.equal(countsTowardSaldo({ tipo: "entrada", categoria: "Doação", status: "pendente" }), false);
});

test("normaliza e limita a data do comprovante à competência", () => {
  const now = new Date("2026-07-15T12:00:00.000Z");
  assert.equal(normalizeComprovanteDate("10/07/2026 14:30"), "2026-07-10");
  assert.equal(normalizeComprovanteDate("2026-02-30"), null);
  assert.equal(isComprovanteDateCompatible("2026-07-10", "2026-07-10", now), true);
  assert.equal(isComprovanteDateCompatible("2026-05-10", "2026-07-10", now), false);
  assert.equal(isComprovanteDateCompatible("2026-07-20", "2026-07-10", now), false);
});

test("confere beneficiário e normaliza o identificador Pix", () => {
  assert.equal(comprovanteBeneficiarioMatches("Casa de Axé Oxum", "CASA DE AXE OXUM LTDA"), true);
  assert.equal(comprovanteBeneficiarioMatches("Casa de Axé Oxum", "Mercado Exemplo"), false);
  assert.equal(normalizeComprovanteTransactionId("E123-abc 456"), "E123ABC456");
});
