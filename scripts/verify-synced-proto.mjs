import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const artifactDir = 'C:/Users/Lucas A/.gemini/antigravity/brain/9d158178-6619-41e8-8027-3b042f4c880d';

async function capture() {
  const envContent = fs.readFileSync('AxecloudV2/.env', 'utf-8');
  const map = {};
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) map[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  });

  const sb = createClient(map['VITE_SUPABASE_URL'], map['SUPABASE_SERVICE_ROLE_KEY']);
  const { data: linkData } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email: 'vendasmercadolivrev1@gmail.com',
  });
  const { data: sessionData } = await sb.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  const session = sessionData.session;
  const tenantId = '4b167a21-d208-4f36-8b97-692f9c8e44a3';

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  await context.addInitScript(
    ({ session, tenantId }) => {
      localStorage.setItem('axecloud-auth-token', JSON.stringify(session));
      localStorage.setItem('tenant_id', tenantId);
      localStorage.setItem('axecloud_user_role', 'admin');
    },
    { session, tenantId },
  );

  const page = await context.newPage();
  await page.goto('http://localhost:4173/dashboard', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForSelector('.app-sidebar, .berry-sidebar, .nav-item', { timeout: 20000 });
  await page.waitForTimeout(3000);

  const outPath = path.join(artifactDir, 'synced-proto-dashboard.png');
  await page.screenshot({ path: outPath, fullPage: false });
  console.log('Saved screenshot to:', outPath);

  // Check computed font on hero and menu
  const fontData = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const navItem = document.querySelector('.nav-item');
    const metric = document.querySelector('.metric-card');
    return {
      h1Font: h1 ? getComputedStyle(h1).fontFamily : null,
      h1Size: h1 ? getComputedStyle(h1).fontSize : null,
      navFont: navItem ? getComputedStyle(navItem).fontFamily : null,
      navSize: navItem ? getComputedStyle(navItem).fontSize : null,
    };
  });
  console.log('Font verification:', JSON.stringify(fontData, null, 2));

  await browser.close();
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
