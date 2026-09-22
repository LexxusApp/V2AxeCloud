import { spawn } from 'node:child_process';

const PUBLIC_CONFIG_URL = 'https://axecloud.com.br/api/public-config';

function requirePublicValue(value, name) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(`[cloudflare-build] ${name} ausente em ${PUBLIC_CONFIG_URL}.`);
  return normalized;
}

async function loadPublicConfig() {
  const response = await fetch(PUBLIC_CONFIG_URL, {
    headers: { Accept: 'application/json', 'User-Agent': 'AxeCloud-Cloudflare-Build/1.0' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`[cloudflare-build] Configuracao publica indisponivel (${response.status}).`);
  }

  const config = await response.json();
  return {
    supabaseUrl: requirePublicValue(config.supabaseUrl, 'supabaseUrl'),
    supabaseAnonKey: requirePublicValue(config.supabaseAnonKey, 'supabaseAnonKey'),
  };
}

function runLandingBuild(config) {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(command, ['run', 'build:landing'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PUBLIC_APP_URL: 'https://axecloud.com.br',
      VITE_SUPABASE_URL: config.supabaseUrl,
      VITE_SUPABASE_ANON_KEY: config.supabaseAnonKey,
    },
  });

  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`[cloudflare-build] Build falhou (${signal ?? `codigo ${code}`}).`));
    });
  });
}

const config = await loadPublicConfig();
console.log('[cloudflare-build] Configuracao publica carregada; iniciando build validado.');
await runLandingBuild(config);
console.log('[cloudflare-build] Artefato de marketing pronto para publicacao.');
