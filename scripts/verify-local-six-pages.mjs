import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const artifactDir = 'C:/Users/Lucas A/.gemini/antigravity/brain/9d158178-6619-41e8-8027-3b042f4c880d';

const envPath = fs.existsSync('.env') ? '.env' : 'AxecloudV2/.env';
const envContent = fs.readFileSync(envPath, 'utf-8');
const map = {};
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      map[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
});

const url = map['VITE_SUPABASE_URL'];
const key = map['SUPABASE_SERVICE_ROLE_KEY'];
const sb = createClient(url, key);

async function run() {
  const email = 'vendasmercadolivrev1@gmail.com';
  console.log('Autenticando terreiro de testes:', email);

  const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email: email,
  });
  if (linkErr) {
    console.error('Falha ao gerar magiclink:', linkErr);
    process.exit(1);
  }

  const tokenHash = linkData.properties.hashed_token;
  const { data: sessionData, error: sessionErr } = await sb.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (sessionErr || !sessionData?.session) {
    console.error('Falha ao obter sessão:', sessionErr);
    process.exit(1);
  }

  const session = sessionData.session;
  console.log('Sessão válida obtida. User ID:', session.user.id);

  const { data: perfil } = await sb
    .from('perfil_lider')
    .select('tenant_id, nome')
    .eq('user_id', session.user.id)
    .single();

  const tenantId = perfil?.tenant_id || '4b167a21-d208-4f36-8b97-692f9c8e44a3';
  console.log('Tenant ID:', tenantId);

  const browser = await chromium.launch({ headless: true });

  const pagesToTest = [
    { tab: 'children', name: 'filhos', title: 'Filhos de Santo' },
    { tab: 'obligations', name: 'obrigacoes', title: 'Obrigações' },
    { tab: 'calendar', name: 'giras', title: 'Giras' },
    { tab: 'frequencia', name: 'frequencia', title: 'Frequência' },
    { tab: 'mural', name: 'comunicados', title: 'Comunicados' },
    { tab: 'chat', name: 'mensagens', title: 'Mensagens' },
  ];

  async function clickTab(page, tabId) {
    const selector = `a[href="#${tabId}"]`;
    await page.waitForSelector(selector, { state: 'attached', timeout: 10000 });
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.click();
    }, selector);
    await page.waitForTimeout(2000);
  }

  // --- 1. CAPTURA DESKTOP (1440x900) ---
  console.log('\n--- Capturando Desktop (1440x900) ---');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });

  await desktopContext.addInitScript(
    ({ session, tenantId }) => {
      localStorage.setItem('axecloud-auth-token', JSON.stringify(session));
      localStorage.setItem('tenant_id', tenantId);
      localStorage.setItem('axecloud_user_role', 'admin');
    },
    { session, tenantId }
  );

  const desktopPage = await desktopContext.newPage();
  desktopPage.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[PAGE ERROR LOG]:', msg.text());
  });
  desktopPage.on('pageerror', (err) => {
    console.log('[PAGE UNCAUGHT EXCEPTION]:', err.message, '\n', err.stack);
  });
  console.log('Acessando /dashboard no desktop...');
  await desktopPage.goto('http://localhost:4173/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await desktopPage.waitForSelector('.app-shell', { timeout: 25000 });
  console.log('App shell carregada no desktop!');
  await desktopPage.waitForTimeout(2500);

  for (const item of pagesToTest) {
    console.log(`Desktop: Navegando para ${item.title} (#${item.tab})...`);
    await clickTab(desktopPage, item.tab);

    const shotPath = path.join(artifactDir, `local-${item.name}-desktop.png`);
    await desktopPage.screenshot({ path: shotPath, fullPage: false });
    console.log(`✓ Screenshot desktop salvo: local-${item.name}-desktop.png`);
  }

  // --- 2. CAPTURA MOBILE (390x844 iPhone 14 style) ---
  console.log('\n--- Capturando Mobile (390x844) ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });

  await mobileContext.addInitScript(
    ({ session, tenantId }) => {
      localStorage.setItem('axecloud-auth-token', JSON.stringify(session));
      localStorage.setItem('tenant_id', tenantId);
      localStorage.setItem('axecloud_user_role', 'admin');
    },
    { session, tenantId }
  );

  const mobilePage = await mobileContext.newPage();
  console.log('Acessando /dashboard no mobile...');
  await mobilePage.goto('http://localhost:4173/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await mobilePage.waitForSelector('.app-shell', { timeout: 25000 });
  console.log('App shell carregada no mobile!');
  await mobilePage.waitForTimeout(2500);

  for (const item of pagesToTest) {
    console.log(`Mobile: Navegando para ${item.title} (#${item.tab})...`);
    await clickTab(mobilePage, item.tab);

    const shotPath = path.join(artifactDir, `local-${item.name}-mobile.png`);
    await mobilePage.screenshot({ path: shotPath, fullPage: false });
    console.log(`✓ Screenshot mobile salvo: local-${item.name}-mobile.png`);
  }

  await browser.close();
  console.log('\nTodas as 12 capturas (desktop + mobile) concluídas com sucesso!');
}

run().catch((e) => {
  console.error('Erro na verificação:', e);
  process.exit(1);
});
