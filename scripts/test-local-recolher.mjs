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

  // 2. Click Financeiro
  const finGroup = page.locator('.app-v5-sidebar button:has-text("Financeiro")').first();
  if (await finGroup.count()) {
    console.log("Clicking Financeiro group...");
    await finGroup.click();
    await page.waitForTimeout(1000);
  }

  // Check Recolher elements
  const recolherAfter = await page.locator('[aria-label*="Recolher"], [title*="Recolher"]').all();
  console.log("After opening Financeiro, Recolher elements:", recolherAfter.length);
  for (const el of recolherAfter) {
    const title = await el.getAttribute("title");
    const aria = await el.getAttribute("aria-label");
    const text = await el.innerText();
    console.log(`- Tag: ${await el.evaluate(e => e.tagName)}, title: "${title}", aria: "${aria}", text: "${text.trim()}"`);
  }

  // Try clicking the toggle button to "Recolher Financeiro" in the sidebar
  const recolherFin = page.locator('.app-v5-sidebar button[aria-label="Recolher Financeiro"]').first();
  if (await recolherFin.count()) {
    console.log("Clicking .app-v5-sidebar button[aria-label='Recolher Financeiro']...");
    await recolherFin.click();
    await page.waitForTimeout(1000);
    const stillExpandedInSidebar = await page.locator('.app-v5-sidebar button[aria-label="Recolher Financeiro"]').count();
    console.log("Still has 'Recolher Financeiro' in sidebar after click (did it collapse?):", stillExpandedInSidebar === 0 ? "YES COLLAPSED!" : "NO STILL EXPANDED");
  } else {
    console.log("Could not find button[aria-label='Recolher Financeiro'] in sidebar");
  }

  // Also test clicking "Expandir Financeiro" in sidebar to see if it re-expands
  const expandFin = page.locator('.app-v5-sidebar button[aria-label="Expandir Financeiro"]').first();
  if (await expandFin.count()) {
    console.log("Clicking .app-v5-sidebar button[aria-label='Expandir Financeiro'] to re-expand...");
    await expandFin.click();
    await page.waitForTimeout(1000);
    const reExpanded = await page.locator('.app-v5-sidebar button[aria-label="Recolher Financeiro"]').count();
    console.log("Has 'Recolher Financeiro' in sidebar after re-expand click:", reExpanded > 0 ? "YES RE-EXPANDED!" : "NO");
  }

  // Test the sidebar collapse/expand toggle
  const sidebarToggle = page.locator('.app-v5-sidebar-toggle').first();
  console.log("Clicking main sidebar toggle to collapse...");
  await sidebarToggle.click();
  await page.waitForTimeout(1000);
  const widthCollapsed = await page.evaluate(() => document.querySelector('.app-v5-sidebar')?.getBoundingClientRect().width);
  console.log("Sidebar width collapsed:", widthCollapsed);

  console.log("Clicking main sidebar toggle to expand back...");
  await sidebarToggle.click();
  await page.waitForTimeout(1000);
  const widthExpanded = await page.evaluate(() => document.querySelector('.app-v5-sidebar')?.getBoundingClientRect().width);
  console.log("Sidebar width expanded:", widthExpanded);

} finally {
  await browser.close();
}
