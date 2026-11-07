import { chromium } from "playwright";
import fs from "fs";

const email = "miriambarbosa222@yahoo.com.br";
const password = "43562600";
const baseUrl = "https://axecloud.com.br";

const outputDir = "artifacts/uniform-verify";
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

  // 1. Capture Dashboard live
  await page.screenshot({ path: `${outputDir}/1-dashboard-live.png` });
  console.log("Captured 1-dashboard-live.png");

  // 2. Click Financeiro in sidebar
  await page.locator('.app-v5-sidebar').getByText('Financeiro').first().click();
  await page.waitForSelector('.financial-v5-page', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // 3. Capture Financeiro live
  await page.screenshot({ path: `${outputDir}/2-financeiro-live.png` });
  console.log("Captured 2-financeiro-live.png");

  // 4. Return to Dashboard live
  await page.locator('.app-v5-sidebar').getByText('Início').first().click();
  await page.waitForSelector('.dashboard-v5, .app-view-canvas', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // 5. Capture Dashboard again live
  await page.screenshot({ path: `${outputDir}/3-dashboard-returned.png` });
  console.log("Captured 3-dashboard-returned.png");

} finally {
  await browser.close();
}
