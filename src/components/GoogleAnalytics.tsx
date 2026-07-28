import { useEffect } from 'react';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim();

function loadGa(measurementId: string) {
  if (typeof document === 'undefined') return;
  if (document.getElementById('axecloud-ga4')) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { anonymize_ip: true });

  const script = document.createElement('script');
  script.id = 'axecloud-ga4';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

/** GA4 opcional — só monta se `VITE_GA_MEASUREMENT_ID` estiver definido. */
export function GoogleAnalytics() {
  useEffect(() => {
    if (!import.meta.env.PROD || !GA_ID) return;
    loadGa(GA_ID);
  }, []);

  return null;
}

export function trackGaPageView(path: string) {
  if (!GA_ID || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: typeof window !== 'undefined' ? window.location.href : path,
  });
}
