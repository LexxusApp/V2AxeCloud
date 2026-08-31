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
  const html = escapeHtml(body);
  const labels: Readonly<Record<string, string>> = {
    'https://axecloud.com.br/sistema-de-gestao-para-terreiros': 'sistema de gestão para terreiros',
    'https://axecloud.com.br/financeiro-para-terreiros': 'financeiro para terreiros',
    'https://axecloud.com.br/mensalidades-para-terreiros': 'mensalidades para terreiros',
    'https://axecloud.com.br/gestao-de-filhos-de-santo': 'gestão de filhos de santo',
    'https://axecloud.com.br/por-que-axecloud/vs-planilhas': 'AxéCloud vs planilhas',
    'https://axecloud.com.br/por-que-axecloud#pwa-head': 'comparativo de gestão de terreiros (PWA)',
    'https://axecloud.com.br/por-que-axecloud': 'comparativo de gestão de terreiros',
    'https://axecloud.com.br/recursos/financeiro-pix-mensalidades': 'financeiro Pix e mensalidades',
    'https://axecloud.com.br/recursos/calendario-giras': 'calendário de giras',
    'https://axecloud.com.br/recursos/portal-filho-de-santo': 'portal do filho de santo',
    'https://axecloud.com.br/recursos/whatsapp-oficial': 'WhatsApp oficial para terreiro',
    'https://axecloud.com.br/recursos/app-pwa-terreiro': 'app PWA para terreiro',
    'https://axecloud.com.br/recursos': 'recursos de gestão de terreiros',
    'https://axecloud.com.br/register': 'teste grátis de gestão de terreiros',
    'https://axecloud.com.br/': 'gestão de terreiros',
  };

  // Uma única passagem impede que uma regra posterior volte a processar o href
  // criado por uma regra anterior. O comportamento antigo gerava âncoras dentro
  // de âncoras e fez o Google descobrir URLs como /recursos/%3Ca%20href=.
  return html.replace(
    /https:\/\/axecloud\.com\.br(?:\/[^\s<>"'.,;)]*)?/g,
    (url) => {
      const label = labels[url]
        || (url.includes('/conteudo/') ? 'guia do AxéCloud'
          : url.includes('/recursos/') ? 'recurso do AxéCloud'
            : 'AxéCloud');
      return `<a href="${url}">${label}</a>`;
    },
  );
}
