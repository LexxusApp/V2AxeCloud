import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch();
  
  // Desktop
  const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desk = await deskCtx.newPage();
  await desk.goto('https://axecloud.com.br/entrar', { waitUntil: 'domcontentloaded' });
  await desk.fill('input[type="email"]', 'vendasmercadolivrev1@gmail.com');
  await desk.fill('input[type="password"]', 'Lucas4356!');
  await desk.click('button[type="submit"]');
  await desk.waitForTimeout(4000);

  // Go directly to financial
  await desk.goto('https://axecloud.com.br/financial', { waitUntil: 'domcontentloaded' });
  await desk.waitForTimeout(3000);

  // Click on "Cantina" tab
  const cantinaTab = await desk.$('button:has-text("Cantina")');
  console.log('Desktop Cantina Tab found:', !!cantinaTab);
  if (cantinaTab) {
    await cantinaTab.click();
    await desk.waitForTimeout(2000);
    await desk.screenshot({ path: 'live-desktop-cantina-tab.png' });
    console.log('Saved live-desktop-cantina-tab.png');
  }

  // Mobile
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

  await mobile.goto('https://axecloud.com.br/financial', { waitUntil: 'domcontentloaded' });
  await mobile.waitForTimeout(3000);

  const mobileCantinaTab = await mobile.$('button:has-text("Cantina")');
  console.log('Mobile Cantina Tab found:', !!mobileCantinaTab);
  if (mobileCantinaTab) {
    await mobileCantinaTab.click();
    await mobile.waitForTimeout(2000);
    await mobile.screenshot({ path: 'live-mobile-cantina-tab.png' });
    console.log('Saved live-mobile-cantina-tab.png');
  }

  await browser.close();
  console.log('Done capturing financial & cantina tabs!');
}

test().catch(console.error);
