import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import {EmergencyReloadBeacon} from './components/EmergencyReloadBeacon';
import {PwaUpdateBanner} from './components/PwaUpdateBanner';
import {AppErrorBoundary} from './components/AppErrorBoundary';
import {VercelInsights} from './components/VercelInsights';
import {isCanonicalAppOrigin, redirectToCanonicalOriginIfNeeded} from './lib/canonicalOrigin';
import {escapeAppBundleOnMarketingUrl, isMarketingDocumentPath} from './lib/marketingDocumentGuard';
import {cleanBrowserUrl} from './lib/urlHygiene';
import {bindPwaApplyUpdate, markPwaUpdateAvailable} from './lib/pwaUpdate';
import AppRouter from './router/AppRouter.tsx';
import './index.css';

let swRegistration: ServiceWorkerRegistration | undefined;
let lastSwCheck = 0;
const SW_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min

function checkServiceWorkerUpdate() {
  const now = Date.now();
  if (now - lastSwCheck < SW_CHECK_INTERVAL_MS) return;
  lastSwCheck = now;
  void swRegistration?.update().catch(() => {
    /* offline ou SW indisponível */
  });
}

const SW_RESET_KEY = 'axecloud-sw-reset-v108';

/** Uma vez: remove SW/cache antigos que serviam bundle desatualizado. */
async function resetLegacyServiceWorkerOnce(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  try {
    if (localStorage.getItem(SW_RESET_KEY)) return false;
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length === 0) {
      localStorage.setItem(SW_RESET_KEY, '1');
      return false;
    }
    await Promise.all(regs.map((r) => r.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    localStorage.setItem(SW_RESET_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

function setupServiceWorkerReloadGuard() {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

function registerProductionServiceWorker() {
  void resetLegacyServiceWorkerOnce().then((didReset) => {
    if (didReset) window.location.reload();
  });

  setupServiceWorkerReloadGuard();

  const applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      markPwaUpdateAvailable();
    },
    onRegisteredSW(_swUrl, registration) {
      swRegistration = registration;
    },
    onRegisterError(error) {
      console.error('[PWA] Falha ao registrar o Service Worker:', error);
    },
  });
  bindPwaApplyUpdate(applyUpdate);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkServiceWorkerUpdate();
    }
  });

  window.setInterval(() => {
    if (document.visibilityState === 'visible') checkServiceWorkerUpdate();
  }, SW_CHECK_INTERVAL_MS);
}

function bootstrapApp() {
  if (import.meta.env.PROD && isCanonicalAppOrigin()) {
    const scheduleSw = () => registerProductionServiceWorker();
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(scheduleSw, { timeout: 4000 });
    } else {
      window.setTimeout(scheduleSw, 2000);
    }
  } else if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        void registration.unregister();
      }
    });
  }

  const rootEl = document.getElementById('root');
  if (!rootEl) {
    throw new Error('#root não encontrado');
  }

  try {
    sessionStorage.removeItem('axecloud_stale_boot_retries');
  } catch {
    /* */
  }
  document.getElementById('axecloud-boot')?.remove();
  document.getElementById('axecloud-seo-static')?.remove();
  cleanBrowserUrl();

  createRoot(rootEl).render(
    <StrictMode>
      <AppErrorBoundary>
        <PwaUpdateBanner />
        <EmergencyReloadBeacon />
        <AppRouter />
        <VercelInsights />
      </AppErrorBoundary>
    </StrictMode>,
  );
}

if (!redirectToCanonicalOriginIfNeeded()) {
  if (import.meta.env.PROD && isMarketingDocumentPath(window.location.pathname)) {
    void escapeAppBundleOnMarketingUrl().then((escaped) => {
      if (!escaped) window.location.replace('/');
    });
  } else {
    bootstrapApp();
  }
}
