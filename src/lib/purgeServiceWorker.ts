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
