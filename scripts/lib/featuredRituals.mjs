const origin = 'https://axecloud.com.br';
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dateLabel = (ritual) => new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo',
}).format(new Date(`${ritual.date}T12:00:00-03:00`));
const priceLabel = (ritual) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
}).format(ritual.price);

export const ritualPath = (ritual) => `/eventos/${ritual.slug}`;
export const isRitualActive = (ritual, now = new Date()) => new Date(now).getTime() < new Date(ritual.expiresAt).getTime();

export function ritualWhatsAppUrl(ritual, archived = false) {
  const date = ritual.date.split('-').reverse().join('/');
  const message = archived
    ? `Olá! Conheci o ${ritual.temple} pelo AxéCloud e gostaria de saber sobre os próximos rituais.`
    : `Olá! Vi o anúncio de ${ritual.title}, de ${date}, no AxéCloud e gostaria de saber como participar.`;
  return `https://wa.me/${ritual.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function renderFeaturedRituals(rituals, now = new Date()) {
  const active = rituals.filter((ritual) => isRitualActive(ritual, now));
  if (!active.length) return '';
  return `<section class="ritual-promotions" id="rituais-em-destaque" aria-labelledby="ritual-promotions-title">
    <div class="ritual-promotions-heading">
      <h2 id="ritual-promotions-title">Rituais em destaque</h2>
      <p>Divulgação do templo</p>
    </div>
    <div class="ritual-promotions-track">
      ${active.map((ritual) => `<article class="ritual-promotion" data-ritual-id="${escape(ritual.id)}" data-ritual-until="${escape(ritual.expiresAt)}">
        <a class="ritual-promotion-link" href="${ritualPath(ritual)}" data-ritual-action="details">
          <img class="ritual-promotion-image" src="${escape(ritual.image)}" width="853" height="1280" loading="lazy" decoding="async" alt="Cartaz de ${escape(ritual.title)}" />
          <div class="ritual-promotion-content">
            <time datetime="${ritual.date}">${escape(dateLabel(ritual))}</time>
            <h3>${escape(ritual.title)}</h3>
            <p class="ritual-promotion-temple">${escape(ritual.temple)}</p>
            <div class="ritual-promotion-bottom"><strong>${escape(priceLabel(ritual))}</strong><span>Ver ritual <span aria-hidden="true">↗</span></span></div>
          </div>
        </a>
      </article>`).join('\n')}
    </div>
  </section>`;
}

export function renderRitualPage(ritual, now = new Date()) {
  const active = isRitualActive(ritual, now);
  const title = `${ritual.title} em ${ritual.date.split('-').reverse().join('/')} | AxéCloud`;
  const description = `${ritual.title}, em ${dateLabel(ritual)}, pelo ${ritual.temple}. Valor: ${priceLabel(ritual)}. Saiba como participar pelo WhatsApp do templo.`;
  const schema = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebPage', name: ritual.title,
    url: `${origin}${ritualPath(ritual)}`, description,
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Terreiros', item: `${origin}/terreiros` },
      { '@type': 'ListItem', position: 2, name: ritual.title, item: `${origin}${ritualPath(ritual)}` },
    ] },
  }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${origin}${ritualPath(ritual)}" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:title" content="${escape(title)}" />
  <meta property="og:description" content="${escape(description)}" />
  <meta property="og:url" content="${origin}${ritualPath(ritual)}" />
  <meta property="og:image" content="${origin}${escape(ritual.image)}" />
  <meta property="og:image:width" content="853" />
  <meta property="og:image:height" content="1280" />
  <meta property="og:image:alt" content="Cartaz de ${escape(ritual.title)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="preload" href="/fonts/manrope-variable.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="/terreiros-v2.css" />
  <link rel="stylesheet" href="/rituais.css" />
  <script type="application/ld+json">${schema}</script>
  <script defer src="/rituais.js"></script>
</head>
<body class="ritual-page" id="inicio">
  <a class="skip-link" href="#ritual-title">Ir para o ritual</a>
  <header class="cx-header ritual-site-header">
    <a class="cx-brand" href="/" aria-label="AxéCloud, página inicial"><span class="cx-brand-trident" aria-hidden="true"></span><strong><span>Axé</span><em>Cloud</em></strong></a>
    <a class="ritual-back" href="/terreiros">Voltar aos terreiros</a>
  </header>
  <main class="ritual-detail" data-ritual-id="${escape(ritual.id)}" data-ritual-until="${escape(ritual.expiresAt)}" data-ritual-detail>
    <nav class="ritual-breadcrumb" aria-label="Caminho da página"><a href="/terreiros">Terreiros</a><span aria-hidden="true">/</span><span>${escape(ritual.title)}</span></nav>
    <div class="ritual-detail-layout">
      <section class="ritual-detail-copy" aria-labelledby="ritual-title">
        <h1 id="ritual-title" tabindex="-1">${escape(ritual.title)}</h1>
        <p class="ritual-detail-temple">${escape(ritual.temple)}</p>
        <p class="ritual-detail-description">${escape(ritual.description)}</p>
        <dl class="ritual-facts"><div><dt>Data</dt><dd><time datetime="${ritual.date}">${escape(dateLabel(ritual))}</time></dd></div><div><dt>Valor</dt><dd>${escape(priceLabel(ritual))}</dd></div></dl>
        <p class="ritual-archive-note" role="status"${active ? ' hidden' : ''}>A data deste ritual já passou. Fale com o templo para conhecer as próximas atividades.</p>
        <div class="ritual-contact">
          <a class="ritual-whatsapp" href="${escape(ritualWhatsAppUrl(ritual, !active))}" target="_blank" rel="noopener noreferrer" data-ritual-action="whatsapp" data-upcoming-url="${escape(ritualWhatsAppUrl(ritual, true))}">${active ? 'Tirar dúvidas pelo WhatsApp' : 'Consultar próximos rituais'}</a>
          <p>Fale diretamente com o templo para saber como participar.</p>
          <a class="ritual-contact-number" href="${escape(ritualWhatsAppUrl(ritual, !active))}" target="_blank" rel="noopener noreferrer" data-ritual-action="whatsapp" data-upcoming-url="${escape(ritualWhatsAppUrl(ritual, true))}" aria-label="WhatsApp do templo: (11) 97069-7597">(11) 97069-7597</a>
        </div>
        <p class="ritual-publisher">Divulgação do templo. Informações e participação com o responsável.</p>
      </section>
      <div class="ritual-poster-column">
        <figure class="ritual-poster"><a href="${escape(ritual.image)}" target="_blank" rel="noopener noreferrer" aria-label="Ampliar cartaz de ${escape(ritual.title)}"><img src="${escape(ritual.image)}" width="853" height="1280" fetchpriority="high" alt="Cartaz completo de ${escape(ritual.title)}, em ${escape(dateLabel(ritual))}, valor ${escape(priceLabel(ritual))}. Texto transcrito abaixo." /></a><figcaption>Toque no cartaz para ampliar.</figcaption></figure>
        <details class="ritual-transcript"><summary>Ler o texto do cartaz</summary><div><p>Texto de divulgação fornecido pelo templo:</p>${(ritual.posterText || []).map((paragraph) => `<p>${escape(paragraph)}</p>`).join('')}</div></details>
      </div>
    </div>
  </main>
  <footer class="ritual-page-footer"><a href="/terreiros">Encontrar um terreiro</a><a href="/eventos">Ver agenda de eventos</a><span>AxéCloud</span></footer>
</body>
</html>`;
}
