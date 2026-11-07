import { chromium } from "playwright";
import fs from "fs";

const email = "miriambarbosa222@yahoo.com.br";
const password = "43562600";
const baseUrl = "https://axecloud.com.br";

const outputDir = "artifacts/zoom-verify/all-views";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1007, height: 600 } });

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.locator(".axe-login-path-dark").click();
  await page.waitForTimeout(500);

  await page.getByPlaceholder("Digite seu e-mail").fill(email);
  await page.getByPlaceholder("Digite sua senha").fill(password);
  await page.getByPlaceholder("Digite sua senha").press("Enter");
  await page.waitForSelector('.dashboard-v5', { timeout: 20000 });
  await page.waitForTimeout(2000);

  const tabs = ['children', 'calendar', 'inventory', 'settings'];
  for (const tab of tabs) {
    await page.evaluate((t) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(btn => (btn.getAttribute('title') || '').toLowerCase().includes(t) || (btn.getAttribute('aria-label') || '').toLowerCase().includes(t));
      if (b) b.click();
    }, tab);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${outputDir}/${tab}-100.png` });
  }

  console.log("Captured all views at 100%");
} finally {
  await browser.close();
}
