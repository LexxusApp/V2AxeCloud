import { isAppSpaPath } from './appHref';
import { ROUTES, isMarketingSitePath, normalizePath } from './routes';

export const MARKETING_NAVIGATE_EVENT = 'axecloud:marketing-navigate';

export function notifyMarketingPathChange() {
  window.dispatchEvent(new Event(MARKETING_NAVIGATE_EVENT));
}

function scrollToHash(hash: string) {
  const id = hash.replace(/^#/, '');
  if (!id) {
    window.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else window.scrollTo({ top: 0, behavior: 'auto' });
}

const prefetched = new Set<string>();

/** Prefetch de chunks de marketing — hover/idle sem bloquear a UI. */
export function prefetchMarketingRoute(to: string) {
  if (typeof window === 'undefined') return;
  let path: string;
  try {
    path = normalizePath(new URL(to, window.location.origin).pathname);
  } catch {
    return;
  }
  if (prefetched.has(path)) return;
  prefetched.add(path);

  const loaders: Record<string, () => Promise<unknown>> = {
    [ROUTES.home]: () => import('../views/Landing'),
    [ROUTES.whyAxeCloud]: () => import('../views/PorQueAxeCloudPage'),
    [ROUTES.whyVsPlanilhas]: () => import('../views/VsPlanilhasPage'),
    [ROUTES.recursos]: () => import('../views/FeatureHubPage'),
    [ROUTES.contentHub]: () => import('../views/ContentHubPage'),
    [ROUTES.glossary]: () => import('../views/GlossaryPage'),
    [ROUTES.espacoDoFiel]: () => import('../views/EspacoDoFielPage'),
    [ROUTES.terreiros]: () => import('../views/portal/TerreirosDirectoryPage'),
    [ROUTES.eventosPublicos]: () => import('../views/portal/EventosPublicPage'),
    [ROUTES.terms]: () => import('../pages/TermsPage'),
    [ROUTES.privacy]: () => import('../pages/PrivacyPage'),
    [ROUTES.register]: () => import('../views/Register'),
    [ROUTES.liturgicalCalendar]: () => import('../views/portal/LiturgicalCalendarPage'),
  };

  const loader = loaders[path];
  if (loader) void loader().catch(() => prefetched.delete(path));

  if (path.startsWith(`${ROUTES.recursos}/`)) {
    void import('../views/FeaturePage').catch(() => prefetched.delete(path));
  }
  if (path.startsWith('/conteudo/') && path !== ROUTES.contentHub && path !== ROUTES.glossary) {
    void import('../views/PortalArticlePage').catch(() => prefetched.delete(path));
  }
}

/** Navegação client-side entre páginas de marketing — mantém o menu montado. */
export function navigateMarketing(to: string, options?: { replace?: boolean }) {
  const url = new URL(to, window.location.origin);
  if (url.origin !== window.location.origin) {
    window.location.assign(url.href);
    return;
  }

  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;

  const nextPath = normalizePath(url.pathname);
  if (!isMarketingSitePath(nextPath)) {
    window.location.assign(url.href);
    return;
  }

  prefetchMarketingRoute(nextPath);

  if (options?.replace) window.history.replaceState(null, '', next);
  else window.history.pushState(null, '', next);

  notifyMarketingPathChange();

  requestAnimationFrame(() => {
    if (url.hash) scrollToHash(url.hash);
    else window.scrollTo({ top: 0, behavior: 'auto' });
  });
}

export function shouldHandleMarketingLink(anchor: HTMLAnchorElement, event: MouseEvent): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target && anchor.target !== '_self') return false;

  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) return false;

  let url: URL;
  try {
    url = new URL(href, window.location.origin);
  } catch {
    return false;
  }

  if (url.origin !== window.location.origin) return false;
  if (isAppSpaPath(normalizePath(url.pathname))) return false;

  const currentPath = normalizePath(window.location.pathname);
  const targetPath = normalizePath(url.pathname);

  // O domínio público é composto por frontends diferentes (home, páginas
  // cinematográficas e diretório). Trocas de página precisam chegar ao
  // servidor para que ele selecione o frontend correto. Interceptamos apenas
  // âncoras da própria página, mantendo a rolagem suave sem ressuscitar o SPA
  // legado em cliques como o logo ou "Voltar para o Mapa".
  if (targetPath !== currentPath) return false;
  return Boolean(url.hash) && isMarketingSitePath(targetPath);
}

export function installMarketingClientNavigation() {
  const onClick = (event: MouseEvent) => {
    const anchor = (event.target as Element | null)?.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (!shouldHandleMarketingLink(anchor, event)) return;
    event.preventDefault();
    navigateMarketing(anchor.getAttribute('href')!);
  };

  const onPointerEnter = (event: Event) => {
    const anchor = (event.target as Element | null)?.closest?.('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;
    try {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (isMarketingSitePath(normalizePath(url.pathname))) prefetchMarketingRoute(url.pathname);
    } catch {
      /* ignore */
    }
  };

  document.addEventListener('click', onClick);
  document.addEventListener('pointerenter', onPointerEnter, true);
  return () => {
    document.removeEventListener('click', onClick);
    document.removeEventListener('pointerenter', onPointerEnter, true);
  };
}
