/**
 * Testa o menu mobile do AppTopNav — evita nav desktop + portais no celular (corrupção GPU).
 * Uso: node scripts/test-mobile-topnav.mjs [BASE_URL]
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const baseUrl = process.argv[2] || process.env.BASE_URL || 'http://127.0.0.1:4173';

function assertSourceGuards() {
  const source = readFileSync(join(root, 'src/components/app/AppTopNav.tsx'), 'utf8');
  const checks = [
    ['useMediaQuery', 'hook de media query'],
    ['isLgDesktop', 'guard de desktop'],
    ['isLgDesktop ? (', 'nav desktop condicional'],
    ['lg:hidden', 'menu mobile exclusivo'],
    ['fixed inset-0 z-[60]', 'backdrop mobile sem blur'],
    ['fixed left-0 top-0 bottom-0 z-[70]', 'drawer lateral mobile'],
    ['min-h-[48px]', 'alvos de toque amplos no drawer'],
    ['layout="drawer"', 'itens do menu lateral'],
  ];
  for (const [needle, label] of checks) {
    if (!source.includes(needle)) {
      throw new Error(`AppTopNav sem ${label}: "${needle}"`);
    }
  }
  if (source.includes('BodyPortal')) {
    throw new Error('AppTopNav ainda usa BodyPortal (risco de corrupção GPU no mobile)');
  }
  console.log('OK   verificação estática do AppTopNav');
}

async function runBrowserChecks() {
  const pixel = devices['Pixel 5'];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...pixel,
    locale: 'pt-BR',
  });
  const page = await context.newPage();

  try {
    const response = await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!response || response.status() >= 500) {
      throw new Error(`/login indisponível em ${baseUrl} (HTTP ${response?.status() ?? 'n/a'})`);
    }

    const bodyMenus = await page.locator('body > div[role="menu"]').count();
    if (bodyMenus > 0) {
      throw new Error(`Encontrados ${bodyMenus} menu(s) fixo(s) em body no mobile (esperado 0)`);
    }
    console.log('OK   sem menus fixos soltos em body (mobile /login)');

    const desktopTablists = await page.locator('[role="tablist"]:not(.lg\\:hidden)').count();
    const hiddenDesktopNav = await page.locator('.lg\\:hidden [role="tablist"]').count();
    console.log(`OK   /login mobile — tablists visíveis: ${desktopTablists}, mobile-only: ${hiddenDesktopNav}`);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const desktopMenusOnBody = await page.locator('body > div[role="menu"]').count();
    if (desktopMenusOnBody > 0) {
      throw new Error(`Menus em body no desktop antes de interação: ${desktopMenusOnBody}`);
    }
    console.log('OK   desktop /login sem menus fantasmas em body');
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log(`=== Teste mobile nav (${baseUrl}) ===`);
  assertSourceGuards();
  await runBrowserChecks();
  console.log('=== Teste mobile nav OK ===');
}

main().catch((err) => {
  console.error('FAIL', err.message || err);
  process.exit(1);
});
