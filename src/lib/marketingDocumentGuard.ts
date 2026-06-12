import { isMarketingSitePath, normalizePath } from './routes';
import { purgeLegacyAppServiceWorker } from './purgeServiceWorker';

export const MARKETING_SW_FIX_KEY = 'axecloud_app_on_marketing_fix';
export const MARKETING_REDIRECT_ATTEMPTS_KEY = 'axecloud_marketing_redirect_attempts';

export function isMarketingDocumentPath(pathname: string): boolean {
  return isMarketingSitePath(normalizePath(pathname));
}

/** Bundle do app carregado em URL de marketing — remove SW e força documento da rede. */
export async function escapeAppBundleOnMarketingUrl(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!isMarketingDocumentPath(window.location.pathname)) return false;

  const attempts = parseInt(sessionStorage.getItem(MARKETING_REDIRECT_ATTEMPTS_KEY) || '0', 10);
  if (attempts >= 3) return false;

  sessionStorage.setItem(MARKETING_REDIRECT_ATTEMPTS_KEY, String(attempts + 1));

  await purgeLegacyAppServiceWorker();
  await new Promise((r) => window.setTimeout(r, 120));

  const url = new URL(window.location.href);
  url.searchParams.delete('_swfix');
  url.searchParams.delete('_nocache');
  window.location.replace(url.pathname + url.search + url.hash);
  return true;
}
