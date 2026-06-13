import { markPwaUpdateAvailable } from './pwaUpdate';

/** Build embutido no HTML do bundle que está rodando agora. */
export function getRunningBuildId(): string {
  const meta = document.querySelector('meta[name="axecloud-build"]')?.getAttribute('content')?.trim();
  if (meta) return meta;
  try {
    return localStorage.getItem('axecloud_running_build') || '';
  } catch {
    return '';
  }
}

export function persistRunningBuildId(buildId?: string): void {
  const id = (buildId || getRunningBuildId()).trim();
  if (!id) return;
  try {
    localStorage.setItem('axecloud_running_build', id);
  } catch {
    /* */
  }
}

async function fetchRemoteBuildId(): Promise<string | null> {
  const bust = Date.now();
  const urls = [`/api/v1/app-build?t=${bust}`, `/build-info.json?t=${bust}`];

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) continue;
      const data = (await res.json()) as { buildId?: string };
      const id = String(data?.buildId || '').trim();
      if (id) return id;
    } catch {
      /* rede indisponível */
    }
  }
  return null;
}

/**
 * Compara build do servidor com o bundle instalado.
 * Funciona no PWA do celular mesmo quando o Service Worker não detecta update.
 */
export async function checkRemoteBuildVersion(): Promise<boolean> {
  const running = getRunningBuildId();
  if (!running) return false;

  const remote = await fetchRemoteBuildId();
  if (!remote || remote === running) return false;

  markPwaUpdateAvailable();
  return true;
}

export function startBuildVersionPolling(): void {
  if (import.meta.env.DEV) return;

  const probe = () => void checkRemoteBuildVersion();

  persistRunningBuildId();
  void probe();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void probe();
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) void probe();
  });

  window.addEventListener('focus', () => void probe());

  window.setInterval(() => {
    if (document.visibilityState === 'visible') void probe();
  }, 90_000);
}
