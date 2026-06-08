import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { redirectToCanonicalOriginIfNeeded } from '../lib/canonicalOrigin';
import MarketingRouter from './MarketingRouter';
import '../index.css';

function bootstrapMarketing() {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    throw new Error('#root não encontrado');
  }

  document.getElementById('axecloud-seo-static')?.remove();
  document.getElementById('axecloud-boot')?.remove();

  createRoot(rootEl).render(
    <StrictMode>
      <AppErrorBoundary>
        <MarketingRouter />
      </AppErrorBoundary>
    </StrictMode>,
  );
}

if (!redirectToCanonicalOriginIfNeeded()) {
  bootstrapMarketing();
}
