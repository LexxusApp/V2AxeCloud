import {Analytics} from '@vercel/analytics/react';
import {SpeedInsights} from '@vercel/speed-insights/react';

/** Só monta em *.vercel.app (ou com VITE_ENABLE_VERCEL_INSIGHTS=1) — evita ERR_NAME_NOT_RESOLVED em domínio customizado sem Web Analytics. */
export function VercelInsights() {
  if (!import.meta.env.PROD || typeof window === 'undefined') return null;

  const host = window.location.hostname;
  const onVercelHost = host.endsWith('.vercel.app');
  const forced = import.meta.env.VITE_ENABLE_VERCEL_INSIGHTS === '1';
  if (!onVercelHost && !forced) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
