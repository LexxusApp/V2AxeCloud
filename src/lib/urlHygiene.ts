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
