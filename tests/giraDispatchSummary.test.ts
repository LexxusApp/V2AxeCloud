import { describe, expect, it } from "vitest";
import { buildResumoDisparoGiraText } from "../api/lib/giraDispatchSummaryWhatsApp.js";

describe("buildResumoDisparoGiraText", () => {
  it("retorna mensagem quando nao ha membros elegiveis", () => {
    expect(
      buildResumoDisparoGiraText({
        enviados: 0,
        entregues: 0,
        falhas: 0,
        pendentes: 0,
        eligible: 0,
      })
    ).toContain("Nenhum membro com WhatsApp");
  });

  it("confirma sucesso total", () => {
    const text = buildResumoDisparoGiraText({
      enviados: 30,
      entregues: 30,
      falhas: 0,
      pendentes: 0,
      eligible: 30,
    });
    expect(text).toContain("Enviados: 30");
    expect(text).toContain("Entregues: 30");
    expect(text).toContain("Todos os membros elegiveis receberam o aviso");
  });

  it("informa falhas parciais", () => {
    const text = buildResumoDisparoGiraText({
      enviados: 30,
      entregues: 27,
      falhas: 3,
      pendentes: 0,
      eligible: 30,
    });
    expect(text).toContain("Falhas: 3");
    expect(text).toContain("3 avisos nao foram entregues");
  });
});
