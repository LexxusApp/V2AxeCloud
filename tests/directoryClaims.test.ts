import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publicRoutes = readFileSync("api/lib/diretorioPublicRoutes.ts", "utf8");
const adminRoutes = readFileSync("api/lib/diretorioClaimAdminRoutes.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260818120000_terreiros_diretorio_claims.sql",
  "utf8",
);
const acquisitionMigration = readFileSync(
  "supabase/migrations/20260826193000_directory_claim_acquisition.sql",
  "utf8",
);
const dialog = readFileSync("src/components/portal/TerreiroClaimDialog.tsx", "utf8");
const statusDialog = readFileSync("src/components/portal/TerreiroClaimStatusDialog.tsx", "utf8");
const directoryProfile = readFileSync("src/views/portal/DiretorioTerreiroPage.tsx", "utf8");
const settingsRoutes = readFileSync("api/lib/consulentePortalRoutes.ts", "utf8");
const mapClient = readFileSync("src/lib/diretorioMap.ts", "utf8");

test("reivindicação pública é limitada, validada e gravada somente pela API", () => {
  assert.match(publicRoutes, /\/reivindicar"\s*,\s*publicFormRateLimit/);
  assert.match(publicRoutes, /acceptedTerms !== true/);
  assert.match(publicRoutes, /String\(body\.website/);
  assert.match(publicRoutes, /\.from\("terreiro_claim_requests"\)/);
  assert.doesNotMatch(dialog, /supabase\.|\.from\("terreiro_claim_requests"\)/);
  assert.match(directoryProfile, /<TerreiroClaimDialog/);
  assert.doesNotMatch(directoryProfile, /wa\.me\/5511920033501[\s\S]*reivindicar/i);
  assert.match(dialog, /createPortal\([\s\S]*document\.body/);
});

test("análise de reivindicações passa pelo administrador global e por operação transacional", () => {
  assert.match(adminRoutes, /const ctx = await requireAdmin\(req, res\)/);
  assert.match(adminRoutes, /\.rpc\("review_terreiro_claim"/);
  assert.match(adminRoutes, /directory\.claim\.\$\{status\}/);
  assert.doesNotMatch(adminRoutes, /status === "approved" && !tenantId/);
  assert.match(adminRoutes, /aguardando criação da conta/);
});

test("responsável acompanha o protocolo sem exposição pública de dados", () => {
  assert.match(publicRoutes, /reivindicacao\/acompanhar/);
  assert.match(publicRoutes, /\.eq\("requester_email", requesterEmail\)/);
  assert.doesNotMatch(publicRoutes, /nextAction:[\s\S]{0,500}admin_notes/);
  assert.match(statusDialog, /Acompanhamento protegido/);
  assert.match(publicRoutes, /Criar acesso e conectar a casa/);
});

test("cadastro conecta somente reivindicação aprovada com o mesmo e-mail", () => {
  assert.match(acquisitionMigration, /v_claim\.status <> 'approved'/);
  assert.match(acquisitionMigration, /lower\(trim\(v_claim\.requester_email\)\)/);
  assert.match(acquisitionMigration, /claimed_by_tenant_id = p_tenant_id/);
  assert.match(acquisitionMigration, /revoke all[\s\S]*from public, anon, authenticated/i);
});

test("dados de reivindicação não ficam expostos por RLS", () => {
  assert.match(migration, /terreiro_claim_requests enable row level security/i);
  assert.match(migration, /revoke all on function public\.review_terreiro_claim[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute[\s\S]*to service_role/i);
  assert.match(migration, /claimed_by_tenant_id uuid references public\.perfil_lider\(id\)/i);
});

test("somente a conta vinculada edita os dados reais do diretório", () => {
  assert.match(settingsRoutes, /\/api\/v1\/settings\/directory-profile/);
  assert.match(settingsRoutes, /requireAuthOrRespond\(sb, req, res\)/);
  assert.match(settingsRoutes, /\.eq\("claimed_by_tenant_id", user\.id\)/);
  assert.match(settingsRoutes, /\.eq\("id", current\.id\)[\s\S]*\.eq\("claimed_by_tenant_id", user\.id\)/);
  assert.match(settingsRoutes, /geocodeDirectoryAddress/);
});

test("mapa consulta os pontos atuais da API e mantém o arquivo estático como contingência", () => {
  assert.match(publicRoutes, /\/api\/v1\/public\/diretorio\/mapa/);
  assert.match(mapClient, /fetch\('\/api\/v1\/public\/diretorio\/mapa'/);
  assert.match(mapClient, /fetch\('\/terreiros\/mapa\.json'/);
  assert.match(mapClient, /verificada/);

  const appMap = readFileSync("src/components/portal/DirectoryCoverageMap.tsx", "utf8");
  assert.match(appMap, /point\.verificada \? '#16865f' : '#e5ae12'/);
  assert.match(appMap, /verifiedCount/);

  const marketingMap = readFileSync("cinematic-site/terreiros.html", "utf8");
  assert.match(marketingMap, /Terreiro verificado e reivindicado/);
  assert.match(marketingMap, /point\.verificada \? "#16865f" : "#e5ae12"/);
  assert.match(marketingMap, /verifiedCount/);
  assert.match(marketingMap, /axe-map-profile__photo/);
  assert.match(marketingMap, /\/api\/v1\/public\/diretorio\/terreiro\/\$\{encodeURIComponent\(point\.slug\)\}/);
  assert.match(marketingMap, /detalhesPopupPorSlug\.set\(point\.slug, detalhes\)/);
});
