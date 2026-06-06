import { buildPublicSiteNavHtml } from './seoPublicPages';
import { SOCIAL_SAME_AS } from './socialLinks';

/** Metadados e conteúdo estático da home — fonte única para HTML, JSON-LD e landing. */
export const SITE_ORIGIN = 'https://axecloud.com.br';

export const HOME_SEO = {
  title: 'AxéCloud | Sistema de Gestão para Terreiros de Umbanda e Candomblé',
  description:
    'Software de gestão para terreiros de Umbanda e Candomblé: financeiro, mensalidades Pix, galeria de fotos, calendário de giras e portal do filho de santo. Tecnologia com respeito ao sagrado.',
  h1: 'Sistema de gestão para terreiros de Umbanda e Candomblé',
  heroTagline: 'Tecnologia a serviço do sagrado.',
  keywords:
    'AxéCloud, gestão de terreiro, software para terreiro, casa de axé, zelador, filhos de santo, candomblé, umbanda, jurema, gestão mística, financeiro de terreiro, mensalidade terreiro, galeria de fotos terreiro, calendário de giras, portal filho de santo, terreiro umbanda, terreiro candomblé',
  ogImageAlt: 'AxéCloud — Sistema de gestão para terreiros de Umbanda e Candomblé',
  manifestDescription:
    'Gestão para terreiros de Umbanda e Candomblé: financeiro, galeria de fotos, giras e portal do filho de santo.',
} as const;

export type HomeFaqItem = { q: string; a: string };

export const HOME_FAQ: readonly HomeFaqItem[] = [
  {
    q: 'O AxéCloud serve para terreiros de Umbanda, Candomblé e Jurema?',
    a: 'Sim. O AxéCloud é flexível para casas de axé de Umbanda, Candomblé, Jurema e outras vertentes. Você personaliza termos, cargos e rotinas conforme a tradição do seu terreiro.',
  },
  {
    q: 'Como funciona a gestão financeira do terreiro?',
    a: 'O módulo financeiro registra mensalidades, doações e despesas com histórico transparente. Os filhos de santo podem pagar via Pix e a diretoria acompanha tudo em tempo real, sem planilhas.',
  },
  {
    q: 'Filhos de santo têm acesso próprio ao sistema?',
    a: 'Sim. Cada filho de santo acessa um portal com mural de avisos, biblioteca de estudos, calendário de giras e mensalidades — tudo separado do painel do zelador.',
  },
  {
    q: 'Posso guardar fotos de giras e eventos do terreiro?',
    a: 'Sim. A galeria de fotos organiza álbuns por festa, gira ou tema — memória da casa em um só lugar, com acesso controlado pela diretoria.',
  },
  {
    q: 'Mais de uma pessoa pode administrar o terreiro?',
    a: 'Com certeza. O zelador principal pode criar acessos para ogãs, cambonos ou membros da diretoria cuidarem do financeiro, galeria, mural e calendário.',
  },
  {
    q: 'O calendário de giras e obrigações está incluído?',
    a: 'Sim. O calendário litúrgico organiza giras, festas e obrigações do terreiro. Filhos de santo veem a agenda; a diretoria gerencia eventos e presença.',
  },
  {
    q: 'Existe programa gratuito para começar?',
    a: 'Sim. O Programa Fundador oferece 12 meses gratuitos para as primeiras casas selecionadas, com onboarding personalizado. Depois do período: R$ 49,90/mês vitalício para casas aprovadas ou R$ 69,90/mês para as demais. Inscreva-se em axecloud.com.br/programa-fundador.',
  },
  {
    q: 'Preciso instalar alguma coisa no computador ou celular?',
    a: 'Não. O AxéCloud funciona 100% na nuvem pelo navegador — computador, tablet ou celular — sem instalação.',
  },
  {
    q: 'Meus dados e da comunidade ficam seguros?',
    a: 'Sim. Cada terreiro tem ambiente isolado, criptografia em trânsito (HTTPS) e controles de acesso por perfil. Respeitamos a privacidade da casa e a LGPD.',
  },
] as const;

