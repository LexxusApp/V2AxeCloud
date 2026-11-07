import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });

// 1. Desktop Viewport
console.log("Capturing Desktop 1440x900...");
const desktopPage = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.5,
});

await desktopPage.goto("http://127.0.0.1:3024/design-systems/axecloud-dashboard-soberano/", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await desktopPage.waitForTimeout(1200);

await desktopPage.screenshot({
  path: "design-systems/axecloud-dashboard-soberano/dashboard-soberano-desktop.png",
  fullPage: false,
});
await desktopPage.screenshot({
  path: "artifacts/dashboard-soberano-desktop.png",
  fullPage: false,
});
await desktopPage.screenshot({
  path: "design-systems/axecloud-dashboard-soberano/dashboard-soberano-desktop-full.png",
  fullPage: true,
});
await desktopPage.close();

// 2. Mobile Viewport (430x932)
console.log("Capturing Mobile 430x932...");
const mobilePage = await browser.newPage({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
});

await mobilePage.goto("http://127.0.0.1:3024/design-systems/axecloud-dashboard-soberano/", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await mobilePage.waitForTimeout(1200);

await mobilePage.screenshot({
  path: "design-systems/axecloud-dashboard-soberano/dashboard-soberano-mobile.png",
  fullPage: false,
});
await mobilePage.screenshot({
  path: "artifacts/dashboard-soberano-mobile.png",
  fullPage: false,
});

// Mobile scroll fold
await mobilePage.evaluate(() => window.scrollBy(0, 750));
await mobilePage.waitForTimeout(500);

await mobilePage.screenshot({
  path: "design-systems/axecloud-dashboard-soberano/dashboard-soberano-mobile-final.png",
  fullPage: false,
});
await mobilePage.screenshot({
  path: "artifacts/dashboard-soberano-mobile-final.png",
  fullPage: false,
});

await mobilePage.close();

console.log("All screenshots (Desktop & Mobile) captured successfully!");
await browser.close();
