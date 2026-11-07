import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch();
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto('https://axecloud.com.br/entrar', { waitUntil: 'domcontentloaded' });
  await mobile.fill('input[type="email"]', 'vendasmercadolivrev1@gmail.com');
  await mobile.fill('input[type="password"]', 'Lucas4356!');
  await mobile.click('button[type="submit"]');
  await mobile.waitForTimeout(4000);

  await mobile.goto('https://axecloud.com.br/financial', { waitUntil: 'domcontentloaded' });
  await mobile.waitForTimeout(3000);

  const cantinaTab = await mobile.$('button:has-text("Cantina")');
  console.log('Cantina button exists:', !!cantinaTab);
  if (cantinaTab) {
    await cantinaTab.scrollIntoViewIfNeeded();
    await cantinaTab.click();
    await mobile.waitForTimeout(2000);
    await mobile.screenshot({ path: 'live-mobile-cantina-tab.png' });
    console.log('Saved live-mobile-cantina-tab.png');
  }
  await browser.close();
}

test().catch(console.error);
