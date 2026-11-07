import fs from 'fs';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

async function checkRadius() {
  const envContent = fs.readFileSync('.env', 'utf-8');
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
  await page.goto('http://localhost:4173/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const radii = await page.evaluate(() => {
    const hero = document.querySelector('.hero-welcome-card');
    const gira = document.querySelector('.cinematic-gira-card');
    const berryCard = document.querySelector('.berry-card');
    const widget = document.querySelector('.feature-widget-card');
    const section = document.querySelector('.section-panel');

    return {
      hero: hero ? window.getComputedStyle(hero).borderRadius : null,
      gira: gira ? window.getComputedStyle(gira).borderRadius : null,
      berryCard: berryCard ? window.getComputedStyle(berryCard).borderRadius : null,
      widget: widget ? window.getComputedStyle(widget).borderRadius : null,
      section: section ? window.getComputedStyle(section).borderRadius : null,
    };
  });

  console.log('Computed Border Radii:', radii);
  await browser.close();
}

checkRadius().catch(console.error);
