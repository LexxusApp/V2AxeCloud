/**
 * Recarga agressiva para PWA preso em bundle/cache antigo ou sessão inconsistente.
 * Não usar reload(true) — depreciado; reload() basta após limpar SW/caches.
 */
export function performEmergencyHardReload(): void {
  try {
    sessionStorage.setItem('axecloud_emergency_reload_at', String(Date.now()));
  } catch {
    /* */
  }
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => void r.unregister());
    });
  }
  if (typeof caches !== 'undefined') {
    void caches.keys().then((keys) => {
      keys.forEach((k) => void caches.delete(k));
    });
  }

  const bust = '_reload=' + Date.now();
  const path = window.location.pathname || '/';
  const search = window.location.search ? window.location.search + '&' + bust : '?' + bust;
  window.location.replace(path + search + window.location.hash);
}
