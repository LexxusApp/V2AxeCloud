/** Remove SW e caches do app PWA — necessário na home de marketing no mesmo domínio. */
export async function purgeLegacyAppServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* */
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* */
  }

  if (navigator.serviceWorker.controller) {
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 600);
      const onChange = () => {
        window.clearTimeout(timer);
        resolve();
      };
      navigator.serviceWorker.addEventListener('controllerchange', onChange, { once: true });
    });
  }
}

/**
 * Abre uma pagina servida pelo site de marketing sem permitir que um service
 * worker antigo do app devolva a landing React que ficou no cache.
 */
export async function navigateToMarketingDocument(path = '/'): Promise<void> {
  if (typeof window === 'undefined') return;

  const target = new URL(path, window.location.origin);
  if (target.origin !== window.location.origin) {
    window.location.assign(target.href);
    return;
  }

  await purgeLegacyAppServiceWorker();
  window.location.assign(`${target.pathname}${target.search}${target.hash}`);
}
