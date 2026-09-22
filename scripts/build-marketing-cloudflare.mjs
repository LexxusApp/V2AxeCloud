import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

const PUBLIC_CONFIG_URL = 'https://axecloud.com.br/api/public-config';
const DIRECTORY_EXPORT_URL = 'https://axecloud.com.br/api/v1/public/diretorio/export';

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

async function loadDirectoryExport() {
  const response = await fetch(DIRECTORY_EXPORT_URL, {
    headers: { Accept: 'application/json', 'User-Agent': 'AxeCloud-Cloudflare-Build/1.0' },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`[cloudflare-build] Exportacao do diretorio indisponivel (${response.status}).`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error('[cloudflare-build] Exportacao do diretorio vazia ou invalida.');
  }
  return payload.items;
}

async function startDirectoryProxy(items) {
  const groups = new Map();
  for (const item of items) {
    const estado = String(item.estado || '').trim().toLowerCase();
    const cidadeSlug = String(item.cidadeSlug || '').trim();
    if (!estado || !cidadeSlug) continue;
    const key = `${estado}/${cidadeSlug}`;
    const current = groups.get(key) || [];
    current.push(item);
    groups.set(key, current);
  }
  const cidades = [...groups.values()].map((cityItems) => {
    const first = cityItems[0];
    return {
      cidade: first.cidade,
      estado: first.estado,
      cidadeSlug: first.cidadeSlug,
      count: cityItems.length,
    };
  });

  const server = createServer((request, response) => {
    const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (pathname === '/api/v1/public/diretorio/cidades') {
      response.end(JSON.stringify({ cidades }));
      return;
    }
    const match = pathname.match(/^\/api\/v1\/public\/diretorio\/([^/]+)\/([^/]+)$/);
    const cityItems = match
      ? groups.get(`${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}`)
      : null;
    if (cityItems) {
      response.end(JSON.stringify({ items: cityItems }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'not-found' }));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('[cloudflare-build] Proxy local indisponivel.');
  }
  return { server, origin: `http://127.0.0.1:${address.port}`, cityCount: cidades.length };
}

function runLandingBuild(config, publicAppUrl) {
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = npmCli ? [npmCli, 'run', 'build:landing'] : ['run', 'build:landing'];
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: !npmCli && process.platform === 'win32',
    env: {
      ...process.env,
      PUBLIC_APP_URL: publicAppUrl,
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
const directoryItems = await loadDirectoryExport();
const directoryProxy = await startDirectoryProxy(directoryItems);
console.log(`[cloudflare-build] Diretorio carregado em uma chamada: ${directoryItems.length} registros, ${directoryProxy.cityCount} cidades.`);
try {
  console.log('[cloudflare-build] Configuracao publica carregada; iniciando build validado.');
  await runLandingBuild(config, directoryProxy.origin);
  console.log('[cloudflare-build] Artefato de marketing pronto para publicacao.');
} finally {
  await new Promise((resolve) => directoryProxy.server.close(resolve));
}
