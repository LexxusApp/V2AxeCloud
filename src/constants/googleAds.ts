/** ID público da tag Google Ads (conversões). Sobrescreva com VITE_GOOGLE_ADS_ID se necessário. */
export const GOOGLE_ADS_ID =
  (import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined)?.trim() || 'AW-18367072937';

/** Snippet HTML para injeção no <head> (marketing estático / shell). */
export function buildGoogleAdsHeadSnippet(adsId: string = GOOGLE_ADS_ID): string {
  const id = adsId.replace(/[^A-Z0-9-]/gi, '');
  if (!id) return '';
  return [
    `<!-- Google tag (gtag.js) -->`,
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`,
    `<script>`,
    `window.dataLayer = window.dataLayer || [];`,
    `function gtag(){dataLayer.push(arguments);}`,
    `gtag('js', new Date());`,
    `gtag('config', '${id}');`,
    `</script>`,
  ].join('\n');
}
