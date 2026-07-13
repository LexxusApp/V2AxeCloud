import { getOrCreateVisitorId } from './trackPublicVisit';

export type ConversionEventName =
  | 'cta_click'
  | 'register_view'
  | 'register_started'
  | 'register_failed';

const SESSION_KEY = 'axecloud_conversion_sid';
const ATTRIBUTION_KEY = 'axecloud_conversion_attribution';

type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  landingPath?: string;
};

function getOrCreateSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (sessionId && /^[0-9a-f-]{36}$/i.test(sessionId)) return sessionId;
  sessionId = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, sessionId);
  return sessionId;
}

function getAttribution(): Attribution {
  try {
    const stored = localStorage.getItem(ATTRIBUTION_KEY);
    if (stored) return JSON.parse(stored) as Attribution;
    const params = new URLSearchParams(window.location.search);
    const attribution: Attribution = {
      source: params.get('utm_source') || undefined,
      medium: params.get('utm_medium') || undefined,
      campaign: params.get('utm_campaign') || undefined,
      content: params.get('utm_content') || undefined,
      term: params.get('utm_term') || undefined,
      landingPath: `${window.location.pathname}${window.location.search}`.slice(0, 500),
    };
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    return attribution;
  } catch {
    return {};
  }
}

export function getConversionContext() {
  if (typeof window === 'undefined') return {};
  return {
    visitorId: getOrCreateVisitorId(),
    sessionId: getOrCreateSessionId(),
    path: window.location.pathname,
    referrer: document.referrer || null,
    attribution: getAttribution(),
  };
}

export async function trackConversionEvent(
  eventName: ConversionEventName,
  details: { ctaId?: string; ctaLabel?: string; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    await fetch('/api/metrics/conversion-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        eventName,
        ...getConversionContext(),
        ctaId: details.ctaId,
        ctaLabel: details.ctaLabel,
        metadata: details.metadata,
      }),
    });
  } catch {
    /* Métricas nunca bloqueiam a navegação ou o cadastro. */
  }
}
