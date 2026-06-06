import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const TOUR_FILES = [
  'painel-inicio.png',
  'filhos-de-santo.png',
  'calendario-eventos.png',
  'mural.png',
];

const localHashes = Object.fromEntries(
  TOUR_FILES.map((f) => [
    f,
    createHash('sha256').update(readFileSync(`public/screenshots/${f}`)).digest('hex').slice(0, 16),
  ])
);

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('https://axecloud.com.br/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.locator('#tour-tab-painel, [href="#tour"]').first().click({ timeout: 15_000 }).catch(() => {});
await page.evaluate(() => document.getElementById('tour')?.scrollIntoView());
await page.waitForTimeout(3000);

for (const f of TOUR_FILES) {
  const url = `https://axecloud.com.br/screenshots/${f}`;
  const res = await page.request.get(url);
  const buf = await res.body();
  const prod = createHash('sha256').update(buf).digest('hex').slice(0, 16);
  const match = prod === localHashes[f];
  console.log(`${f}: HTTP ${res.status()} ${buf.length}B hash=${prod} local=${localHashes[f]} ${match ? 'OK' : 'MISMATCH'}`);
}

const tourImg = page.locator('[id^="tour-panel"] img').first();
if (await tourImg.count()) {
  const src = await tourImg.getAttribute('src');
  console.log('tour img src:', src);
}

await browser.close();
