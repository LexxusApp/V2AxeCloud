export type SiteVerificationConfig = {
  google?: string;
  bing?: string;
};

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Lê tokens de verificação de propriedade (Search Console / Bing Webmaster). */
export function readSiteVerificationFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): SiteVerificationConfig {
  const google = String(env.GOOGLE_SITE_VERIFICATION || '').trim();
  const bing = String(env.BING_SITE_VERIFICATION || '').trim();
  return {
    ...(google ? { google } : {}),
    ...(bing ? { bing } : {}),
  };
}

/** Meta tags para verificação de propriedade do site. */
export function buildSiteVerificationMetaHtml(config: SiteVerificationConfig): string {
  const lines: string[] = [];
  if (config.google) {
    lines.push(
      `<meta name="google-site-verification" content="${escapeHtmlAttr(config.google)}" />`,
    );
  }
  if (config.bing) {
    lines.push(`<meta name="msvalidate.01" content="${escapeHtmlAttr(config.bing)}" />`);
  }
  return lines.join('\n    ');
}

const VERIFICATION_MARKER = /<!-- SEO_VERIFICATION_INJECT -->[\s\S]*?<!-- \/SEO_VERIFICATION_INJECT -->/;

/** Injeta meta de verificação no HTML (build estático ou resposta do servidor). */
export function injectSiteVerificationHtml(
  html: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  const meta = buildSiteVerificationMetaHtml(readSiteVerificationFromEnv(env));
  if (!meta) {
    return html.replace(VERIFICATION_MARKER, '<!-- SEO_VERIFICATION_INJECT -->\n    <!-- /SEO_VERIFICATION_INJECT -->');
  }

  if (VERIFICATION_MARKER.test(html)) {
    return html.replace(
      VERIFICATION_MARKER,
      `<!-- SEO_VERIFICATION_INJECT -->\n    ${meta}\n    <!-- /SEO_VERIFICATION_INJECT -->`,
    );
  }

  if (html.includes('google-site-verification') || html.includes('msvalidate.01')) {
    return html;
  }

  return html.replace('</head>', `    ${meta}\n  </head>`);
}
