import { normalizePath, ROUTES } from './routes';

const APP_DEV_ORIGIN =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_DEV_ORIGIN) ||
  'http://localhost:3000';

const MARKETING_DEV_ORIGIN =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MARKETING_DEV_ORIGIN) ||
  'http://localhost:5174';

const APP_SPA_PATHS = [
  ROUTES.login,
  ROUTES.register,
  ROUTES.checkout,
  ROUTES.dashboard,
  ROUTES.consulentePortal,
  ROUTES.eventRsvp,
  '/widget',
] as const;

/** Rotas servidas pelo SPA do app (login, painel, convites, etc.). */
export function isAppSpaPath(path: string): boolean {
  const p = normalizePath(path);
  return APP_SPA_PATHS.some(
    (base) => p === base || p.startsWith(`${base}/`),
  );
}

function devPort(): string {
  if (typeof window === 'undefined') return '';
  return window.location.port;
}

function isAppDevServer(): boolean {
  if (!import.meta.env.DEV) return false;
  const port = devPort();
  return port === '3000' || port === '';
}

function isMarketingDevServer(): boolean {
  if (!import.meta.env.DEV) return false;
  const port = devPort();
  if (port === '3000') return false;
  // Vite landing (5174, 5175 se ocupada, preview 4173, etc.)
  return port !== '';
}

/** Href correto para rotas do app — em dev na landing, aponta para :3000. */
export function appHref(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!import.meta.env.DEV || typeof window === 'undefined') return p;
  if (isAppDevServer()) return p;
  if (isMarketingDevServer() && isAppSpaPath(p)) {
    return `${APP_DEV_ORIGIN.replace(/\/$/, '')}${p}`;
  }
  return p;
}

/** Em dev no app (:3000), marketing vive em outra porta. */
export function marketingHref(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!import.meta.env.DEV || typeof window === 'undefined') return p;
  if (isMarketingDevServer()) return p;
  if (isAppDevServer()) {
    return `${MARKETING_DEV_ORIGIN.replace(/\/$/, '')}${p}`;
  }
  return p;
}

export function redirectToAppDevOriginIfNeeded(path: string): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  if (!isMarketingDevServer() || !isAppSpaPath(path)) return false;
  const target = appHref(path) + window.location.search + window.location.hash;
  if (window.location.href === target) return false;
  window.location.replace(target);
  return true;
}

export function redirectToMarketingDevOriginIfNeeded(path: string): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  if (!isAppDevServer()) return false;
  const p = normalizePath(path);
  if (isAppSpaPath(p)) return false;
  const target = marketingHref(p) + window.location.search + window.location.hash;
  if (window.location.href === target) return false;
  window.location.replace(target);
  return true;
}
