import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const artifactDir = 'C:/Users/Lucas A/.gemini/antigravity/brain/9d158178-6619-41e8-8027-3b042f4c880d';

async function captureViews() {
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
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.25,
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
  
  // 1. Radar
  await page.goto('http://localhost:4173/dashboard?tab=radar', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(artifactDir, 'page-radar-current.png'), fullPage: false });

  // 2. Financial
  await page.goto('http://localhost:4173/dashboard?tab=financial', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(artifactDir, 'page-financial-current.png'), fullPage: false });

  // 3. Children (Casa)
  await page.goto('http://localhost:4173/dashboard?tab=children', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(artifactDir, 'page-children-current.png'), fullPage: false });

  await browser.close();
}

captureViews().catch(console.error);
