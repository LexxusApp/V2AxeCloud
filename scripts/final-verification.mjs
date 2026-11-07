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
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const desk = await deskCtx.newPage();
    await login(desk);
    await desk.screenshot({ path: 'final-prod-desktop.png', fullPage: true });
    await deskCtx.close();

    const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const mobile = await mobileCtx.newPage();
    await login(mobile);
    await mobile.screenshot({ path: 'final-prod-mobile.png', fullPage: true });
    await mobileCtx.close();
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
