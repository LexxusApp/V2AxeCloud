/** ID público da tag Google Ads — espelha src/constants/googleAds.ts */
export const GOOGLE_ADS_ID = (process.env.VITE_GOOGLE_ADS_ID || 'AW-18367072937').trim();

export function buildGoogleAdsHeadSnippet(adsId = GOOGLE_ADS_ID) {
  const id = String(adsId || '').replace(/[^A-Z0-9-]/gi, '');
  if (!id) return '';
  return [
    '<!-- Google tag (gtag.js) -->',
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`,
    '<script>',
    'window.dataLayer = window.dataLayer || [];',
    'function gtag(){dataLayer.push(arguments);}',
    "gtag('js', new Date());",
    `gtag('config', '${id}');`,
    '</script>',
  ].join('\n');
}
