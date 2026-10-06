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

  it("confirma sucesso total", () => {
    const text = buildResumoDisparoGiraText({
      enviados: 30,
      entregues: 30,
      falhas: 0,
      pendentes: 0,
      eligible: 30,
    });
    assert.match(text, /Enviados: 30/);
    assert.match(text, /Entregues: 30/);
    assert.match(text, /Todos os membros elegiveis receberam o aviso/);
  });

  it("informa falhas parciais", () => {
    const text = buildResumoDisparoGiraText({
      enviados: 30,
      entregues: 27,
      falhas: 3,
      pendentes: 0,
      eligible: 30,
    });
    assert.match(text, /Falhas: 3/);
    assert.match(text, /3 avisos nao foram entregues/);
  });
});
