import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { directoryClaimFirstName, directoryClaimRegisterUrl } from "../api/lib/diretorioClaimNotify.ts";
import { buildReivindicacaoAprovadaComponents } from "../api/lib/whatsappMetaCloud.ts";

const publicRoutes = readFileSync("api/lib/diretorioPublicRoutes.ts", "utf8");
const adminRoutes = readFileSync("api/lib/diretorioClaimAdminRoutes.ts", "utf8");
const claimNotify = readFileSync("api/lib/diretorioClaimNotify.ts", "utf8");
const metaCloud = readFileSync("api/lib/whatsappMetaCloud.ts", "utf8");
const claimTemplates = readFileSync("scripts/meta-whatsapp-claim-templates.mjs", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260818120000_terreiros_diretorio_claims.sql",
  "utf8",
);
const acquisitionMigration = readFileSync(
  "supabase/migrations/20260826193000_directory_claim_acquisition.sql",
  "utf8",
);
const activationMigration = readFileSync(
  "supabase/migrations/20260929210000_directory_claim_activation_funnel.sql",
  "utf8",
);
const activationService = readFileSync("api/lib/directoryClaimActivation.ts", "utf8");
const activationTemplates = readFileSync("api/lib/directoryClaimMetaTemplates.ts", "utf8");
const onboardingRoutes = readFileSync("api/lib/onboardingRoutes.ts", "utf8");
const tenantOnboarding = readFileSync("api/lib/tenantOnboarding.ts", "utf8");
const activationExperience = readFileSync("src/components/claim/ClaimActivationExperience.tsx", "utf8");
const cloudflareApiWorker = readFileSync("cloudflare/api-container-worker.ts", "utf8");
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
  assert.match(adminRoutes, /notifyApprovedTerreiroClaim/);
});

test("aprovação dispara WhatsApp com link de cadastro vinculado ao protocolo", () => {
  assert.equal(
    directoryClaimRegisterUrl("11111111-1111-4111-8111-111111111111"),
    "https://axecloud.com.br/register?claim=11111111-1111-4111-8111-111111111111",
  );
  assert.equal(directoryClaimFirstName("MAILSON RICELLI HERMOGENES DE OLIVEIRA"), "Mailson");
  const components = buildReivindicacaoAprovadaComponents(
    "Mailson",
    "Terreiro de Umbanda Xango",
    "11111111-1111-4111-8111-111111111111",
  );
  assert.equal(components[0]?.type, "body");
  assert.equal(components[1]?.type, "button");
  assert.equal(components[1]?.sub_type, "url");
  const buttonParam = components[1]?.parameters?.[0];
  assert.equal(buttonParam && "text" in buttonParam ? buttonParam.text : undefined, "11111111-1111-4111-8111-111111111111");
  assert.match(claimNotify, /normalizeBrazilMsisdn/);
  assert.match(activationTemplates, /reivindicacao_aprovada_axecloud/);
  assert.match(claimTemplates, /register\?claim=\{\{1\}\}/);
  assert.match(claimTemplates, /category: "UTILITY"/);
});

test("responsável acompanha o protocolo sem exposição pública de dados", () => {
  assert.match(publicRoutes, /reivindicacao\/acompanhar/);
  assert.match(publicRoutes, /\.eq\("requester_email", requesterEmail\)/);
  assert.doesNotMatch(publicRoutes, /nextAction:[\s\S]{0,500}admin_notes/);
  assert.match(statusDialog, /Acompanhamento protegido/);
  assert.match(publicRoutes, /Criar acesso e conectar a casa/);
});

