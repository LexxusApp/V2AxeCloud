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
let swWaiting = false;
let lastSwCheck = 0;
const SW_CHECK_DEBOUNCE_MS = 30 * 60 * 1000; // 30 min entre checagens

/**
 * Não fazemos hard reload automático em onNeedRefresh — isso causava loop em
 * mobile (toda visita aciona um deploy novo no Vercel → reload → repete).
 * Em vez disso, marcamos `swWaiting` e ativamos a nova versão apenas em
 * transições "seguras" (usuário deslogado ou voltando do background sem sessão).
 *
 * Para forçar atualização imediata, o usuário pode tocar no
 * `EmergencyReloadBeacon` (canto inferior direito) ou apertar refresh manual.
 */
function checkServiceWorkerUpdate() {
  const now = Date.now();
  if (now - lastSwCheck < SW_CHECK_DEBOUNCE_MS) return;
  lastSwCheck = now;
  void swRegistration?.update().catch(() => {
    /* offline ou SW indisponível */
  });
}

function userHasSupabaseSession(): boolean {
  try {
    const raw = localStorage.getItem('axecloud-auth-token');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!parsed?.access_token || !!parsed?.currentSession?.access_token;
  } catch {
    return false;
  }
}

function activateWaitingSwIfSafe() {
  if (!swWaiting) return;
  // Só ativa se NÃO houver sessão ativa (Login screen) — preserva quem está usando.
  if (userHasSupabaseSession()) return;
  try {
    swRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  } catch {
    /* noop */
  }
}

if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      // Nova versao em waiting — NAO recarregamos automaticamente.
      // Quem estiver em telas de uso continua trabalhando com a versao atual.
      // Em transicoes seguras (login screen, foreground após logout), ativamos.
      swWaiting = true;
      console.info('[PWA] Nova versão disponível em waiting.');
    },
    onRegisteredSW(swUrl, registration) {
      swRegistration = registration;
      console.info('[PWA] Service Worker ativo:', swUrl, registration?.scope);
    },
    onRegisterError(error) {
      console.error('[PWA] Falha ao registrar o Service Worker:', error);
    },
  });

  // Checagem espacada (uma vez a cada 30 min, no maximo).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkServiceWorkerUpdate();
      activateWaitingSwIfSafe();
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
