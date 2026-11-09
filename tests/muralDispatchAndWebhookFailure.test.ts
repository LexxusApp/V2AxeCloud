import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildResumoDisparoMuralText,
  type MuralDispatchSummaryStats,
} from "../api/lib/muralDispatchSummaryWhatsApp.js";
import {
  humanizeMetaFailureReason,
  humanizeTipoMensagem,
} from "../api/lib/falhaAcessoMembroZeladorWhatsApp.js";

describe("buildResumoDisparoMuralText", () => {
  it("retorna mensagem clara quando não há membros elegíveis", () => {
    const stats: MuralDispatchSummaryStats = {
      titulo: "Festa de Oxóssi",
      enviados: 0,
      entregues: 0,
      falhas: 0,
      pendentes: 0,
      eligible: 0,
      failedMembers: [],
      deliveredMemberNames: [],
    };
    const text = buildResumoDisparoMuralText(stats);
    assert.match(text, /Nenhum membro ativo com WhatsApp/);
    assert.match(text, /Festa de Oxóssi/);
  });

  it("formata relatório de sucesso total para a corrente", () => {
    const stats: MuralDispatchSummaryStats = {
      titulo: "Gira Festiva",
      enviados: 25,
      entregues: 25,
      falhas: 0,
      pendentes: 0,
      eligible: 25,
      failedMembers: [],
      deliveredMemberNames: [],
    };
    const text = buildResumoDisparoMuralText(stats);
    assert.match(text, /Relatório do Comunicado: "Gira Festiva"/);
    assert.match(text, /25 médiuns receberam com sucesso no WhatsApp/);
    assert.doesNotMatch(text, /não receberam/);
  });

  it("formata relatório detalhado com nomes, telefones e motivos dos que falharam", () => {
    const stats: MuralDispatchSummaryStats = {
      titulo: "Ensaio Geral",
      enviados: 20,
      entregues: 18,
      falhas: 2,
      pendentes: 0,
      eligible: 20,
      failedMembers: [
        {
          nome: "Gisele D' Oyá",
          telefone: "5535991531203",
          motivo: "Bloqueio temporário pela Meta (#131049)",
        },
        {
          nome: "Ogã Janiel",
          telefone: "5582999811036",
          motivo: "Número sem WhatsApp ativo (#131026)",
        },
      ],
      deliveredMemberNames: [],
    };
    const text = buildResumoDisparoMuralText(stats);
    assert.match(text, /18 médiuns receberam com sucesso/);
    assert.match(text, /2 médiuns não receberam/);
    assert.match(text, /Gisele D' Oyá/);
    assert.match(text, /35 99153-1203/);
    assert.match(text, /Bloqueio temporário pela Meta \(#131049\)/);
    assert.match(text, /Ogã Janiel/);
    assert.match(text, /82 99981-1036/);
    assert.match(text, /Número sem WhatsApp ativo \(#131026\)/);
    assert.match(text, /Você pode passar o aviso diretamente a eles no terreiro/);
  });

  it("indica pendentes quando mensagens ainda estão em trânsito de rede", () => {
    const stats: MuralDispatchSummaryStats = {
      titulo: "Reunião de Pais Pequenos",
      enviados: 10,
      entregues: 7,
      falhas: 1,
      pendentes: 2,
      eligible: 10,
      failedMembers: [
        {
          nome: "Carlos",
          telefone: "11988887777",
          motivo: "Número incorreto",
        },
      ],
      deliveredMemberNames: [],
    };
    const text = buildResumoDisparoMuralText(stats);
    assert.match(text, /7 médiuns receberam/);
    assert.match(text, /1 médium não recebeu/);
    assert.match(text, /2 avisos ainda em trânsito de entrega/);
  });
});

describe("humanizeMetaFailureReason", () => {
  it("traduz #131026 para número sem WhatsApp", () => {
    const reason = humanizeMetaFailureReason("#131026 — Message undeliverable");
    assert.match(reason, /Número sem WhatsApp ativo ou telefone incorreto \(#131026\)/);
  });

  it("traduz #131049 para bloqueio de ecossistema com orientação de mandar Oi", () => {
    const reason = humanizeMetaFailureReason("#131049 — This message was not delivered to maintain healthy ecosystem engagement");
    assert.match(reason, /Bloqueio temporário pela Meta \(#131049/);
    assert.match(reason, /mandar um 'Oi' para o WhatsApp do AxéCloud/);
  });

  it("traduz #131047 para janela fechada", () => {
    const reason = humanizeMetaFailureReason("#131047 — Re-engagement message");
    assert.match(reason, /Janela de conversa de 24h fechada/);
  });

  it("retorna fallback amigável quando erro não é catalogado", () => {
    const reason = humanizeMetaFailureReason("Algum erro desconhecido da rede");
    assert.match(reason, /Falha de entrega: Algum erro desconhecido da rede/);
  });
});

describe("humanizeTipoMensagem", () => {
  it("humaniza tipos chave do sistema", () => {
    assert.equal(humanizeTipoMensagem("dados_acesso"), "Dados de Acesso");
    assert.equal(humanizeTipoMensagem("transmissao_aviso"), "Comunicado do Mural");
    assert.equal(humanizeTipoMensagem("mural_aviso"), "Comunicado do Mural");
    assert.equal(humanizeTipoMensagem("broadcast"), "Comunicado do Mural");
    assert.equal(humanizeTipoMensagem("aviso_gira_lembrete_membro_axecloud"), "Aviso de Gira");
    assert.equal(humanizeTipoMensagem("cobranca_mensalidade"), "Cobrança de Mensalidade");
    assert.equal(humanizeTipoMensagem("aviso_portal_conta_axecloud"), "Convite do Portal");
  });
});

describe("muralDispatchSummaryWhatsApp template safety", () => {
  it("garante que nenhum texto livre seja tentado e usa template oficial", async () => {
    const fs = await import("node:fs");
    const code = fs.readFileSync("api/lib/muralDispatchSummaryWhatsApp.ts", "utf8");
    assert.doesNotMatch(code, /sendMetaCloudText/, "muralDispatchSummaryWhatsApp não deve chamar sendMetaCloudText");
    assert.match(code, /resolveResumoDisparoGiraTemplateName/, "deve resolver template oficial de resumo");
    assert.match(code, /aviso_geral_axecloud/, "deve possuir fallback aviso_geral_axecloud");
  });
});
