import { chromium } from "playwright";
import fs from "fs";

const email = "miriambarbosa222@yahoo.com.br";
const password = "43562600";
const baseUrl = "https://axecloud.com.br";

const outputDir = "artifacts/sharp-verify";
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
  await page.waitForTimeout(6000);

  // Navigate to Financial
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const finBtn = btns.find(b => (b.getAttribute('title') || '').includes('Financeiro'));
    if (finBtn) finBtn.click();
  });
  await page.waitForSelector('.financial-v5-page', { timeout: 20000 });
  await page.waitForTimeout(2000);

  // Apply font-size: 13.5px and NO zoom!
  await page.evaluate(() => {
    // Remove any zoom
    document.querySelectorAll('*').forEach(el => {
      if (el.style && el.style.zoom) el.style.zoom = '';
    });
    document.documentElement.style.zoom = '';

    const style = document.createElement('style');
    style.id = 'sharp-test-style';
    style.innerHTML = `
      html:has(.app-v3) {
        font-size: 13.5px !important;
      }
      .app-page-shell {
        zoom: normal !important;
      }
      .app-editorial-header {
        flex-direction: row !important;
        align-items: flex-end !important;
      }
      .app-v5-identity .context-action > button {
        flex-shrink: 0 !important;
      }
      .app-v5-identity .context-action__copy {
        min-width: 0 !important;
        flex: 1 1 auto !important;
      }
      .app-v5-identity .context-action__copy > span {
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
      /* Metric cards slightly tighter min-height to match 90% */
      .financial-v5-page .app-metric-rail > div {
        min-height: 106px !important;
        padding-top: 0.75rem !important;
        padding-bottom: 0.75rem !important;
      }
    `;
    document.head.appendChild(style);
  });
  await page.waitForTimeout(1000);

  // 1. Financial screenshot with collapsed sidebar
  await page.screenshot({ path: `${outputDir}/1-financial-sharp-compact.png` });
  console.log("Captured 1-financial-sharp-compact.png");

  // 2. Financial screenshot with EXPANDED sidebar (hover/pin)
  await page.evaluate(() => {
    const sidebar = document.querySelector('.app-v5-sidebar');
    if (sidebar) {
      sidebar.setAttribute('data-expanded', 'true');
      sidebar.classList.remove('w-60');
      sidebar.style.width = '15rem';
    }
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outputDir}/2-financial-sharp-expanded.png` });
  console.log("Captured 2-financial-sharp-expanded.png");

  // 3. Dashboard screenshot
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const dashBtn = btns.find(b => (b.getAttribute('aria-label') || '').includes('início') || (b.getAttribute('title') || '').includes('Início') || (b.getAttribute('title') || '').includes('Visão'));
    if (dashBtn) dashBtn.click();
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outputDir}/3-dashboard-sharp.png` });
  console.log("Captured 3-dashboard-sharp.png");

} finally {
  await browser.close();
}
