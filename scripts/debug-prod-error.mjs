import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  page.on('console', msg => console.log(`[BROWSER ${msg.type()}]`, msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message, '\nSTACK:', err.stack));

  console.log('Navigating to login...');
  await page.goto('https://axecloud.com.br/entrar', { waitUntil: 'networkidle' });

  console.log('Filling credentials...');
  await page.fill('input[type="email"]', 'vendasmercadolivrev1@gmail.com');
  await page.fill('input[type="password"]', 'Lucas4356!');
  await page.click('button[type="submit"]');

  console.log('Waiting for response...');
  await page.waitForTimeout(6000);
  console.log('Current URL:', page.url());

  await browser.close();
}

run().catch(console.error);
