import { PORTAL_ARTICLE_PATHS } from '../content/portalContent';

/** Rotas públicas e do app (SPA Vite — equivalente conceitual ao App Router do Next). */
export function isHomePath(path: string): boolean {
  const p = path.replace(/\/+$/, '') || '/';
  return p === '/' || p === '';
}

export const ROUTES = {
  home: '/',
  login: '/entrar',
  /** @deprecated Use ROUTES.login — redirect 301 em produção (Caddy). */
  loginLegacy: '/login',
  register: '/register',
  checkout: '/checkout',
  /** Renovação de assinatura (zelador logado) — checkout EFI separado do cadastro. */
  renewSubscription: '/assinatura/renovar',
  dashboard: '/dashboard',
  terms: '/termos',
  privacy: '/privacidade',
  founderProgram: '/programa-fundador',
  contentHub: '/conteudo',
  contentArticle: '/conteudo/como-o-axecloud-ajuda-terreiros',
  glossary: '/conteudo/glossario',
  consulentePortal: '/consulente',
  espacoDoFiel: '/espaco-do-fiel',
  terreiros: '/terreiros',
  eventosPublicos: '/eventos',
  liturgicalCalendar: '/conteudo/calendario-liturgico',
  eventRsvp: '/convite',
  giraCheckin: '/checkin',
  giraSenhas: '/senhas',
} as const;

/** Checkout EFI no cadastro (passo 2) — exige `?tenant=` do registro. */
export function checkoutPathForTenant(tenantId: string | null | undefined): string | null {
  const id = String(tenantId || '').trim();
  if (!id) return null;
  return `${ROUTES.checkout}?tenant=${encodeURIComponent(id)}`;
}

/** Renovação de assinatura no painel (zelador logado). */
export function renewSubscriptionPath(tenantId?: string | null): string {
  const id = String(tenantId || '').trim();
  if (!id) return ROUTES.renewSubscription;
  return `${ROUTES.renewSubscription}?tenant=${encodeURIComponent(id)}`;
}

export function terreiroProfilePath(slug: string): string {
  return `/terreiros/${encodeURIComponent(slug)}`;
}

export function terreirosCityPath(citySlug: string): string {
  return `/terreiros/cidade/${encodeURIComponent(citySlug)}`;
}

export function eventRsvpPath(token: string, action: 'confirmar' | 'declinar'): string {
  return `/convite/${encodeURIComponent(token)}/${action}`;
}

export function consulentePortalPath(slug: string): string {
  return `/consulente/${encodeURIComponent(slug)}`;
}

/** Rotas servidas pelo site de marketing estático (Caddy → container marketing). */
export const MARKETING_SITE_PATHS = [
  ROUTES.home,
  ROUTES.terms,
  ROUTES.privacy,
  ROUTES.founderProgram,
  ROUTES.espacoDoFiel,
  ROUTES.terreiros,
  ROUTES.eventosPublicos,
  ROUTES.liturgicalCalendar,
  ROUTES.contentHub,
  ROUTES.glossary,
  ...PORTAL_ARTICLE_PATHS,
] as const;

/** Rotas de marketing indexáveis (portal + landing). */
export const PUBLIC_MARKETING_PATHS = [
  ROUTES.home,
  ROUTES.register,
  ROUTES.checkout,
  ROUTES.founderProgram,
  ROUTES.espacoDoFiel,
  ROUTES.terreiros,
  ROUTES.eventosPublicos,
  ROUTES.liturgicalCalendar,
  ROUTES.contentHub,
  ROUTES.glossary,
  ...PORTAL_ARTICLE_PATHS,
] as const;

export function isMarketingSitePath(path: string): boolean {
  const p = normalizePath(path);
  if ((MARKETING_SITE_PATHS as readonly string[]).includes(p)) return true;
  if (p.startsWith(`${ROUTES.terreiros}/`)) return true;
  return false;
}

export function normalizePath(pathname: string): string {
  const p = (pathname || '/').replace(/\/+$/, '') || '/';
  return p;
}

export function isPublicMarketingPath(path: string): boolean {
  return (PUBLIC_MARKETING_PATHS as readonly string[]).includes(path);
}
