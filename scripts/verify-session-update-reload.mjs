import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const envContent = fs.readFileSync('.env', 'utf-8');
const map = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) map[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
});

const url = map['VITE_SUPABASE_URL'];
const key = map['SUPABASE_SERVICE_ROLE_KEY'];
const sb = createClient(url, key);

async function run() {
  const email = 'vendasmercadolivrev1@gmail.com';
  console.log('Gerando magiclink para o terreiro de teste:', email);
  const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email: email,
  });
  if (linkErr) {
    console.error('Falha ao gerar link:', linkErr);
    process.exit(1);
  }

  const tokenHash = linkData.properties.hashed_token;
  const { data: sessionData, error: sessionErr } = await sb.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (sessionErr || !sessionData?.session) {
    console.error('Falha ao verificar OTP:', sessionErr);
    process.exit(1);
  }

  const session = sessionData.session;
  console.log('Sessão obtida com sucesso. User ID:', session.user.id);

  // Consulta tenant_id associado ao usuário
  const { data: perfil } = await sb
    .from('perfil_lider')
    .select('tenant_id, nome')
    .eq('user_id', session.user.id)
    .single();

  const tenantId = perfil?.tenant_id || '4b167a21-d208-4f36-8b97-692f9c8e44a3';
  console.log('Tenant ID associado:', tenantId);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();

  // Navega até o domínio para poder configurar localStorage
  await page.goto('https://axecloud.com.br/entrar', { waitUntil: 'domcontentloaded' });

  // Injeta sessão no storage
  await page.evaluate(({ session, tenantId }) => {
    localStorage.setItem('axecloud-auth-token', JSON.stringify(session));
    localStorage.setItem('tenant_id', tenantId);
    localStorage.setItem('axecloud_user_role', 'admin');
    localStorage.setItem('axecloud_version', 'soft-bump-test-v1');
  }, { session, tenantId });

  console.log('LocalStorage configurado. Navegando para https://axecloud.com.br/dashboard...');
  await page.goto('https://axecloud.com.br/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const urlBeforeReload = page.url();
  console.log('URL antes da atualização/reload:', urlBeforeReload);
  if (urlBeforeReload.includes('/entrar')) {
    console.error('ERRO: Usuário já caiu em /entrar antes do reload!');
    process.exit(1);
  }

  // Agora SIMULAMOS O RELOAD DE ATUALIZAÇÃO DO PWA (applyPwaUpdate)
  console.log('Simulando recarga de atualização (applyPwaUpdate / buildEmergencyReloadUrl)...');
  await page.evaluate(() => {
    // Chamamos a função de recarga exatamente como em pwaUpdate.ts
    const u = new URL(window.location.href);
    u.searchParams.set('_reload', String(Date.now()));
    window.location.replace(u.pathname + u.search + u.hash);
  });

  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('Página recarregou. Aguardando 6 segundos para testar hidratação e guards...');
  await page.waitForTimeout(6000);

  const urlAfterReload = page.url();
  console.log('URL após a atualização/reload:', urlAfterReload);

  if (urlAfterReload.includes('/entrar')) {
    console.error('FALHA: O usuário foi deslogado e redirecionado para /entrar!');
    await browser.close();
    process.exit(1);
  }

  console.log('SUCESSO TOTAL! O usuário permaneceu logado no painel:', urlAfterReload);

  // Captura screenshot de evidência
  const screenshotPath = 'C:/Users/Lucas A/.gemini/antigravity/brain/9d158178-6619-41e8-8027-3b042f4c880d/berry-update-reload-session-preserved.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Screenshot salvo em:', screenshotPath);

  await browser.close();
  console.log('Teste concluído com 100% de sucesso.');
}

run().catch((err) => {
  console.error('Erro na execução:', err);
  process.exit(1);
});
