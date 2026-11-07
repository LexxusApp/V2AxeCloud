import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  
  await page.goto('https://axecloud.com.br/entrar', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', 'vendasmercadolivrev1@gmail.com');
  await page.fill('input[type="password"]', 'Lucas4356!');
  await page.click('button[type="submit"]');

  console.log('Waiting for bottom nav...');
  await page.waitForSelector('.app-v5-bottom-nav', { timeout: 15000 });
  await page.waitForTimeout(3000);

  console.log('Clicking Financeiro in bottom nav...');
  const finBtn = await page.$('.app-v5-bottom-nav button:has-text("Financeiro")');
  if (finBtn) {
    await finBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'mobile-fin-via-bottom-nav.png' });
    console.log('Saved mobile-fin-via-bottom-nav.png');

    const cantinaBtn = await page.$('button:has-text("Cantina")');
    console.log('Cantina button in tab bar:', !!cantinaBtn);
    if (cantinaBtn) {
      await cantinaBtn.scrollIntoViewIfNeeded();
      await cantinaBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'mobile-cantina-view.png' });
      console.log('Saved mobile-cantina-view.png');
    }
  }

  await browser.close();
}

test().catch(console.error);
