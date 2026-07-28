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
      pattern: /https:\/\/axecloud\.com\.br\/por-que-axecloud\/vs-planilhas/g,
      label: 'AxéCloud vs planilhas',
    },
    {
      pattern: /https:\/\/axecloud\.com\.br\/por-que-axecloud#pwa-head/g,
      label: 'comparativo de gestão de terreiros (PWA)',
    },
    {
      pattern: /https:\/\/axecloud\.com\.br\/por-que-axecloud/g,
      label: 'comparativo de gestão de terreiros',
    },
    {
      pattern: /https:\/\/axecloud\.com\.br\/recursos\/financeiro-pix-mensalidades/g,
      label: 'financeiro Pix e mensalidades',
    },
    {
      pattern: /https:\/\/axecloud\.com\.br\/recursos\/calendario-giras/g,
      label: 'calendário de giras',
    },
    {
      pattern: /https:\/\/axecloud\.com\.br\/recursos\/portal-filho-de-santo/g,
      label: 'portal do filho de santo',
    },
    {
      pattern: /https:\/\/axecloud\.com\.br\/recursos\/whatsapp-oficial/g,
      label: 'WhatsApp oficial para terreiro',
    },
    {
      pattern: /https:\/\/axecloud\.com\.br\/recursos\/app-pwa-terreiro/g,
      label: 'app PWA para terreiro',
    },
    {
      pattern: /https:\/\/axecloud\.com\.br\/recursos/g,
      label: 'recursos de gestão de terreiros',
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
