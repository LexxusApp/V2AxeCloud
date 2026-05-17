/** Rotas públicas e do app (SPA Vite — equivalente conceitual ao App Router do Next). */
export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  checkout: '/checkout',
  dashboard: '/dashboard',
  terms: '/termos',
  privacy: '/privacidade',
} as const;

export function normalizePath(pathname: string): string {
  const p = (pathname || '/').replace(/\/+$/, '') || '/';
  return p;
}

export function isPublicMarketingPath(path: string): boolean {
  return path === ROUTES.home || path === ROUTES.register || path === ROUTES.checkout;
}
