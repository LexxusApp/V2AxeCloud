import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  await page.goto('https://axecloud.com.br/entrar', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', 'vendasmercadolivrev1@gmail.com');
  await page.fill('input[type="password"]', 'Lucas4356!');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(4000);
  await page.goto('https://axecloud.com.br/financial', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const cantinaTab = await page.$('button:has-text("Cantina")');
  if (cantinaTab) {
    await cantinaTab.scrollIntoViewIfNeeded();
    await cantinaTab.click();
    await page.waitForTimeout(2000);
  }

  const novoItemBtn = await page.$('button:has-text("+ Novo Item Fixo")');
  if (novoItemBtn) {
    await novoItemBtn.scrollIntoViewIfNeeded();
    await novoItemBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'modal-cantina-mobile.png' });
    console.log('Saved modal-cantina-mobile.png');
  }

  await browser.close();
}

test().catch(console.error);
