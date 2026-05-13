import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import {Analytics} from '@vercel/analytics/react';
import {SpeedInsights} from '@vercel/speed-insights/react';
import {PwaInstallProvider} from './contexts/PwaInstallContext';
import {EmergencyReloadBeacon} from './components/EmergencyReloadBeacon';
import App from './App.tsx';
import './index.css';

let swRegistration: ServiceWorkerRegistration | undefined;
let reloadingFromSwUpdate = false;

function hardReloadForSwUpdate() {
  if (reloadingFromSwUpdate) return;
  reloadingFromSwUpdate = true;
  window.location.reload();
}

function checkServiceWorkerUpdate() {
  void swRegistration?.update().catch(() => {
    /* offline ou SW indisponível */
  });
}

if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      // Nova versão publicada — reload completo para não ficar preso em bundle/cache antigo
      hardReloadForSwUpdate();
    },
    onRegisteredSW(swUrl, registration) {
      swRegistration = registration;
      console.info('[PWA] Service Worker ativo:', swUrl, registration?.scope);
    },
    onRegisterError(error) {
      console.error('[PWA] Falha ao registrar o Service Worker:', error);
    },
  });

  /** Ao voltar ao app (mobile/PWA), verifica atualização do SW — evita estado quebrado após deploy. */
  window.addEventListener('focus', checkServiceWorkerUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkServiceWorkerUpdate();
    }
  });
} else if ('serviceWorker' in navigator) {
  // Em desenvolvimento, removemos SW antigos para evitar tela em branco/caches presos.
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      void registration.unregister();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PwaInstallProvider>
      <EmergencyReloadBeacon />
      <App />
      <Analytics />
      <SpeedInsights />
    </PwaInstallProvider>
  </StrictMode>,
);
