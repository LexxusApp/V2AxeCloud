/** ID do bloco HTML estático injetado no build (pré-render para crawlers). */
export const SEO_STATIC_FALLBACK_ID = 'axecloud-seo-static';

/**
 * Após o React montar, oculta o fallback estático sem removê-lo do DOM.
 * Crawlers e o Google ainda podem ler o HTML; usuários veem só a SPA.
 */
export function hideSeoStaticFallbackAfterHydration(className: 'axecloud-marketing-ready' | 'axecloud-app-ready'): void {
  document.documentElement.classList.add(className);
}
