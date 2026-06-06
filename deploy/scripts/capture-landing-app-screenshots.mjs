/**
 * Captura telas iniciais (mobile) para mockups da landing Apps & PWA.
 * Uso: node deploy/scripts/capture-landing-app-screenshots.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = path.join(ROOT, 'public/screenshots');
const BASE = process.env.BASE_URL || 'https://axecloud.com.br';
const VIEWPORT = { width: 390, height: 844 };

async function dismissLegalTermsIfOpen(page) {
  const checkbox = page.locator('label').filter({ hasText: 'Li e aceito os Termos' }).locator('input[type="checkbox"]');
  if (await checkbox.isVisible().catch(() => false)) {
    await checkbox.check({ force: true });
    await page.getByRole('button', { name: 'Aceitar e continuar' }).click();
    await page.waitForTimeout(800);
  }
}

async function waitForAppReady(page) {
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.locator('.animate-spin').first().waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
}

async function captureFilho(browser) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    locale: 'pt-BR',
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /login filho/i }).click();
  await page.getByRole('textbox', { name: 'Ex.: 2E6B' }).fill('352B');
  await page.getByRole('textbox', { name: 'Ex.: 123456' }).fill('419385');
  await page.getByRole('button', { name: /^Entrar$/i }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 60000 });
  await waitForAppReady(page);
  await dismissLegalTermsIfOpen(page);

  await page.screenshot({
    path: path.join(OUT_DIR, 'portal-filho-home.png'),
    fullPage: false,
  });
  console.log('[ok] portal-filho-home.png');
  await context.close();
}

async function captureZelador(browser) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    locale: 'pt-BR',
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Digite seu e-mail').fill('terreiro1@axecloud.com');
  await page.getByPlaceholder('Digite sua senha').fill('43562600');
  await page.getByRole('button', { name: /^Entrar$/i }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 60000 });
  await waitForAppReady(page);
  await dismissLegalTermsIfOpen(page);

  await page.screenshot({
    path: path.join(OUT_DIR, 'painel-zelador-home.png'),
    fullPage: false,
  });
  console.log('[ok] painel-zelador-home.png');
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await captureFilho(browser);
  await captureZelador(browser);
} finally {
  await browser.close();
}
