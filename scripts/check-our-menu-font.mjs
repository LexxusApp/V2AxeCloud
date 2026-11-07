import { chromium } from 'playwright';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

async function checkOurMenuFont() {
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

  const menuInfo = await page.evaluate(() => {
    const sidebar = document.querySelector('.app-v5-sidebar') || document.querySelector('aside');
    if (!sidebar) return { error: 'Sidebar not found' };

    const tabs = Array.from(sidebar.querySelectorAll('[role="tab"], button, span, p'));
    const samples = [];
    for (const el of tabs) {
      if (el.innerText && el.innerText.trim().length > 0 && el.children.length === 0) {
        const cs = window.getComputedStyle(el);
        samples.push({
          text: el.innerText.trim(),
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
        });
        if (samples.length >= 6) break;
      }
    }

    return {
      sidebarFontFamily: window.getComputedStyle(sidebar).fontFamily,
      samples,
    };
  });

  console.log('NOSSO MENU FONT INFO:', JSON.stringify(menuInfo, null, 2));
  await browser.close();
}

checkOurMenuFont().catch(console.error);
