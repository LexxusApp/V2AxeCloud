/**
 * Captura screenshot da dashboard para a seção estática da landing.
 * Uso: node scripts/capture-dashboard-landing.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/screenshots');
const LANDING_OUT = join(ROOT, 'landing/public/screenshots');
const BASE = process.env.BASE_URL || 'https://axecloud.com.br';
const EMAIL = process.env.AXE_TEST_EMAIL?.trim() || '';
const PASS = process.env.AXE_TEST_PASSWORD || '';

if (!EMAIL || !PASS) {
  console.error('[capture] Defina AXE_TEST_EMAIL e AXE_TEST_PASSWORD');
  process.exit(1);
}
const FILE = 'painel-dashboard-landing.png';

async function dismissLegalTermsIfOpen(page) {
  const checkbox = page
    .locator('label')
    .filter({ hasText: 'Li e aceito os Termos' })
    .locator('input[type="checkbox"]');
  if (await checkbox.isVisible().catch(() => false)) {
    await checkbox.check({ force: true });
    await page.getByRole('button', { name: 'Aceitar e continuar' }).click();
    await page.waitForTimeout(800);
  }
}

await mkdir(OUT, { recursive: true });
await mkdir(LANDING_OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'pt-BR',
});

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByPlaceholder('Digite seu e-mail').fill(EMAIL);
  await page.getByPlaceholder('Digite sua senha').fill(PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 120_000 });
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await dismissLegalTermsIfOpen(page);
  await page.locator('.animate-spin').first().waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
  await page
    .locator('main, [role="main"], .dashboard, h1')
    .first()
    .waitFor({ state: 'visible', timeout: 60_000 })
    .catch(() => {});
  await page.waitForTimeout(2000);

  await page.screenshot({ path: join(OUT, FILE), type: 'png' });
  await page.screenshot({ path: join(LANDING_OUT, FILE), type: 'png' });
  console.log(`[ok] ${FILE}`);
} finally {
  await browser.close();
}
