import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanSmsText,
  normalizeSmsPhone,
  isValidMobileSmsPhone,
  isEligibleSmsTipo,
  isComteleConfigured,
  getComteleApiKey,
  getComteleBalance,
  buildSmsFallbackMessage,
} from "../api/lib/comteleSms.js";

describe("comteleSms", () => {
  it("recupera a chave configurada", () => {
    assert.equal(isComteleConfigured(), true);
    assert.match(getComteleApiKey(), /^[0-9a-f-]{36}$/i);
  });

  it("normaliza telefones brasileiros para padrão 55DD9XXXXXXXX", () => {
    assert.equal(normalizeSmsPhone("11999998888"), "5511999998888");
    assert.equal(normalizeSmsPhone("(82) 99981-1036"), "5582999811036");
    assert.equal(normalizeSmsPhone("+55 35 99153-1203"), "5535991531203");
  });

  it("valida números móveis com nono dígito obrigatório (13 dígitos)", () => {
    // Válidos: 55 + DDD + 9 + 8 dígitos = 13 dígitos
    assert.equal(isValidMobileSmsPhone("5511999998888"), true);
    assert.equal(isValidMobileSmsPhone("(82) 99981-1036"), true);
    assert.equal(isValidMobileSmsPhone("+55 35 99153-1203"), true);

    // Inválidos: números antigos de 8 dígitos sem o nono dígito
    assert.equal(isValidMobileSmsPhone("556192809791"), false);
    assert.equal(isValidMobileSmsPhone("554898538834"), false);
    assert.equal(isValidMobileSmsPhone("6192809791"), false);

    // Inválidos: fixos ou números falsos
    assert.equal(isValidMobileSmsPhone("551133334444"), false);
    assert.equal(isValidMobileSmsPhone("1333333333"), false);
    assert.equal(isValidMobileSmsPhone(""), false);
  });

  it("filtra estritamente tipos elegíveis para SMS de contingência", () => {
    assert.equal(isEligibleSmsTipo("aviso_gira"), true);
    assert.equal(isEligibleSmsTipo("dados_acesso"), true);
    assert.equal(isEligibleSmsTipo("mensalidade_pendente"), true);
    assert.equal(isEligibleSmsTipo("mural_aviso"), true);

    // Tipos de comunicados administrativos/zeladores ou sem template NÃO são elegíveis
    assert.equal(isEligibleSmsTipo("anuncio_sms_zelador"), false);
    assert.equal(isEligibleSmsTipo("broadcast_sistema"), false);
    assert.equal(isEligibleSmsTipo("qualquer_coisa"), false);
    assert.equal(isEligibleSmsTipo(""), false);
    assert.equal(isEligibleSmsTipo(null), false);
  });

  it("não gera texto de SMS para tipos não homologados", () => {
    const msg = buildSmsFallbackMessage({
      tipo: "anuncio_sms_zelador",
      originalMessage: "Olá Zelador, temos novidades no sistema...",
    });
    assert.equal(msg, "");
  });

  it("limpa formatacao de markdown do whatsapp para envio de SMS", () => {
    const raw = "Olá, *Lucas*! Seu código de acesso é _123456_. `axecloud.com.br`\n\n\nAxé!";
    const cleaned = cleanSmsText(raw);
    assert.equal(cleaned, "Olá, Lucas! Seu código de acesso é 123456. axecloud.com.br\n\nAxé!");
  });

  it("personaliza aviso de gira no SMS com nome do membro, gira, data/hora e terreiro", () => {
    const msg = buildSmsFallbackMessage({
      tipo: "aviso_gira",
      nomeMembro: "Janiel",
      nomeTerreiro: "Ilê Axé",
      originalMessage: "Gira (corrente): Homenagem a Oxum — 07/11/2026 16:00:00 · hoje",
    });
    assert.match(msg, /Olá, Janiel!/);
    assert.match(msg, /Homenagem a Oxum/);
    assert.match(msg, /dia 07\/11 às 16:00/);
    assert.match(msg, /no Ilê Axé/);
    assert.match(msg, /https:\/\/axecloud\.com\.br\/entrar/);
  });

  it("envia dados completos de acesso do membro no SMS (registro, login e senha)", () => {
    const msgComEmail = buildSmsFallbackMessage({
      tipo: "dados_acesso",
      nomeMembro: "Lucas",
      nomeTerreiro: "Ilê Axé",
      email: "lucas@axecloud.com.br",
      matricula: "AXC-2026-B1C2",
    });
    assert.match(msgComEmail, /Olá, Lucas!/);
    assert.match(msgComEmail, /Login: seu e-mail \(lucas@axecloud\.com\.br\), celular ou Registro AXC-2026-B1C2/);
    assert.match(msgComEmail, /Senha: 6 primeiros dígitos do seu CPF/);
    assert.match(msgComEmail, /https:\/\/axecloud\.com\.br\/entrar/);

    const msgSemEmail = buildSmsFallbackMessage({
      tipo: "dados_acesso",
      nomeMembro: "Lucas",
      nomeTerreiro: "Ilê Axé",
      matricula: "AXC-2026-B1C2",
    });
    assert.match(msgSemEmail, /Login: seu e-mail, celular ou Registro AXC-2026-B1C2/);
  });

  it("envia informacoes claras de mensalidade no SMS", () => {
    const msg = buildSmsFallbackMessage({
      tipo: "mensalidade_pendente",
      nomeMembro: "Gisele",
      nomeTerreiro: "Ilê Axé",
      originalMessage: "Mensalidade referente a Novembro · Valor R$ 70,00",
    });
    assert.match(msg, /Olá, Gisele!/);
    assert.match(msg, /contribuição mensal.*\(R\$ 70,00\) no Ilê Axé/);
    assert.match(msg, /https:\/\/axecloud\.com\.br\/entrar/);
  });

  it("consulta saldo real na API da Comtele com sucesso", async () => {
    const res = await getComteleBalance();
    assert.equal(res.success, true);
    assert.equal(typeof res.balance, "number");
    assert.ok(res.balance >= 0, "saldo deve ser maior ou igual a zero");
  });
});
