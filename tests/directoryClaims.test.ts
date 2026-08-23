import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publicRoutes = readFileSync("api/lib/diretorioPublicRoutes.ts", "utf8");
const adminRoutes = readFileSync("api/lib/diretorioClaimAdminRoutes.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260818120000_terreiros_diretorio_claims.sql",
  "utf8",
);
const dialog = readFileSync("src/components/portal/TerreiroClaimDialog.tsx", "utf8");
const settingsRoutes = readFileSync("api/lib/consulentePortalRoutes.ts", "utf8");
const mapClient = readFileSync("src/lib/diretorioMap.ts", "utf8");

test("reivindicação pública é limitada, validada e gravada somente pela API", () => {
  assert.match(publicRoutes, /\/reivindicar"\s*,\s*publicFormRateLimit/);
  assert.match(publicRoutes, /acceptedTerms !== true/);
  assert.match(publicRoutes, /String\(body\.website/);
  assert.match(publicRoutes, /\.from\("terreiro_claim_requests"\)/);
  assert.doesNotMatch(dialog, /supabase\.|\.from\("terreiro_claim_requests"\)/);
});

test("análise de reivindicações passa pelo administrador global e por operação transacional", () => {
  assert.match(adminRoutes, /const ctx = await requireAdmin\(req, res\)/);
  assert.match(adminRoutes, /\.rpc\("review_terreiro_claim"/);
  assert.match(adminRoutes, /directory\.claim\.\$\{status\}/);
  assert.match(adminRoutes, /status === "approved" && !tenantId/);
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
  assert.match(appMap, /drawPoints\(true, 'rgba\(37, 99, 235/);

  const marketingMap = readFileSync("cinematic-site/terreiros.html", "utf8");
  assert.match(marketingMap, /Terreiro verificado e reivindicado/);
  assert.match(marketingMap, /drawPoints\(true, "rgba\(24, 119, 242/);
});
