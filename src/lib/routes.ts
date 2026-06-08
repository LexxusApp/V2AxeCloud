/** Rotas públicas e do app (SPA Vite — equivalente conceitual ao App Router do Next). */
export function isHomePath(path: string): boolean {
  const p = path.replace(/\/+$/, '') || '/';
  return p === '/' || p === '';
}

export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  checkout: '/checkout',
  dashboard: '/dashboard',
  terms: '/termos',
  privacy: '/privacidade',
  founderProgram: '/programa-fundador',
  contentHub: '/conteudo',
  contentArticle: '/conteudo/como-o-axecloud-ajuda-terreiros',
  glossary: '/conteudo/glossario',
  consulentePortal: '/consulente',
  eventRsvp: '/convite',
} as const;

export function eventRsvpPath(token: string, action: 'confirmar' | 'declinar'): string {
  return `/convite/${encodeURIComponent(token)}/${action}`;
}

export function consulentePortalPath(slug: string): string {
  return `/consulente/${encodeURIComponent(slug)}`;
}

/** Rotas de marketing indexáveis (portal + landing). */
export const PUBLIC_MARKETING_PATHS = [
  ROUTES.home,
  ROUTES.register,
  ROUTES.checkout,
  ROUTES.founderProgram,
  ROUTES.contentHub,
  ROUTES.contentArticle,
  ROUTES.glossary,
] as const;

export function normalizePath(pathname: string): string {
  const p = (pathname || '/').replace(/\/+$/, '') || '/';
  return p;
}

export function isPublicMarketingPath(path: string): boolean {
  return (PUBLIC_MARKETING_PATHS as readonly string[]).includes(path);
}