export const HOME_STATIC_SECTIONS: readonly { heading: string; body: string }[] = [
  {
    heading: 'Gestão financeira para terreiros de axé',
    body: 'Controle mensalidades de filhos de santo, doações, despesas e arrecadações Pix com transparência para zeladores, pais de santo e diretoria de terreiros de Umbanda e Candomblé.',
  },
  {
    heading: 'Portal do filho de santo',
    body: 'Biblioteca de estudos, mural espiritual, calendário de giras e pagamento de mensalidade num único app pensado para a rotina da casa.',
  },
  {
    heading: 'Galeria de fotos e calendário de giras',
    body: 'Álbuns de giras, festas e momentos da comunidade sem pastas espalhadas. Agenda de giras, festas e obrigações visível para toda a comunidade do terreiro.',
  },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildHomeJsonLd(): string {
  const graph = [
    {
      '@type': 'SoftwareApplication',
      name: 'AxéCloud',
      url: `${SITE_ORIGIN}/`,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, iOS, Android',
      inLanguage: 'pt-BR',
      description: HOME_SEO.description,
      image: `${SITE_ORIGIN}/og-image.png`,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'BRL',
        availability: 'https://schema.org/InStock',
      },
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_ORIGIN}/#organization`,
      name: 'AxéCloud',
      url: `${SITE_ORIGIN}/`,
      logo: `${SITE_ORIGIN}/axecloud_512.png`,
      description: HOME_SEO.description,
      sameAs: [...SOCIAL_SAME_AS],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      name: 'AxéCloud',
      url: `${SITE_ORIGIN}/`,
      description: HOME_SEO.description,
      inLanguage: 'pt-BR',
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_ORIGIN}/#faq`,
      mainEntity: HOME_FAQ.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    },
  ];

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}

export function buildHomeHeadInject(): string {
  const t = HOME_SEO.title;
  const d = HOME_SEO.description;
  const url = `${SITE_ORIGIN}/`;
  const ogAlt = HOME_SEO.ogImageAlt;

  return [
    `<title>${escapeHtml(t)}</title>`,
    '',
    `<meta name="description" content="${escapeHtml(d)}" />`,
    `<meta name="keywords" content="${escapeHtml(HOME_SEO.keywords)}" />`,
    `<meta name="author" content="AxéCloud" />`,
    `<meta name="robots" content="index, follow" />`,
    `<link rel="canonical" href="${url}" />`,
    '',
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="AxéCloud" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${escapeHtml(t)}" />`,
    `<meta property="og:description" content="${escapeHtml(d)}" />`,
    `<meta property="og:image" content="${SITE_ORIGIN}/og-image.png" />`,
    `<meta property="og:image:secure_url" content="${SITE_ORIGIN}/og-image.png" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeHtml(ogAlt)}" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(t)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(d)}" />`,
    `<meta name="twitter:image" content="${SITE_ORIGIN}/og-image.png" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(ogAlt)}" />`,
    '',
    `<script type="application/ld+json">\n${buildHomeJsonLd()}\n    </script>`,
  ].join('\n    ');
}

export function buildHomeBodyInject(): string {
  const sections = HOME_STATIC_SECTIONS.map(
    (s) =>
      `      <h2>${escapeHtml(s.heading)}</h2>\n      <p>${escapeHtml(s.body)}</p>`,
  ).join('\n\n');
  const faq = HOME_FAQ.map(
    (item) =>
      `        <dt>${escapeHtml(item.q)}</dt>\n        <dd>${escapeHtml(item.a)}</dd>`,
  ).join('\n');

  return [
    `    <article id="axecloud-seo-static" aria-label="Sobre o AxéCloud">`,
    `      <h1>${escapeHtml(HOME_SEO.h1)}</h1>`,
    `      <p>${escapeHtml(HOME_SEO.description)}</p>`,
    '',
    sections,
    '',
    `      <h2>Perguntas frequentes sobre gestão de terreiros</h2>`,
    `      <dl>`,
    faq,
    `      </dl>`,
    '',
    buildPublicSiteNavHtml(),
    `    </article>`,
    `    <div id="axecloud-boot" aria-hidden="true">`,
    `      <div class="spinner"></div>`,
    `      <p>Carregando AxéCloud...</p>`,
    `    </div>`,
  ].join('\n');
}

export function buildHomeNoscript(): string {
  const sections = HOME_STATIC_SECTIONS.map(
    (s) => `<h2>${escapeHtml(s.heading)}</h2><p>${escapeHtml(s.body)}</p>`,
  ).join('');
  const faq = HOME_FAQ.slice(0, 4)
    .map((item) => `<p><strong>${escapeHtml(item.q)}</strong> ${escapeHtml(item.a)}</p>`)
    .join('');

  return [
    `<h1>${escapeHtml(HOME_SEO.h1)}</h1>`,
    `<p>${escapeHtml(HOME_SEO.description)}</p>`,
    sections,
    faq,
    `<p>Ative o JavaScript para acessar a plataforma completa.</p>`,
  ].join('');
}
