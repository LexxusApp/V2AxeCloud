import { ROUTES, isMarketingSitePath, normalizePath } from './routes';

const VISITOR_KEY = 'axecloud_public_vid';
const TRACK_MARKER = 'axecloud_public_visit';
/** Páginas públicas onde contamos visitantes únicos (sem login). */
export function shouldTrackPublicVisit(path: string): boolean {
  const p = normalizePath(path);
  if (isMarketingSitePath(p)) return true;
  if (p === ROUTES.register || p === ROUTES.checkout) return true;
  if (p.startsWith('/consulente/')) return true;
  if (p.startsWith('/convite/')) return true;
  if (p.startsWith('/widget/')) return true;
  return false;
}

export function getOrCreateVisitorId(): string {
  let visitorId = localStorage.getItem(VISITOR_KEY);
  if (visitorId && /^[0-9a-f-]{36}$/i.test(visitorId)) return visitorId;
  visitorId = crypto.randomUUID();
  localStorage.setItem(VISITOR_KEY, visitorId);
  return visitorId;
}

/** Regista visitante único do site público (best-effort, 1x por dia por browser). */
export async function trackPublicVisit(pathname?: string): Promise<void> {
  try {
    if (typeof window === 'undefined') return;

    const path = pathname || window.location.pathname || '/';
    if (!shouldTrackPublicVisit(path)) return;

    const day = new Date().toISOString().slice(0, 10);
    const pathKey = normalizePath(path);
    const marker = `${TRACK_MARKER}:${day}:${pathKey}`;
    if (sessionStorage.getItem(marker)) return;

    const res = await fetch('/api/metrics/public-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: getOrCreateVisitorId(),
        path,
        referrer: document.referrer || null,
      }),
    });

    if (res.ok) sessionStorage.setItem(marker, '1');
  } catch {
    /* métricas não devem bloquear o site */
  }
}
