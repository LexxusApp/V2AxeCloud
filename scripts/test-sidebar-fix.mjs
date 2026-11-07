import { chromium } from "playwright";
import fs from "fs";

const email = "miriambarbosa222@yahoo.com.br";
const password = "43562600";
const baseUrl = "https://axecloud.com.br";

const outputDir = "artifacts/sidebar-fix";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 600 } });

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

  // Inject the proposed clean styling (no transforms on sidebar, crisp fonts, width synchronization)
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'sidebar-fix-style';
    style.innerHTML = `
      html:has(.app-page-shell:not([data-tab="dashboard"])) {
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
      .financial-v5-page .app-metric-rail > div {
        min-height: 106px !important;
        padding-top: 0.75rem !important;
        padding-bottom: 0.75rem !important;
      }

      /* Clean sidebar fix: NO 3D transform, native layer rendering, sharp text */
      @media (min-width: 880px) {
        .app-v5-sidebar {
          transform: none !important;
          backface-visibility: visible !important;
          will-change: auto !important;
          -webkit-font-smoothing: subpixel-antialiased !important;
          -moz-osx-font-smoothing: auto !important;
          text-rendering: optimizeLegibility !important;
          transition: width 200ms cubic-bezier(0.2, 0, 0, 1) !important;
          box-shadow: 1px 0 0 rgba(255, 255, 255, 0.05) !important;
        }
        .app-v5-sidebar[data-expanded='true'] {
          width: 15rem !important;
          transform: none !important;
        }
        .app-v5-sidebar[data-expanded='false'] {
          width: 4.75rem !important;
          transform: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  });
  await page.waitForTimeout(500);

  // 1. PINNED / EXPANDED TEST
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-sidebar-width', '15rem');
    const sidebar = document.querySelector('.app-v5-sidebar');
    if (sidebar) {
      sidebar.setAttribute('data-expanded', 'true');
      sidebar.style.width = '15rem';
    }
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outputDir}/1-financial-pinned-expanded.png` });
  console.log("Captured 1-financial-pinned-expanded.png");

  // 2. COLLAPSED / RAIL TEST
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-sidebar-width', '4.75rem');
    const sidebar = document.querySelector('.app-v5-sidebar');
    if (sidebar) {
      sidebar.setAttribute('data-expanded', 'false');
      sidebar.style.width = '4.75rem';
    }
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outputDir}/2-financial-collapsed-rail.png` });
  console.log("Captured 2-financial-collapsed-rail.png");

  // 3. DASHBOARD TEST (Verify dashboard remains untouched)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const dashBtn = btns.find(b => (b.getAttribute('aria-label') || '').includes('início') || (b.getAttribute('title') || '').includes('Início') || (b.getAttribute('title') || '').includes('Visão'));
    if (dashBtn) dashBtn.click();
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outputDir}/3-dashboard.png` });
  console.log("Captured 3-dashboard.png");

} finally {
  await browser.close();
}
