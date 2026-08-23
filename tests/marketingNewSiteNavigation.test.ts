import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const navigation = readFileSync(new URL('../src/lib/marketingNavigation.ts', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../src/views/portal/DiretorioTerreiroPage.tsx', import.meta.url), 'utf8');
const installer = readFileSync(new URL('../scripts/install-cinematic-marketing.mjs', import.meta.url), 'utf8');
const validator = readFileSync(new URL('../scripts/validate-marketing-build.mjs', import.meta.url), 'utf8');
const seo = readFileSync(new URL('../lib/diretorioSeoShared.ts', import.meta.url), 'utf8');
const router = readFileSync(new URL('../src/marketing/MarketingRouter.tsx', import.meta.url), 'utf8');
const devCinematic = readFileSync(new URL('../api/lib/devCinematicMarketing.ts', import.meta.url), 'utf8');
const apiIndex = readFileSync(new URL('../api/index.ts', import.meta.url), 'utf8');

test('navegação entre páginas públicas volta ao servidor e não ao SPA legado', () => {
  assert.match(navigation, /if \(targetPath !== currentPath\) return false;/);
  assert.match(navigation, /return Boolean\(url\.hash\)/);
});

test('perfil sempre oferece retorno ao mapa novo', () => {
  assert.ok((profile.match(/Voltar para o Mapa/g)?.length || 0) >= 1);
  assert.doesNotMatch(profile, /cityHref|Terreiros em \$\{terreiro\.cidade\}|Ver outras casas na região/);
  assert.match(seo, /href: "\/terreiros", label: "Voltar para o mapa de terreiros"/);
});

test('página genérica antiga de terreiro não entra mais no build público', () => {
  assert.doesNotMatch(installer, /\['terreiro\.html', 'terreiro\/index\.html'\]/);
  assert.doesNotMatch(validator, /'terreiro\/index\.html'/);
});

test('shell público não renderiza mais as telas legadas de home e diretório', () => {
  assert.doesNotMatch(router, /views\/Landing|TerreiroProfilePage|TerreirosCityPage/);
  assert.match(router, /PublicDocumentRedirect/);
});

test('localhost serve o mapa cinematográfico em /terreiros, não o SPA legado', () => {
  assert.match(devCinematic, /"\/terreiros": "terreiros.html"/);
  assert.match(apiIndex, /registerDevCinematicMarketing/);
});
