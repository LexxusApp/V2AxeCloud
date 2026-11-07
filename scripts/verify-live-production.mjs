import path from 'path';
import { chromium } from 'playwright';

const artifactDir = 'C:/Users/Lucas A/.gemini/antigravity/brain/9d158178-6619-41e8-8027-3b042f4c880d';
const email = process.env.AXECLOUD_E2E_EMAIL?.trim();
const password = process.env.AXECLOUD_E2E_PASSWORD;

if (!email || !password) {
  throw new Error('Defina AXECLOUD_E2E_EMAIL e AXECLOUD_E2E_PASSWORD no ambiente seguro de testes.');
}

async function testLiveProduction() {
  console.log('--- TESTING LIVE PRODUCTION: https://axecloud.com.br/entrar ---');
  const browser = await chromium.launch();
  
  // 1. Test Mobile Production View
  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobilePage = await mobileCtx.newPage();

  await mobilePage.goto('https://axecloud.com.br/entrar', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await mobilePage.waitForTimeout(1500);

  const emailInput = await mobilePage.waitForSelector('input[type="email"], input[placeholder*="email" i]');
  const passInput = await mobilePage.waitForSelector('input[type="password"]');
  await emailInput.fill(email);
  await passInput.fill(password);
  const submitBtn = await mobilePage.waitForSelector('button[type="submit"], button:has-text("Entrar")');
  await submitBtn.click();

  await mobilePage.waitForURL((url) => url.toString().includes('/dashboard'), { timeout: 20000 });
  console.log('Logged into LIVE production on mobile! URL:', mobilePage.url());
  await mobilePage.waitForTimeout(2000);

  const mobileMetrics = await mobilePage.evaluate(() => {
    const sb = document.querySelector('.app-sidebar');
    const chip = document.querySelector('.profile-chip-container');
    return {
      docW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
      hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      chipRect: chip ? chip.getBoundingClientRect() : null,
      sidebarVisible: sb ? window.getComputedStyle(sb).display !== 'none' : false
    };
  });
  console.log('Live Mobile metrics:', mobileMetrics);
  await mobilePage.screenshot({ path: path.join(artifactDir, 'live-prod-mobile-dashboard.png') });

  // Test Mobile drawer
  await mobilePage.click('#sidebar-toggle-btn');
  await mobilePage.waitForTimeout(400);
  await mobilePage.screenshot({ path: path.join(artifactDir, 'live-prod-mobile-drawer.png') });

  // Close drawer
  await mobilePage.mouse.click(370, 200);
  await mobilePage.waitForTimeout(300);

  // Test Popover
  await mobilePage.click('#profile-chip-btn');
  await mobilePage.waitForTimeout(400);
  const popoverText = await mobilePage.evaluate(() => {
    const dd = document.querySelector('#profile-dropdown');
    return dd ? {
      title: dd.querySelector('.plan-card-title')?.textContent,
      desc: dd.querySelector('.plan-card-desc')?.textContent
    } : null;
  });
  console.log('Live Mobile popover:', popoverText);
  await mobilePage.screenshot({ path: path.join(artifactDir, 'live-prod-mobile-popover.png') });
  await mobileCtx.close();

  // 2. Test Desktop Production View
  const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktopCtx.newPage();

  await desktopPage.goto('https://axecloud.com.br/entrar', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await desktopPage.waitForTimeout(1000);
  await (await desktopPage.waitForSelector('input[type="email"]')).fill(email);
  await (await desktopPage.waitForSelector('input[type="password"]')).fill(password);
  await (await desktopPage.waitForSelector('button[type="submit"]')).click();
  await desktopPage.waitForURL((url) => url.toString().includes('/dashboard'), { timeout: 20000 });
  await desktopPage.waitForTimeout(2000);

  const desktopMetrics = await desktopPage.evaluate(() => {
    return {
      docW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
      hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });
  console.log('Live Desktop metrics:', desktopMetrics);
  await desktopPage.screenshot({ path: path.join(artifactDir, 'live-prod-desktop-dashboard.png') });

  await desktopCtx.close();
  await browser.close();
  console.log('--- LIVE PRODUCTION SANITY CHECK COMPLETE ---');
}

testLiveProduction().catch(console.error);
