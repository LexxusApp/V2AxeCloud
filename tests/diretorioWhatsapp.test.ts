import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from 'node:fs';
import { resolveDiretorioWhatsapp, resolveDiretorioPublicWhatsapp, buildDiretorioWhatsappHref } from "../lib/diretorioWhatsapp.js";

test('perfil não reivindicado não publica WhatsApp, mesmo com celular ou campo explícito', () => {
  const row = { nome: 'Casa de exemplo', telefone: '(11) 99999-0000', whatsapp_atendimento: '(11) 98888-7777', verified_at: '2026-10-08' };
  assert.equal(resolveDiretorioPublicWhatsapp(row), null);
  assert.equal(buildDiretorioWhatsappHref({ nome: row.nome, whatsapp: row.whatsapp_atendimento }, row.telefone), null);
  assert.equal(buildDiretorioWhatsappHref({ nome: row.nome, gerenciada: false, whatsapp: row.whatsapp_atendimento }), null);
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

test('todas as ações do perfil usam a política de contato e números não reivindicados são texto', () => {
  const profile = readFileSync(new URL('../src/views/portal/DiretorioTerreiroPage.tsx', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../src/components/portal/DiretorioTerreiroCard.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../api/lib/diretorioPublicRoutes.ts', import.meta.url), 'utf8');
  const publicProfileTemplate = readFileSync(new URL('../cinematic-site/terreiro.html', import.meta.url), 'utf8');
  assert.match(profile, /const whatsappHref = terreiro\.gerenciada\s*\?\s*buildDiretorioWhatsappHref\(terreiro, servicosData\.whatsappAtendimento\)/);
  assert.equal(profile.includes('wa.me'), false);
  assert.match(profile, /!terreiro.gerenciada && terreiro.telefone/);
  assert.match(profile, /label="Telefone"/);
  assert.equal(profile.includes('o número não fica exposto'), false);
  assert.match(profile, /!terreiro.gerenciada \? <InfoRow icon=\{Phone\}/);
  assert.match(card, /terreiro.gerenciada \? <a/);
  assert.match(card, /<\/a> : <span className="select-text font-semibold">/);
  assert.match(api, /const whatsapp = resolveDiretorioPublicWhatsapp\(row\)/);
  assert.match(publicProfileTemplate, /const gerenciada = Boolean\(casa\?\.gerenciada \|\| casa\?\.verificada\)/);
  assert.match(publicProfileTemplate, /const wa = gerenciada \? waHref\(casa\?\.whatsapp \|\| casa\?\.telefone/);
  assert.match(publicProfileTemplate, /container\.textContent = telefone \|\| "Telefone não informado"/);
});

test("reconhece celular brasileiro válido na base antiga", () => {
  assert.equal(resolveDiretorioWhatsapp(null, "(11) 99999-0000"), "5511999990000");
  assert.equal(resolveDiretorioWhatsapp(null, "+55 21 98888-7777"), "5521988887777");
});

test("não apresenta telefone fixo antigo como WhatsApp confirmado", () => {
  assert.equal(resolveDiretorioWhatsapp(null, "(11) 3123-4567"), null);
  assert.equal(resolveDiretorioWhatsapp(null, "número indisponível"), null);
});
