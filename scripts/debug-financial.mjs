import fs from 'fs';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

async function test() {
  const envPath = fs.existsSync('.env') ? '.env' : '../.env';
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const map = {};
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) map[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  });

  const sb = createClient(map['VITE_SUPABASE_URL'], map['SUPABASE_SERVICE_ROLE_KEY']);
  const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email: 'vendasmercadolivrev1@gmail.com',
  });
  if (linkErr) {
    console.error('Magic link err:', linkErr);
    return;
  }
  const { data: sessionData, error: sessionErr } = await sb.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (sessionErr) {
    console.error('Verify OTP err:', sessionErr);
    return;
  }
  const session = sessionData.session;
  const tenantId = '4b167a21-d208-4f36-8b97-692f9c8e44a3';

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(
    ({ session, tenantId }) => {
      localStorage.setItem('axecloud-auth-token', JSON.stringify(session));
      localStorage.setItem('tenant_id', tenantId);
      localStorage.setItem('axecloud_user_role', 'admin');
    },
    { session, tenantId },
  );

  const page = await context.newPage();
  page.on('console', (msg) => console.log('[BROWSER]', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.error('[PAGE ERROR]', err));
  page.on('requestfailed', (req) => console.log('[REQ FAIL]', req.url(), req.failure()?.errorText));

  console.log('Navigating to http://localhost:4173/dashboard?tab=financial...');
  await page.goto('http://localhost:4173/dashboard?tab=financial', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  
  const htmlSample = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    return main.innerText.slice(0, 500);
  });
  console.log('Main inner text:\n', htmlSample);

  await browser.close();
}

test().catch(console.error);
