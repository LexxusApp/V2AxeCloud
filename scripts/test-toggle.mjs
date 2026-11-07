import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 600 } });
await page.goto("https://axecloud.com.br/login", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.locator(".axe-login-path-dark").click();
await page.waitForTimeout(500);
await page.getByPlaceholder("Digite seu e-mail").fill("miriambarbosa222@yahoo.com.br");
await page.getByPlaceholder("Digite sua senha").fill("43562600");
await page.getByPlaceholder("Digite sua senha").press("Enter");
await page.waitForTimeout(6000);

// Navigate to Financial
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const finBtn = btns.find(b => (b.getAttribute('title') || '').includes('Financeiro'));
  if (finBtn) finBtn.click();
});
await page.waitForSelector('.financial-v5-page', { timeout: 20000 });
await page.waitForTimeout(2000);

// Screenshot before toggle
await page.screenshot({ path: "artifacts/sidebar-fix/financial-before-toggle.png" });

// Click toggle button to pin/expand sidebar
await page.locator(".app-v5-sidebar-toggle").click();
await page.waitForTimeout(1000);
await page.screenshot({ path: "artifacts/sidebar-fix/financial-after-toggle.png" });

await browser.close();
console.log("Done toggle test");
