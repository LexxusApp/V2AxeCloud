import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

await page.goto("http://127.0.0.1:3023/design-systems/axecloud-dashboard-casa-viva/", {
  waitUntil: "networkidle",
});
await page.waitForTimeout(1400);
await page.screenshot({
  path: "design-systems/axecloud-dashboard-casa-viva/dashboard-casa-viva-desktop.png",
  fullPage: false,
});

await page.setViewportSize({ width: 430, height: 932 });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1400);
await page.screenshot({
  path: "design-systems/axecloud-dashboard-casa-viva/dashboard-casa-viva-mobile.png",
  fullPage: false,
});

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(450);
await page.screenshot({
  path: "design-systems/axecloud-dashboard-casa-viva/dashboard-casa-viva-mobile-final.png",
  fullPage: false,
});

await browser.close();
