import { chromium } from "playwright";
import fs from "fs";

const email = process.env.AXECLOUD_E2E_EMAIL?.trim();
const password = process.env.AXECLOUD_E2E_PASSWORD;
const baseUrl = "https://axecloud.com.br";

if (!email || !password) {
  throw new Error("Defina AXECLOUD_E2E_EMAIL e AXECLOUD_E2E_PASSWORD no ambiente seguro de testes.");
}

const outputDir = "artifacts/live-verify";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1024, height: 600 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.locator(".axe-login-path-dark").click();
  await page.waitForTimeout(500);

  await page.getByPlaceholder("Digite seu e-mail").fill(email);
  await page.getByPlaceholder("Digite sua senha").fill(password);
  await page.getByPlaceholder("Digite sua senha").press("Enter");
  
  // Wait until dashboard loads fully
  await page.waitForSelector('.dashboard-v5, .app-view-canvas', { timeout: 25000 });
  await page.waitForTimeout(4000);

  // 1. Capture Dashboard live
  await page.screenshot({ path: `${outputDir}/1-live-dashboard.png` });
  console.log("Captured 1-live-dashboard.png");

  // 2. Click Financeiro in sidebar
  await page.getByRole('button', { name: /Financeiro/i }).first().click();
  await page.waitForSelector('.financial-v5-page', { timeout: 20000 });
  await page.waitForTimeout(2000);

  // Capture Financial live with default sidebar state (pinned open)
  await page.screenshot({ path: `${outputDir}/2-live-financial-pinned.png` });
  console.log("Captured 2-live-financial-pinned.png");

  // 3. Click sidebar toggle button to collapse to rail
  await page.locator('.app-v5-sidebar-toggle').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outputDir}/3-live-financial-collapsed.png` });
  console.log("Captured 3-live-financial-collapsed.png");

  // 4. Hover over sidebar while collapsed - verify it DOES NOT pop out over content!
  await page.locator('.app-v5-sidebar').hover();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outputDir}/4-live-financial-hover-safe.png` });
  console.log("Captured 4-live-financial-hover-safe.png");

} finally {
  await browser.close();
}
