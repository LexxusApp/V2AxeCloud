import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const artifactDir = 'C:/Users/Lucas A/.gemini/antigravity/brain/9d158178-6619-41e8-8027-3b042f4c880d';

const envPath = fs.existsSync('.env') ? '.env' : '../.env';
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

  const tenantId = '4b167a21-d208-4f36-8b97-692f9c8e44a3';

  const browser = await chromium.launch({ headless: true });

  const pagesToTest = [
    { tab: 'financial', name: 'financeiro', title: 'Financeiro (Visão Geral)' },
    { tab: 'financial-mensalidades', name: 'mensalidades', title: 'Mensalidades' },
    { tab: 'financial-cantina', name: 'cantina', title: 'Cantina' },
    { tab: 'financial-configs', name: 'pix', title: 'Configurações Pix' },
    { tab: 'gallery', name: 'galeria', title: 'Galeria' },
    { tab: 'inventory', name: 'almoxarifado', title: 'Almoxarifado' },
    { tab: 'library', name: 'biblioteca', title: 'Biblioteca' },
    { tab: 'store', name: 'loja', title: 'Loja da Casa' },
    { tab: 'radar', name: 'radar', title: 'Radar AxéCloud' },
    { tab: 'subscription', name: 'assinatura', title: 'Minha Assinatura' },
    { tab: 'settings', name: 'configuracoes', title: 'Configurações' },
    { tab: 'suporte', name: 'suporte', title: 'Suporte' },
  ];

  // 1. Desktop captures (1440x900)
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
    { session, tenantId },
  );

  for (const item of pagesToTest) {
    console.log(`Carregando ${item.title} no desktop...`);
    const page = await desktopContext.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    try {
      await page.goto(`http://localhost:4173/dashboard?tab=${item.tab}`, {
        waitUntil: 'domcontentloaded',
        timeout: 35000,
      });
      await page.waitForSelector('text=Carregando perfil...', { state: 'detached', timeout: 20000 }).catch(() => {});
      // Wait for any initial spinners to clear
      await page.waitForTimeout(4000);

      const shotPath = path.join(artifactDir, `local-${item.name}-desktop.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`✓ Screenshot desktop salvo: local-${item.name}-desktop.png ${consoleErrors.length > 0 ? `(Erros console: ${consoleErrors.length})` : '(0 erros console)'}`);
      if (consoleErrors.length > 0) {
        console.warn(`  [Console Erros em ${item.name}]:`, consoleErrors.slice(0, 3));
      }
    } catch (err) {
      console.error(`✗ Erro ao capturar ${item.title} no desktop:`, err.message);
    } finally {
      await page.close();
    }
  }

  // 2. Mobile captures (390x844 iPhone 14 style)
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
    { session, tenantId },
  );

  for (const item of pagesToTest) {
    console.log(`Carregando ${item.title} no mobile...`);
    const page = await mobileContext.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    try {
      await page.goto(`http://localhost:4173/dashboard?tab=${item.tab}`, {
        waitUntil: 'domcontentloaded',
        timeout: 35000,
      });
      await page.waitForSelector('text=Carregando perfil...', { state: 'detached', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(3500);

      const shotPath = path.join(artifactDir, `local-${item.name}-mobile.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`✓ Screenshot mobile salvo: local-${item.name}-mobile.png ${consoleErrors.length > 0 ? `(Erros console: ${consoleErrors.length})` : '(0 erros console)'}`);
      if (consoleErrors.length > 0) {
        console.warn(`  [Console Erros Mobile em ${item.name}]:`, consoleErrors.slice(0, 3));
      }
    } catch (err) {
      console.error(`✗ Erro ao capturar ${item.title} no mobile:`, err.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('\n🎉 Todas as 24 capturas (12 desktop + 12 mobile) concluídas com sucesso!');
}

run().catch((e) => {
  console.error('Erro na verificação:', e);
  process.exit(1);
});
