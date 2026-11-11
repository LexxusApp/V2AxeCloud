import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from 'node:fs';
import { resolveDiretorioWhatsapp, resolveDiretorioPublicWhatsapp, buildDiretorioWhatsappHref } from "../lib/diretorioWhatsapp.js";

test('perfil com WhatsApp de atendimento explícito publica WhatsApp e gera link wa.me', () => {
  const row = { nome: 'Terreiro Pedreira de Xangô', telefone: '(62) 99415-4669', whatsapp_atendimento: '62994154669', verified_at: '2026-10-21' };
  assert.equal(resolveDiretorioPublicWhatsapp(row), '5562994154669');
  const href = buildDiretorioWhatsappHref({ nome: row.nome, whatsapp: row.whatsapp_atendimento });
  assert.ok(href);
  assert.equal(new URL(href).pathname, '/5562994154669');
});

test('perfil administrado pela casa preserva WhatsApp de atendimento e sua mensagem', () => {
  assert.equal(resolveDiretorioPublicWhatsapp({ claimed_by_tenant_id: 'tenant', whatsapp_atendimento: '(11) 98888-7777', telefone: '(11) 99999-0000' }), '5511988887777');
  const href = buildDiretorioWhatsappHref({ nome: 'Casa de exemplo', gerenciada: true, whatsapp: '(11) 99999-0000' }, '(11) 98888-7777');
  assert.ok(href);
  assert.equal(new URL(href).pathname, '/5511988887777');
  assert.match(new URL(href).searchParams.get('text') || '', /Casa de exemplo/);
  assert.equal(buildDiretorioWhatsappHref({ nome: 'Casa de exemplo', gerenciada: true, whatsapp: 'inválido' }), null);
});

test("prioriza o WhatsApp informado pelo terreiro", () => {
  assert.equal(resolveDiretorioWhatsapp("(11) 3123-4567", "(11) 99999-0000"), "551131234567");
});

test('perfil no diretório usa buildDiretorioWhatsappHref e prioriza contato da casa', () => {
  const profile = readFileSync(new URL('../src/views/portal/DiretorioTerreiroPage.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../api/lib/diretorioPublicRoutes.ts', import.meta.url), 'utf8');
  assert.match(profile, /const whatsappHref = (?:terreiro\.gerenciada[\s\S]{0,140})?buildDiretorioWhatsappHref/);
  assert.match(api, /const whatsapp = resolveDiretorioPublicWhatsapp\(row\)/);
});

test("reconhece celular brasileiro válido na base antiga", () => {
  assert.equal(resolveDiretorioWhatsapp(null, "(11) 99999-0000"), "5511999990000");
  assert.equal(resolveDiretorioWhatsapp(null, "+55 21 98888-7777"), "5521988887777");
  // Suporte a números com 0 no DDD (ex: 011915128744 da Tenda OCA Cabocla Jacira)
  assert.equal(resolveDiretorioWhatsapp(null, "011915128744"), "5511915128744");
  assert.equal(resolveDiretorioWhatsapp(null, "(011) 91512-8744"), "5511915128744");
  assert.equal(resolveDiretorioWhatsapp(null, "021991753227"), "5521991753227");
  assert.equal(resolveDiretorioWhatsapp(null, "014991860227"), "5514991860227");
});

test("não apresenta telefone fixo antigo como WhatsApp confirmado", () => {
  assert.equal(resolveDiretorioWhatsapp(null, "(11) 3123-4567"), null);
  assert.equal(resolveDiretorioWhatsapp(null, "01131234567"), null);
  assert.equal(resolveDiretorioWhatsapp(null, "número indisponível"), null);
});
