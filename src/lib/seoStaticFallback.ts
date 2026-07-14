/** ID do bloco HTML estático injetado no build (pré-render para crawlers). */
export const SEO_STATIC_FALLBACK_ID = 'axecloud-seo-static';

/**
 * Após o React montar, remove o fallback estático para evitar títulos duplicados
 * na árvore de acessibilidade. Crawlers sem JavaScript continuam recebendo o HTML.
 */
export function hideSeoStaticFallbackAfterHydration(className: 'axecloud-marketing-ready' | 'axecloud-app-ready'): void {
  document.documentElement.classList.add(className);
  document.getElementById(SEO_STATIC_FALLBACK_ID)?.remove();
}
