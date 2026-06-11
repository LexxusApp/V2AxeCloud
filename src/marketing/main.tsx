import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { redirectToCanonicalOriginIfNeeded } from '../lib/canonicalOrigin';
import { purgeLegacyAppServiceWorker } from '../lib/purgeServiceWorker';
import MarketingRouter from './MarketingRouter';
import '../index.css';

function bootstrapMarketing() {
  document.getElementById('axecloud-seo-static')?.remove();
  document.getElementById('axecloud-boot')?.remove();

  const rootEl = document.getElementById('root');
  if (!rootEl) {
    throw new Error('#root não encontrado');
  }

  createRoot(rootEl).render(
    <StrictMode>
      <AppErrorBoundary>
        <MarketingRouter />
      </AppErrorBoundary>
    </StrictMode>,
  );

  try {
    sessionStorage.removeItem('axecloud_marketing_sw_fixup');
  } catch {
    /* */
  }

  void purgeLegacyAppServiceWorker();
}

if (!redirectToCanonicalOriginIfNeeded()) {
  bootstrapMarketing();
}
