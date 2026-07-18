/**
 * Captura telas do AxéCloud para o tour da landing.
 * Requer `npm run dev` na raiz (http://localhost:3000).
 *
 * PowerShell:
 *   $env:AXE_TEST_EMAIL="email@exemplo.com"
 *   $env:AXE_TEST_PASSWORD="senha"
 *   node scripts/capture-axecloud.mjs
 *
 * Após capturar: bump `LANDING_SCREENSHOT_VERSION` em src/constants/landingScreenshots.ts
 */
import { chromium } from 'playwright';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dir, '..');
const outDir = resolve(rootDir, 'public/screenshots');
const base = process.env.AXE_DEV_URL || 'http://localhost:3000/';
const loginUrl = base.replace(/\/?$/, '/login');

const email = process.env.AXE_TEST_EMAIL?.trim() || '';
const pass = process.env.AXE_TEST_PASSWORD || '';

const LOGADO = [
  { name: 'Dashboard', file: 'painel-inicio.png' },
  { name: 'Membros', file: 'filhos-de-santo.png' },
  { name: 'Giras / Eventos', file: 'calendario-eventos.png' },
  { name: 'Comunicados', file: 'mural.png' },
  { name: 'Galeria', file: 'galeria.png' },
  { name: 'Financeiro', file: 'financeiro.png' },
  { name: 'Biblioteca de Estudo', file: 'biblioteca-estudo.png' },
  { name: 'Loja do Axé', file: 'loja-axe.png' },
];

async function dismissLegalTermsIfOpen(page) {
  const overlay = page.locator('[data-state="open"].fixed.inset-0.z-\\[300\\]');
  const visible = await overlay.isVisible().catch(() => false);
  if (!visible) return;
  const checkbox = page.locator('label').filter({ hasText: 'Li e aceito os Termos' }).locator('input[type="checkbox"]');
  await checkbox.check({ force: true });
  await page.getByRole('button', { name: 'Aceitar e continuar' }).click();
  await overlay.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(800);
}
async function gotoLogin(page) {
  const res = await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (!res?.ok() && (res?.status() ?? 0) >= 400) {
    throw new Error(`HTTP ${res?.status()} ao abrir ${loginUrl}`);
  }
  await page.getByPlaceholder('Digite seu e-mail').waitFor({ state: 'visible', timeout: 60_000 });
}

async function shotPublicDesktop(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoLogin(page);
  await page.screenshot({ path: join(outDir, 'tela-acesso-axecloud.png'), type: 'png' });
  try {
    await page.locator('form').first().screenshot({ path: join(outDir, 'formulario-de-acesso.png') });
  } catch {
    console.warn('[capture] aviso: crop do formulário falhou');
  }
}

async function shotPublicMobile(browser) {
  const m = await browser.newPage({ viewport: { width: 420, height: 820 } });
  await gotoLogin(m);
  await m.screenshot({ path: join(outDir, 'acesso-celular.png'), type: 'png' });
  await m.close();
}

const browser = await chromium.launch();
try {
  await mkdir(outDir, { recursive: true });
  const page = await browser.newPage();
  let lastDialog = '';
  const onDialog = async (d) => {
    lastDialog = d.message();
    try {
      await d.accept();
    } catch {
      // ignorado
    }
  };
  page.on('dialog', onDialog);

  if (!email || !pass) {
    await shotPublicDesktop(page);
    await shotPublicMobile(browser);
    await page.close();
  } else {
    await shotPublicDesktop(page);
    await shotPublicMobile(browser);

    lastDialog = '';
    await page.getByPlaceholder('Digite seu e-mail').fill(email);
    await page.getByPlaceholder('Digite sua senha').fill(pass);
    await page.getByRole('button', { name: /^Entrar$/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 120_000 });
    await page.locator('aside button').filter({ hasText: 'Dashboard' }).first().waitFor({ state: 'visible', timeout: 120_000 });
    await page.waitForTimeout(2000);
    await dismissLegalTermsIfOpen(page);

    for (const t of LOGADO) {
      lastDialog = '';
      if (t.name !== 'Dashboard') {
        await dismissLegalTermsIfOpen(page);
        await page.locator('aside button').filter({ hasText: t.name }).first().click({ timeout: 15_000 });
      }
      await page.waitForTimeout(400);
      if (/exclusivo|não está disponível|não está dispon|plano|Plano|recurso/i.test(lastDialog)) {
        console.warn(`[capture] módulo indisponível no plano: ${t.name} — ${lastDialog.slice(0, 100)}`);
        lastDialog = '';
        continue;
      }
      lastDialog = '';
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(2000);
      await page.screenshot({ path: join(outDir, t.file), type: 'png' });
      console.log(`[capture] ${t.file} OK`);
    }
    await page.close();
  }

  await browser.close();

  const files = [
    'tela-acesso-axecloud.png',
    'acesso-celular.png',
    'formulario-de-acesso.png',
    ...LOGADO.map((l) => l.file),
  ];
  for (const f of files) {
    try {
      const s = await stat(join(outDir, f));
      console.log(`[capture] ${f} — ${(s.size / 1024).toFixed(1)} KB`);
    } catch {
      // não gerado
    }
  }

} catch (e) {
  try {
    await browser.close();
  } catch {
    // ignorado
  }
  console.error(e);
  process.exit(1);
}
