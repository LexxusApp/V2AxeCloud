import playwright from 'file:///C:/Users/Lucas%20A/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js';

const { chromium } = playwright;
const email = process.env.AXECLOUD_CAPTURE_EMAIL;
const password = process.env.AXECLOUD_CAPTURE_PASSWORD;
const baseUrl = process.env.AXECLOUD_CAPTURE_BASE_URL || 'http://localhost:3000';
const desktopWidth = Number(process.env.AXECLOUD_CAPTURE_WIDTH || 1536);
const desktopHeight = Number(process.env.AXECLOUD_CAPTURE_HEIGHT || 864);
const desktopOutput = process.env.AXECLOUD_CAPTURE_OUTPUT || 'artifacts/dashboard-command-desktop.png';
if (!email || !password) throw new Error('Credenciais de captura ausentes.');

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});
const context = await browser.newContext({ viewport: { width: desktopWidth, height: desktopHeight }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1800);
const leaderEntry = page.locator('.axe-login-path-dark').first();
if (!(await page.getByPlaceholder(/digite seu e-mail/i).count()) && await leaderEntry.count()) {
  await leaderEntry.click();
  await page.getByPlaceholder(/digite seu e-mail/i).waitFor({ state: 'visible', timeout: 10000 });
}
const emailInput = page.getByPlaceholder(/digite seu e-mail/i).first();
if (await emailInput.count()) {
  await emailInput.fill(email);
  const passwordInput = page.getByPlaceholder(/digite sua senha/i).first();
  await passwordInput.fill(password);
  const submit = page.getByRole('button', { name: /entrar como zelador/i }).first();
  if (await submit.count()) await submit.click(); else await passwordInput.press('Enter');
  await page.waitForTimeout(6000);
}
if (!page.url().includes('/dashboard')) await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(7000);
await page.screenshot({ path: desktopOutput, fullPage: false });
const desktop = {
  hero: await page.locator('.command-journey').count(),
  gira: await page.locator('.command-gira').count(),
  preceito: await page.locator('.preceito-command-art').count(),
  title: await page.locator('#dashboard-command-title').textContent({ timeout: 10000 }),
};
await page.setViewportSize({ width: 592, height: 1280 });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'artifacts/dashboard-command-mobile.png', fullPage: false });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log(JSON.stringify({ url: page.url(), desktop, horizontalOverflow: overflow, errors: errors.slice(-10) }));
await context.close();
await browser.close();
