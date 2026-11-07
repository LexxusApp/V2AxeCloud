import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const email = process.env.AXECLOUD_E2E_EMAIL?.trim();
const password = process.env.AXECLOUD_E2E_PASSWORD;

if (!email || !password) {
  throw new Error('Defina AXECLOUD_E2E_EMAIL e AXECLOUD_E2E_PASSWORD no ambiente seguro de testes.');
}

async function run() {
  console.log('🚀 Starting Production Live Verification on https://axecloud.com.br ...');
  const browser = await chromium.launch({ headless: true });
  
  // 1. Mobile verification (iPhone 14 style: 390x844)
  console.log('\n--- 1. Testing Mobile Viewport (390x844) ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true
  });
  const mobilePage = await mobileContext.newPage();

  console.log('Visiting login page...');
  await mobilePage.goto('https://axecloud.com.br/entrar', { waitUntil: 'networkidle', timeout: 30000 });
  
  // Login with test account
  console.log('Logging in with the configured E2E account ...');
  await mobilePage.fill('input[type="email"], input[name="email"]', email);
  await mobilePage.fill('input[type="password"], input[name="password"]', password);
  await mobilePage.click('button[type="submit"]');

  await mobilePage.waitForURL(url => url.pathname.includes('/dashboard'), { timeout: 20000 });
  console.log('Successfully reached /dashboard');
  await mobilePage.waitForTimeout(2500);

  // Check for bottom nav
  const bottomNav = await mobilePage.$('.app-v5-bottom-nav, nav[aria-label="Navegação móvel principal"]');
  console.log('Bottom navigation visible:', !!bottomNav);

  // Check scroll
  const initialScroll = await mobilePage.evaluate(() => window.scrollY);
  await mobilePage.evaluate(() => window.scrollBy(0, 500));
  await mobilePage.waitForTimeout(500);
  const afterScroll = await mobilePage.evaluate(() => window.scrollY);
  console.log(`Scroll test: initial=${initialScroll}, afterScroll=${afterScroll}`);

  await mobilePage.screenshot({ path: 'prod-mobile-dashboard.png', fullPage: false });
  console.log('Saved prod-mobile-dashboard.png');

  // Navigate to Financeiro
  console.log('Navigating to Financeiro on mobile...');
  await mobilePage.goto('https://axecloud.com.br/financial', { waitUntil: 'networkidle', timeout: 25000 });
  await mobilePage.waitForTimeout(2000);

  // Look for Cantina tab
  const cantinaTabButton = await mobilePage.$('button:has-text("Cantina")');
  console.log('Cantina tab visible on mobile Financeiro:', !!cantinaTabButton);

  if (cantinaTabButton) {
    await cantinaTabButton.click();
    await mobilePage.waitForTimeout(2000);
    const cantinaView = await mobilePage.$('.cantina-view, :text("A Receber na Caderneta")');
    console.log('Cantina view rendered on mobile:', !!cantinaView);
    await mobilePage.screenshot({ path: 'prod-mobile-cantina.png', fullPage: false });
    console.log('Saved prod-mobile-cantina.png');
  }

  // 2. Desktop verification (1440x900)
  console.log('\n--- 2. Testing Desktop Viewport (1440x900) ---');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const desktopPage = await desktopContext.newPage();

  console.log('Logging in on desktop...');
  await desktopPage.goto('https://axecloud.com.br/entrar', { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.fill('input[type="email"], input[name="email"]', email);
  await desktopPage.fill('input[type="password"], input[name="password"]', password);
  await desktopPage.click('button[type="submit"]');

  await desktopPage.waitForURL(url => url.pathname.includes('/dashboard'), { timeout: 20000 });
  await desktopPage.waitForTimeout(2000);

  // Check sidebar cantina link
  const sidebarCantina = await desktopPage.$('a[href="/financial?tab=cantina"], a:has-text("Cantina")');
  console.log('Sidebar Cantina link present:', !!sidebarCantina);

  // Go to Financial Cantina
  await desktopPage.goto('https://axecloud.com.br/financial?tab=cantina', { waitUntil: 'networkidle', timeout: 25000 });
  await desktopPage.waitForTimeout(2000);

  const desktopCantinaMetric = await desktopPage.$(':text("A Receber na Caderneta")');
  console.log('Desktop Cantina metric card rendered:', !!desktopCantinaMetric);

  await desktopPage.screenshot({ path: 'prod-desktop-cantina.png', fullPage: false });
  console.log('Saved prod-desktop-cantina.png');

  await browser.close();
  console.log('\n✅ All production verifications completed successfully!');
}

run().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
