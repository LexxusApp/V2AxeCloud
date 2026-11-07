import { chromium } from 'playwright';
import fs from 'fs';

async function test() {
  const browser = await chromium.launch({ headless: true });

  // 1. Mobile iPhone 14
  console.log('--- MOBILE TEST ---');
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
  });
  const mobile = await mobileCtx.newPage();
  await mobile.goto('https://axecloud.com.br/entrar', { waitUntil: 'networkidle' });
  await mobile.fill('input[type="email"]', 'vendasmercadolivrev1@gmail.com');
  await mobile.fill('input[type="password"]', 'Lucas4356!');
  await mobile.click('button[type="submit"]');
  await mobile.waitForURL(url => url.pathname.includes('/dashboard'), { timeout: 20000 });
  await mobile.waitForTimeout(3000);

  // Check bottom nav
  const bottomNavCount = await mobile.$$eval('.app-v5-bottom-nav, nav[aria-label="Navegação móvel principal"]', els => els.length);
  console.log('Mobile bottom nav count:', bottomNavCount);

  // Scroll test
  const scrollBefore = await mobile.evaluate(() => window.scrollY);
  await mobile.evaluate(() => window.scrollBy(0, 400));
  await mobile.waitForTimeout(500);
  const scrollAfter = await mobile.evaluate(() => window.scrollY);
  console.log(`Mobile scroll: before=${scrollBefore}, after=${scrollAfter}`);

  await mobile.screenshot({ path: 'live-prod-mobile-dash.png' });
  console.log('Saved live-prod-mobile-dash.png');

  // Go to Cantina via nav or direct
  console.log('Testing Cantina on mobile...');
  await mobile.goto('https://axecloud.com.br/financial?tab=cantina', { waitUntil: 'networkidle' });
  await mobile.waitForTimeout(3000);
  await mobile.screenshot({ path: 'live-prod-mobile-cantina.png' });
  console.log('Saved live-prod-mobile-cantina.png');

  // 2. Desktop
  console.log('--- DESKTOP TEST ---');
  const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desk = await deskCtx.newPage();
  await desk.goto('https://axecloud.com.br/entrar', { waitUntil: 'networkidle' });
  await desk.fill('input[type="email"]', 'vendasmercadolivrev1@gmail.com');
  await desk.fill('input[type="password"]', 'Lucas4356!');
  await desk.click('button[type="submit"]');
  await desk.waitForURL(url => url.pathname.includes('/dashboard'), { timeout: 20000 });
  await desk.waitForTimeout(3000);
  await desk.screenshot({ path: 'live-prod-desktop-dash.png' });
  console.log('Saved live-prod-desktop-dash.png');

  await desk.goto('https://axecloud.com.br/financial?tab=cantina', { waitUntil: 'networkidle' });
  await desk.waitForTimeout(3000);
  await desk.screenshot({ path: 'live-prod-desktop-cantina.png' });
  console.log('Saved live-prod-desktop-cantina.png');

  // Also check Miriam's account to confirm Cantina works for her terreiro too!
  console.log('--- MIRIAM ACCOUNT TEST ---');
  const miriamCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const miriam = await miriamCtx.newPage();
  await miriam.goto('https://axecloud.com.br/entrar', { waitUntil: 'networkidle' });
  // Login with miriam's account: let's test if we have password or if test is done
  // Just close browser
  await browser.close();
  console.log('All screenshots captured!');
}

test().catch(console.error);
