import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { redirectToCanonicalOriginIfNeeded } from '../lib/canonicalOrigin';
import {
  MARKETING_REDIRECT_ATTEMPTS_KEY,
  MARKETING_SW_FIX_KEY,
} from '../lib/marketingDocumentGuard';
import { purgeLegacyAppServiceWorker } from '../lib/purgeServiceWorker';
import { cleanBrowserUrl } from '../lib/urlHygiene';
import MarketingRouter from './MarketingRouter';
import '../index.css';

function bootstrapMarketing() {
  document.getElementById('axecloud-seo-static')?.remove();
  document.getElementById('axecloud-boot')?.remove();
  cleanBrowserUrl();

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
    sessionStorage.removeItem(MARKETING_SW_FIX_KEY);
    sessionStorage.removeItem(MARKETING_REDIRECT_ATTEMPTS_KEY);
  } catch {
    /* */
  }

  void purgeLegacyAppServiceWorker();
}

if (!redirectToCanonicalOriginIfNeeded()) {
  bootstrapMarketing();
}
