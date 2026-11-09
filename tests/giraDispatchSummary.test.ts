import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildResumoDisparoGiraText } from "../api/lib/giraDispatchSummaryWhatsApp.js";

describe("buildResumoDisparoGiraText", () => {
  it("retorna mensagem quando nao ha membros elegiveis", () => {
    assert.match(
      buildResumoDisparoGiraText({
        enviados: 0,
        entregues: 0,
        falhas: 0,
        pendentes: 0,
        eligible: 0,
      }),
      /Nenhum membro com WhatsApp/,
    );
  });

  it("confirma sucesso total em linhas separadas", () => {
    const text = buildResumoDisparoGiraText({
      enviados: 30,
      entregues: 30,
      falhas: 0,
      pendentes: 0,
      eligible: 30,
    });
    assert.match(text, /✅ 30 médiuns receberam com sucesso/);
  });

  it("informa falhas com motivo amigavel e formato visual", () => {
    const text = buildResumoDisparoGiraText({
      enviados: 28,
      entregues: 25,
      falhas: 3,
      pendentes: 0,
      eligible: 28,
      failedMembers: [
        { nome: "Ogã Juniel", telefone: "5582999811036", motivo: "Número sem WhatsApp ativo (#131026)" },
        { nome: "Kely D' Oxum", telefone: "5535991459837", motivo: "Restrição temporária na Meta (#130472)" },
        { nome: "Brenda D'Òṣún", telefone: "5535991531203", motivo: "Bloqueio temporário pela Meta (#131049 — peça para mandar Oi)" },
      ],
    });
    assert.match(text, /✅ 25 médiuns receberam com sucesso/);
    assert.match(text, /⚠️ 3 números falharam:/);
    assert.match(text, /• Ogã Juniel \(82 99981-1036\) — Número sem WhatsApp ativo/);
    assert.match(text, /• Kely D' Oxum \(35 99145-9837\) — Restrição temporária na Meta/);
    assert.match(text, /• Brenda D'Òṣún \(35 99153-1203\) — Bloqueio temporário pela Meta/);
  });
});
