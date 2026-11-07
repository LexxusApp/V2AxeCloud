import { chromium } from 'playwright';

async function test() {
  console.log('Testing Cantina Modals...');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('https://axecloud.com.br/entrar', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', 'vendasmercadolivrev1@gmail.com');
  await page.fill('input[type="password"]', 'Lucas4356!');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(4000);
  await page.goto('https://axecloud.com.br/financial', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Click on Cantina tab in Financial
  const cantinaTab = await page.$('button:has-text("Cantina")');
  if (cantinaTab) {
    await cantinaTab.click();
    await page.waitForTimeout(2000);
  }

  // Click "+ Novo Item Fixo"
  const novoItemBtn = await page.$('button:has-text("+ Novo Item Fixo")');
  console.log('Button "+ Novo Item Fixo" found:', !!novoItemBtn);
  if (novoItemBtn) {
    await novoItemBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'modal-novo-item-cantina.png' });
    console.log('Saved modal-novo-item-cantina.png');
  }

  await browser.close();
  console.log('Test complete!');
}

test().catch(console.error);
