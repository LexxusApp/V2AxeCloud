import { chromium } from "playwright";
import fs from "fs";

const email = "miriambarbosa222@yahoo.com.br";
const password = "43562600";
const baseUrl = "https://axecloud.com.br";

const outputDir = "artifacts/speed-verify";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1024, height: 600 },
});
const page = await context.newPage();

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.locator(".axe-login-path-dark").click();
  await page.waitForTimeout(500);

  await page.getByPlaceholder("Digite seu e-mail").fill(email);
  await page.getByPlaceholder("Digite sua senha").fill(password);
  await page.getByPlaceholder("Digite sua senha").press("Enter");

  await page.waitForSelector('.dashboard-v5, .app-view-canvas', { timeout: 25000 });
  await page.waitForTimeout(3000);

  // 1. Click Financeiro in sidebar
  await page.locator('.app-v5-sidebar').getByText('Financeiro', { exact: false }).first().click();
  await page.waitForSelector('.financial-v5-page', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // 2. Click "Mensalidades" submenu inside the sidebar
  await page.locator('.app-v5-sidebar').getByText('Mensalidades').first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outputDir}/1-submenu-mensalidades-selected.png` });
  console.log("Captured 1-submenu-mensalidades-selected.png");

  // 3. Click "Configurações Pix" submenu inside the sidebar
  await page.locator('.app-v5-sidebar').getByText('Configurações Pix').first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outputDir}/2-submenu-configs-selected.png` });
  console.log("Captured 2-submenu-configs-selected.png");

  // 4. Click "Início" - test speed
  const t0 = Date.now();
  await page.locator('.app-v5-sidebar').getByText('Início').first().click();
  await page.waitForSelector('.dashboard-v5, .app-view-canvas', { timeout: 15000 });
  const elapsed = Date.now() - t0;
  console.log(`Navigation to Início took: ${elapsed}ms`);
  await page.screenshot({ path: `${outputDir}/3-fast-inicio.png` });
  console.log("Captured 3-fast-inicio.png");

  // 5. Test sidebar collapse/expand toggle
  await page.locator('.app-v5-sidebar-toggle').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outputDir}/4-sidebar-instant-toggle.png` });
  console.log("Captured 4-sidebar-instant-toggle.png");

} finally {
  await browser.close();
}
