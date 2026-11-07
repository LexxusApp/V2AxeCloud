import fs from 'fs';
import path from 'path';

const cwd = process.cwd();
const basePath = cwd.endsWith('AxecloudV2') ? cwd : path.join(cwd, 'AxecloudV2');

// 1. Enable Cantina in frontend feature flag
const cantinaFeaturePath = path.join(basePath, 'src/lib/cantinaFeature.ts');
let cantinaFeatureContent = fs.readFileSync(cantinaFeaturePath, 'utf8');

const oldCantinaFn = `export function isCantinaEnabled(
  tenantData?: { tenant_id?: string | null; email?: string | null } | null,
  userEmail?: string | null,
  userId?: string | null
): boolean {
  const tid = String(tenantData?.tenant_id || '').toLowerCase().trim();
  const em = String(tenantData?.email || userEmail || '').toLowerCase().trim();
  const uid = String(userId || '').toLowerCase().trim();

  return (
    em === CANTINA_TARGET_EMAIL ||
    tid === CANTINA_TARGET_TENANT_ID ||
    uid === CANTINA_TARGET_TENANT_ID
  );
}`;

const newCantinaFn = `export function isCantinaEnabled(
  _tenantData?: { tenant_id?: string | null; email?: string | null } | null,
  _userEmail?: string | null,
  _userId?: string | null
): boolean {
  // Cantina liberada globalmente para todos os terreiros
  return true;
}`;

if (cantinaFeatureContent.includes(oldCantinaFn)) {
  cantinaFeatureContent = cantinaFeatureContent.replace(oldCantinaFn, newCantinaFn);
  fs.writeFileSync(cantinaFeaturePath, cantinaFeatureContent, 'utf8');
  console.log('src/lib/cantinaFeature.ts updated: Cantina enabled globally!');
} else {
  // Regex fallback
  cantinaFeatureContent = cantinaFeatureContent.replace(
    /export function isCantinaEnabled[\s\S]*?return\s*\([\s\S]*?\);\s*\}/,
    newCantinaFn
  );
  fs.writeFileSync(cantinaFeaturePath, cantinaFeatureContent, 'utf8');
  console.log('src/lib/cantinaFeature.ts updated via regex: Cantina enabled globally!');
}

// 2. Enable Cantina in backend routes
const cantinaRoutesPath = path.join(basePath, 'api/lib/cantinaRoutes.ts');
if (fs.existsSync(cantinaRoutesPath)) {
  let cantinaRoutesContent = fs.readFileSync(cantinaRoutesPath, 'utf8');
  const oldBackendAllowed = `export function isCantinaTenantAllowed(tenantId: string, email?: string | null): boolean {
  const tid = String(tenantId || "").toLowerCase().trim();
  const em = String(email || "").toLowerCase().trim();
  return em === TARGET_TEST_EMAIL || tid === TARGET_TEST_TENANT_ID;
}`;

  const newBackendAllowed = `export function isCantinaTenantAllowed(_tenantId: string, _email?: string | null): boolean {
  // Cantina liberada globalmente para todos os terreiros
  return true;
}`;

  if (cantinaRoutesContent.includes(oldBackendAllowed)) {
    cantinaRoutesContent = cantinaRoutesContent.replace(oldBackendAllowed, newBackendAllowed);
    fs.writeFileSync(cantinaRoutesPath, cantinaRoutesContent, 'utf8');
    console.log('api/lib/cantinaRoutes.ts updated: Backend cantina allowed globally!');
  } else {
    cantinaRoutesContent = cantinaRoutesContent.replace(
      /export function isCantinaTenantAllowed[\s\S]*?return\s+em === TARGET_TEST_EMAIL[\s\S]*?;\s*\}/,
      newBackendAllowed
    );
    fs.writeFileSync(cantinaRoutesPath, cantinaRoutesContent, 'utf8');
    console.log('api/lib/cantinaRoutes.ts updated via regex: Backend cantina allowed globally!');
  }
}

// 3. Keep dashboard Berry for later: set isBerryDashboardBeta to opt-in only
const featureFlagsPath = path.join(basePath, 'src/lib/featureFlags.ts');
let featureFlagsContent = fs.readFileSync(featureFlagsPath, 'utf8');

const oldBerryFlag = `export function isBerryDashboardBeta(email?: string | null, tenantId?: string | null): boolean {
  // 1. Verificação explícita do email e tenant de teste do usuário
  const normalized = (email || '').toLowerCase().trim();
  if (normalized === 'vendasmercadolivrev1@gmail.com') return true;
  if (tenantId === 'fad75b91-d2eb-4805-b5a3-c19e8a073bed') return true;`;

const newBerryFlag = `export function isBerryDashboardBeta(_email?: string | null, _tenantId?: string | null): boolean {
  // Dashboard Berry guardada para depois conforme solicitado.
  // Opt-in apenas via URL (?berry_beta=1) para inspeção pontual.`;

if (featureFlagsContent.includes(oldBerryFlag)) {
  featureFlagsContent = featureFlagsContent.replace(oldBerryFlag, newBerryFlag);
  fs.writeFileSync(featureFlagsPath, featureFlagsContent, 'utf8');
  console.log('src/lib/featureFlags.ts updated: Berry dashboard kept for later!');
}

console.log('All changes applied successfully!');
