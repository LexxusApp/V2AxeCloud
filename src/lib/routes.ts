/** Rotas públicas e do app (SPA Vite — equivalente conceitual ao App Router do Next). */
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
} as const;

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
