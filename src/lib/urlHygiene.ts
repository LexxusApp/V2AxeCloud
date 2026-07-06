/** Query params internos de cache-bust — não devem permanecer na barra de endereço. */
const INTERNAL_QUERY_KEYS = ['_reload', '_swfix', '_nocache', '_boot'] as const;

function stripInternalParams(url: URL): boolean {
  let changed = false;
  for (const key of INTERNAL_QUERY_KEYS) {
    while (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  return changed;
}

/** Remove params internos da URL visível (sem recarregar a página). */
export function cleanBrowserUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!stripInternalParams(url)) return;
  const next = url.pathname + url.search + url.hash;
  window.history.replaceState(window.history.state, '', next);
}

/** URL para recarga de emergência — um único _reload, sem acumular na query. */
export function buildEmergencyReloadUrl(): string {
  const url = new URL(window.location.href);
  stripInternalParams(url);
  url.searchParams.set('_reload', String(Date.now()));
  return url.pathname + url.search + url.hash;
}

export const STALE_BOOT_RETRIES_KEY = 'axecloud_stale_boot_retries';
export const MAX_STALE_BOOT_RETRIES = 3;

/** Recarrega documento da rede após HTML/JS desalinhados (cache PWA ou deploy). */
export function hardRefreshFromStaleBundle(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const attempts = parseInt(sessionStorage.getItem(STALE_BOOT_RETRIES_KEY) || '0', 10) + 1;
    if (attempts > MAX_STALE_BOOT_RETRIES) return false;
    sessionStorage.setItem(STALE_BOOT_RETRIES_KEY, String(attempts));
  } catch {
    return false;
  }
  const url = new URL(window.location.href);
  stripInternalParams(url);
  url.searchParams.set('_boot', String(Date.now()));
  window.location.replace(url.pathname + url.search + url.hash);
  return true;
}

export function isRecoverableChunkError(error: unknown): boolean {
  const msg = String((error as Error)?.message || error || '').toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('chunkloaderror') ||
    msg.includes('loading chunk') ||
    msg.includes('dynamically imported module')
  );
}
