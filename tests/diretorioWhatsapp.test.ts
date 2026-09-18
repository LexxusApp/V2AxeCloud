import test from "node:test";
import assert from "node:assert/strict";
import { resolveDiretorioWhatsapp } from "../lib/diretorioWhatsapp.js";

test("prioriza o WhatsApp informado pelo terreiro", () => {
  assert.equal(resolveDiretorioWhatsapp("(11) 3123-4567", "(11) 99999-0000"), "551131234567");
});

test("reconhece celular brasileiro válido na base antiga", () => {
  assert.equal(resolveDiretorioWhatsapp(null, "(11) 99999-0000"), "5511999990000");
  assert.equal(resolveDiretorioWhatsapp(null, "+55 21 98888-7777"), "5521988887777");
});

test("não apresenta telefone fixo antigo como WhatsApp confirmado", () => {
  assert.equal(resolveDiretorioWhatsapp(null, "(11) 3123-4567"), null);
  assert.equal(resolveDiretorioWhatsapp(null, "número indisponível"), null);
});