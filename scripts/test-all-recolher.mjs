import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  await page.goto("https://axecloud.com.br/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.locator(".axe-login-path-dark").click();
  await page.waitForTimeout(500);
  await page.getByPlaceholder("Digite seu e-mail").fill("miriambarbosa222@yahoo.com.br");
  await page.getByPlaceholder("Digite sua senha").fill("43562600");
  await page.getByPlaceholder("Digite sua senha").press("Enter");
  await page.waitForTimeout(5000);

  // 1. Check sidebar toggle button on dashboard
  const toggleBtn = page.locator(".app-v5-sidebar-toggle");
  console.log("Toggle button title:", await toggleBtn.getAttribute("title"));
  console.log("Toggle button aria-label:", await toggleBtn.getAttribute("aria-label"));

  // 2. Look at all buttons in the sidebar that say "Recolher"
  const recolherElements = await page.locator('[aria-label*="Recolher"], [title*="Recolher"]').all();
  console.log("Found Recolher elements:", recolherElements.length);
  for (const el of recolherElements) {
    const title = await el.getAttribute("title");
    const aria = await el.getAttribute("aria-label");
    const text = await el.innerText();
    console.log(`- Tag: ${await el.evaluate(e => e.tagName)}, title: "${title}", aria: "${aria}", text: "${text.trim()}"`);
  }

  // 3. Navigate to Financeiro
  const finGroup = page.locator('.app-v5-sidebar button:has-text("Financeiro")').first();
  if (await finGroup.count()) {
    console.log("Clicking Financeiro group...");
    await finGroup.click();
    await page.waitForTimeout(2000);
  }

  // Check Recolher elements again
  const recolherAfter = await page.locator('[aria-label*="Recolher"], [title*="Recolher"]').all();
  console.log("After opening Financeiro, Recolher elements:", recolherAfter.length);
  for (const el of recolherAfter) {
    const title = await el.getAttribute("title");
    const aria = await el.getAttribute("aria-label");
    const text = await el.innerText();
    console.log(`- Tag: ${await el.evaluate(e => e.tagName)}, title: "${title}", aria: "${aria}", text: "${text.trim()}"`);
  }

  // Try clicking "Recolher Financeiro"
  const recolherFin = page.locator('[aria-label="Recolher Financeiro"]').first();
  if (await recolherFin.count()) {
    console.log("Clicking 'Recolher Financeiro'...");
    await recolherFin.click();
    await page.waitForTimeout(1000);
    const stillExpanded = await page.locator('[aria-label="Recolher Financeiro"]').count();
    console.log("Still has 'Recolher Financeiro' after click (did it collapse?):", stillExpanded === 0 ? "YES COLLAPSED" : "NO STILL EXPANDED");
  }

  // Try clicking sidebar toggle "Recolher menu"
  const recolherMenu = page.locator('.app-v5-sidebar-toggle').first();
  if (await recolherMenu.count()) {
    console.log("Clicking sidebar toggle to recolher...");
    await recolherMenu.click();
    await page.waitForTimeout(1000);
    const width = await page.evaluate(() => document.querySelector('.app-v5-sidebar')?.getBoundingClientRect().width);
    console.log("Sidebar width after toggle click:", width);
  }

} finally {
  await browser.close();
}