test("cadastro com claim aprovado abre ativação expressa sem repetir os dados da casa", () => {
  assert.match(publicRoutes, /reivindicacao\/:claimId\/cadastro/);
  assert.match(publicRoutes, /canRegister/);
  assert.match(publicRoutes, /status !== "approved" && claim.status !== "pending"/);
  assert.match(publicRoutes, /nomeTerreiro/);
  assert.match(publicRoutes, /nomeZelador/);
  const registerPage = readFileSync("src/views/Register.tsx", "utf8");
  assert.match(registerPage, /<ClaimActivationExperience claimId=\{claimId\}/);
  assert.match(activationExperience, /Falta apenas criar seu acesso/);
  assert.match(activationExperience, /Não vamos pedir novamente endereço, fotos ou documentos/);
  assert.match(activationExperience, /claimId,[\s\S]*password,[\s\S]*billingCycle/);
  assert.doesNotMatch(activationExperience, /nome_terreiro\s*:/);
});

test("ativação valida a reivindicação no servidor antes de criar a conta", () => {
  assert.match(onboardingRoutes, /registerApprovedClaimTenant/);
  assert.match(tenantOnboarding, /\.from\("terreiro_claim_requests"\)/);
  assert.match(tenantOnboarding, /String\(claim\.status\) !== "approved"/);
  assert.match(tenantOnboarding, /\.from\("terreiros_diretorio"\)/);
  assert.match(tenantOnboarding, /connect_approved_terreiro_claim/);
  assert.match(tenantOnboarding, /const cleanup = async/);
  assert.match(onboardingRoutes, /!claimActivation && !resolveEfiEnv\(\)/);
});

test("funil registra abertura, início, conclusão e lembretes automáticos", () => {
  assert.match(activationMigration, /activation_opened/);
  assert.match(activationMigration, /activation_started/);
  assert.match(activationMigration, /activation_completed/);
  assert.match(activationMigration, /reminder_24h_sent/);
  assert.match(activationMigration, /reminder_72h_sent/);
  assert.match(activationService, /ageHours >= 72/);
  assert.match(activationService, /notificationKind: is72h \? "reminder_72h" : "reminder_24h"/);
  assert.match(activationService, /stageEvents\.has\("activation_completed"\)/);
  assert.match(activationService, /ensureDirectoryClaimTemplates/);
  assert.match(activationTemplates, /status === "APPROVED" \? desired : LEGACY_APPROVAL_TEMPLATE/);
  assert.match(activationTemplates, /reivindicacao_ativacao_v2_axecloud/);
  assert.match(activationExperience, /recordProgress\(claimId, 'opened'\)/);
  assert.match(activationExperience, /recordProgress\(claimId, 'started'\)/);
  assert.match(cloudflareApiWorker, /hourInSaoPaulo === 12/);
  assert.match(cloudflareApiWorker, /runJob\("whatsapp-jobs"\)/);
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
  assert.match(appMap, /const highlighted = point\.verificada \|\| point\.gerenciada/);
  assert.match(appMap, /ctx\.fillStyle = highlighted \? '#16865f' : '#e5ae12'/);
  assert.match(appMap, /verifiedCount/);

  const marketingMap = readFileSync("cinematic-site/terreiros.html", "utf8");
  assert.match(marketingMap, /Perfil verificado/);
  assert.match(marketingMap, /point\.verificada \? "#16865f" : "#e5ae12"/);
  assert.match(marketingMap, /verifiedCount/);
  assert.match(marketingMap, /axe-map-profile__photo/);
  assert.match(marketingMap, /\.axecloud-map-popup \.leaflet-popup-content\s*\{[\s\S]*width:\s*min\(310px, calc\(100vw - 46px\)\)\s*!important;[\s\S]*overflow:\s*hidden;/);
  assert.match(marketingMap, /\.axecloud-map-popup \.axe-map-profile\s*\{[\s\S]*max-height:[\s\S]*overflow-y:\s*auto;/);
  assert.doesNotMatch(marketingMap, /\.axecloud-map-popup\.leaflet-popup\s*\{[\s\S]*transform:\s*none\s*!important;/);
  assert.match(marketingMap, /\/api\/v1\/public\/diretorio\/terreiro\/\$\{encodeURIComponent\(point\.slug\)\}/);
  assert.match(marketingMap, /detalhesPopupPorSlug\.set\(point\.slug, detalhes\)/);
});
