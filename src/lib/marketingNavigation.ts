import { isAppSpaPath } from './appHref';
import { isMarketingSitePath, normalizePath } from './routes';

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

  if (options?.replace) window.history.replaceState(null, '', next);
  else window.history.pushState(null, '', next);

  notifyMarketingPathChange();

  if (url.hash) requestAnimationFrame(() => scrollToHash(url.hash));
  else window.scrollTo({ top: 0, behavior: 'auto' });
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
  return isMarketingSitePath(normalizePath(url.pathname));
}

export function installMarketingClientNavigation() {
  const onClick = (event: MouseEvent) => {
    const anchor = (event.target as Element | null)?.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (!shouldHandleMarketingLink(anchor, event)) return;
    event.preventDefault();
    navigateMarketing(anchor.getAttribute('href')!);
  };

  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
