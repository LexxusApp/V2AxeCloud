import { chromium } from 'playwright';

const email = process.env.AXECLOUD_E2E_EMAIL?.trim();
const password = process.env.AXECLOUD_E2E_PASSWORD;

if (!email || !password) {
  throw new Error('Defina AXECLOUD_E2E_EMAIL e AXECLOUD_E2E_PASSWORD no ambiente seguro de testes.');
}

async function login(page) {
  await page.goto('https://axecloud.com.br/entrar', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard(?:[?#]|$)/, { timeout: 20_000 });
  await page.getByText(/Financeiro|Mensalidades|Giras/).first().waitFor({ state: 'visible', timeout: 20_000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await mobileCtx.newPage();
    await login(page);
    const bottomNav = page.locator('.app-v5-bottom-nav');
    await bottomNav.waitFor({ state: 'visible', timeout: 15_000 });
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.screenshot({ path: 'live-mobile-loaded-dash.png', fullPage: true });
    await bottomNav.getByRole('button', { name: 'Financeiro' }).click();
    const cantinaTab = page.getByRole('button', { name: 'Cantina' });
    await cantinaTab.waitFor({ state: 'visible', timeout: 15_000 });
    await cantinaTab.click();
    await page.screenshot({ path: 'live-mobile-cantina-tab.png', fullPage: true });
    await mobileCtx.close();

    const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const desk = await deskCtx.newPage();
    await login(desk);
    await desk.screenshot({ path: 'live-desktop-loaded-dash.png', fullPage: true });
    const cantina = desk.getByText('Cantina', { exact: true }).first();
    await cantina.waitFor({ state: 'visible', timeout: 15_000 });
    await cantina.click();
    await desk.screenshot({ path: 'live-desktop-cantina.png', fullPage: true });
    await deskCtx.close();
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
