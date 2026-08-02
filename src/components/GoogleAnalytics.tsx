import { useEffect } from 'react';
import { GOOGLE_ADS_ID } from '../constants/googleAds';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim();
const ADS_ID = GOOGLE_ADS_ID;

function ensureGtag() {
  if (typeof document === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  }
}

function loadGtagScript(primaryId: string) {
  if (document.getElementById('axecloud-gtag')) return;
  const script = document.createElement('script');
  script.id = 'axecloud-gtag';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primaryId)}`;
  document.head.appendChild(script);
}

function loadTags() {
  if (typeof document === 'undefined') return;
  // Snippet estático no <head> (marketing) já pode ter carregado o gtag.
  if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
    ensureGtag();
    if (GA_ID) window.gtag?.('config', GA_ID, { anonymize_ip: true });
    if (ADS_ID) window.gtag?.('config', ADS_ID);
    return;
  }

  const primaryId = GA_ID || ADS_ID;
  if (!primaryId) return;

  ensureGtag();
  window.gtag?.('js', new Date());
  if (GA_ID) window.gtag?.('config', GA_ID, { anonymize_ip: true });
  if (ADS_ID) window.gtag?.('config', ADS_ID);
  loadGtagScript(primaryId);
}

/** GA4 + Google Ads — Ads sempre ativo no marketing; GA4 só se VITE_GA_MEASUREMENT_ID existir. */
export function GoogleAnalytics() {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (!GA_ID && !ADS_ID) return;
    loadTags();
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
