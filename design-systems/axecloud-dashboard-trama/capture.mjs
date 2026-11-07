import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

await page.goto("http://127.0.0.1:3022/design-systems/axecloud-dashboard-trama/", {
  waitUntil: "networkidle",
});
await page.screenshot({
  path: "design-systems/axecloud-dashboard-trama/dashboard-trama-desktop.png",
  fullPage: false,
});

await page.setViewportSize({ width: 430, height: 932 });
await page.reload({ waitUntil: "networkidle" });
await page.screenshot({
  path: "design-systems/axecloud-dashboard-trama/dashboard-trama-mobile.png",
  fullPage: false,
});

await browser.close();
