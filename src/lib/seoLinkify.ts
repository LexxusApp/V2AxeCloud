function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Converte URLs públicas do AxéCloud em âncoras com texto alvo de SEO.
 * Usado no prerender estático e nos artigos do hub /conteudo.
 */
export function linkifyAxecloudArticleBody(body: string): string {
  let html = escapeHtml(body);

  const rules: { pattern: RegExp; label: string }[] = [
    {
      pattern: /https:\/\/axecloud\.com\.br\/por-que-axecloud#pwa-head/g,
      label: 'comparativo de gestão de terreiros (PWA)',
    },
    {
      pattern: /https:\/\/axecloud\.com\.br\/por-que-axecloud/g,
      label: 'comparativo de gestão de terreiros',
    },
    {
      pattern: /https:\/\/axecloud\.com\.br\/register/g,
      label: 'teste grátis de gestão de terreiros',
    },
    {
      pattern: /https:\/\/axecloud\.com\.br\/(?=\s|[.,;)]|$)/g,
      label: 'gestão de terreiros',
    },
  ];

  for (const { pattern, label } of rules) {
    html = html.replace(pattern, (url) => `<a href="${url}">${label}</a>`);
  }

  return html;
}
