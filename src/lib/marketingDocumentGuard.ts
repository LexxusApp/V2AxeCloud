import { isMarketingSitePath, normalizePath } from './routes';
import { purgeLegacyAppServiceWorker } from './purgeServiceWorker';
import { cleanBrowserUrl } from './urlHygiene';

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

  // Só recarrega se houver SW antigo — sem isso, location.replace na mesma URL vira loop.
  let hasSw = false;
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      hasSw = regs.length > 0 || !!navigator.serviceWorker.controller;
    }
  } catch {
    hasSw = false;
  }
  if (!hasSw) return false;

  sessionStorage.setItem(MARKETING_REDIRECT_ATTEMPTS_KEY, String(attempts + 1));

  await purgeLegacyAppServiceWorker();
  await new Promise((r) => window.setTimeout(r, 120));

  cleanBrowserUrl();
  window.location.replace(window.location.pathname + window.location.hash);
  return true;
}
