function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.includes('localhost');
}

import { getRunningBuildId, persistRunningBuildId } from './buildId';
import {
  acknowledgeAppliedBuild,
  isBuildAlreadyApplied,
  markPwaUpdateAvailable,
  shouldSuppressPwaUpdatePrompt,
} from './pwaUpdate';

export async function fetchRemoteBuildId(): Promise<string | null> {
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
 * Fonte única de verdade para exibir o banner — polling e SW usam a mesma regra.
 * Evita segundo aviso após o usuário já ter aceitado o build remoto.
 */
export async function signalAppUpdateIfNeeded(options?: { swHint?: boolean }): Promise<boolean> {
  if (isLocalhost()) return false;

  const remote = await fetchRemoteBuildId();
  if (shouldSuppressPwaUpdatePrompt(remote || undefined)) return false;

  const running = getRunningBuildId();

  if (remote) {
    if (isBuildAlreadyApplied(remote)) return false;

    if (running && running === remote) {
      acknowledgeAppliedBuild(remote);
      persistRunningBuildId(remote);
      return false;
    }

    if (!running || remote !== running) {
      markPwaUpdateAvailable(remote);
      return true;
    }

    return false;
  }

  if (options?.swHint) {
    markPwaUpdateAvailable();
    return true;
  }

  return false;
}

/**
 * Compara build do servidor com o bundle JS instalado.
 * Funciona no PWA e no navegador mesmo quando o SW não detecta update.
 */
export async function checkRemoteBuildVersion(): Promise<boolean> {
  if (isLocalhost()) return false;
  return signalAppUpdateIfNeeded();
}

export function startBuildVersionPolling(): void {
  if (import.meta.env.DEV || isLocalhost()) return;

  const probe = () => void signalAppUpdateIfNeeded();

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
  }, 25_000);
}
