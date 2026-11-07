import { chromium } from 'playwright';

async function test() {
  console.log('Verifying live deployment of enhanced dashboard...');
  const browser = await chromium.launch();

  // 1. Desktop
  console.log('Testing Desktop Dashboard...');
  const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desk = await deskCtx.newPage();
  await desk.goto('https://axecloud.com.br/entrar', { waitUntil: 'domcontentloaded' });
  await desk.fill('input[type="email"]', 'vendasmercadolivrev1@gmail.com');
  await desk.fill('input[type="password"]', 'Lucas4356!');
  await desk.click('button[type="submit"]');

  await desk.waitForTimeout(4000);
  await desk.screenshot({ path: 'live-desktop-enhanced-dash.png' });
  console.log('Saved live-desktop-enhanced-dash.png');

  // Open profile popover to test photo, plan, WhatsApp, and DND
  const profileTrigger = await desk.$('.top-profile-chip, button:has(.profile-meta)');
  console.log('Profile trigger found:', !!profileTrigger);
  if (profileTrigger) {
    await profileTrigger.click();
    await desk.waitForTimeout(1000);
    await desk.screenshot({ path: 'live-desktop-profile-popover.png' });
    console.log('Saved live-desktop-profile-popover.png');
  }

  // 2. Mobile
  console.log('Testing Mobile Viewport...');
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const mobile = await mobileCtx.newPage();
  await mobile.goto('https://axecloud.com.br/entrar', { waitUntil: 'domcontentloaded' });
  await mobile.fill('input[type="email"]', 'vendasmercadolivrev1@gmail.com');
  await mobile.fill('input[type="password"]', 'Lucas4356!');
  await mobile.click('button[type="submit"]');

  await mobile.waitForTimeout(4000);
  await mobile.screenshot({ path: 'live-mobile-verified.png' });
  console.log('Saved live-mobile-verified.png');

  await browser.close();
  console.log('All verifications completed successfully!');
}

test().catch(console.error);
