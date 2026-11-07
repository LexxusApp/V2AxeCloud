import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

await page.goto("http://127.0.0.1:3024/design-systems/axecloud-dashboard-atlas/", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(1200);
await page.screenshot({
  path: "design-systems/axecloud-dashboard-atlas/dashboard-atlas-desktop.png",
  fullPage: false,
});

await page.setViewportSize({ width: 430, height: 932 });
await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1200);
await page.screenshot({
  path: "design-systems/axecloud-dashboard-atlas/dashboard-atlas-mobile.png",
  fullPage: false,
});

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(350);
await page.screenshot({
  path: "design-systems/axecloud-dashboard-atlas/dashboard-atlas-mobile-final.png",
  fullPage: false,
});

await browser.close();
