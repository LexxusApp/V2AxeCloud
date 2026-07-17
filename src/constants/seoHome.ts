import {
  BRAND_NAME,
  SITE_TITLE,
  buildBrandAlternateNamesJsonLd,
  buildBrandKeywordsMeta,
  buildBrandRecognitionParagraph,
} from './seoBrandKeywords';
import { buildPublicSiteNavHtml } from './seoPublicPages';
import { LANDING_SCREENSHOT_VERSION } from './landingScreenshots';
import { buildOrganizationSameAs } from './socialLinks';

/** Metadados e conteúdo estático da home — fonte única para HTML, JSON-LD e landing. */
export const SITE_ORIGIN = 'https://axecloud.com.br';

export const HOME_SEO = {
  title: SITE_TITLE,
  description:
    `${BRAND_NAME} é o software de gestão para terreiros: financeiro com Pix, giras, WhatsApp e portal do filho. Teste grátis por 30 dias, sem cartão.`,
  h1: `Gestão de terreiros para Umbanda, Candomblé e Jurema — ${BRAND_NAME}`,
  heroTagline: 'Portal da comunidade de terreiros — casas, eventos e tradição.',
  keywords: buildBrandKeywordsMeta(),
  brandRecognition: buildBrandRecognitionParagraph(),
  ogImageAlt: `${BRAND_NAME} — Software de gestão de terreiros de Umbanda e Candomblé`,
  manifestDescription:
    'Software de gestão de terreiros: financeiro, galeria, giras, portal do filho de santo e app PWA instalável.',
} as const;

export type HomeFaqItem = { q: string; a: string };

export const HOME_FAQ: readonly HomeFaqItem[] = [
  {
    q: 'O que é gestão de terreiros?',
    a: `Gestão de terreiros é a organização prática da casa de axé: mensalidades, calendário de giras, cadastro de filhos de santo, comunicação com a comunidade e memória da casa — sempre com respeito à direção espiritual. O ${BRAND_NAME} é um software brasileiro de gestão de terreiros para Umbanda, Candomblé e Jurema. Conheça em ${SITE_ORIGIN}/ e compare módulos em ${SITE_ORIGIN}/por-que-axecloud.`,
  },
  {
    q: 'Qual o melhor software de gestão de terreiros para Umbanda e Candomblé?',
    a: `O ${BRAND_NAME} é um software brasileiro de gestão de terreiros com financeiro Pix, calendário de giras, galeria, mural e portal do filho de santo — desenvolvido com respeito às tradições de matriz africana. Teste grátis por 30 dias em ${SITE_ORIGIN}/register.`,
  },
  {
    q: `O ${BRAND_NAME} serve para terreiros de Umbanda, Candomblé e Jurema?`,
    a: `Sim. O ${BRAND_NAME} é flexível para casas de axé de Umbanda, Candomblé, Jurema e outras vertentes. Você personaliza termos, cargos e rotinas conforme a tradição do seu terreiro.`,
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
    a: 'Sim. A galeria oferece até 100 GB por terreiro para fotos e vídeos — álbuns por festa, gira ou tema, com acesso controlado pela diretoria.',
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
    a: `Sim. Todo terreiro novo tem 30 dias de teste gratuito com acesso ao plano Premium completo — sem cartão de crédito. Após o período, a mensalidade é cobrada via PIX. Cadastre-se em ${SITE_ORIGIN}/register.`,
  },
  {
    q: 'Preciso instalar alguma coisa no computador ou celular?',
    a: `Não é obrigatório instalar pela App Store ou Google Play. O ${BRAND_NAME} funciona no navegador (Chrome, Safari, Edge) e pode ser fixado na tela inicial como app (PWA) — ícone na home, sem loja de aplicativos. Veja o passo a passo em ${SITE_ORIGIN}/por-que-axecloud#pwa-head.`,
  },
  {
    q: 'Quais módulos já existem no AxéCloud?',
    a: `Painel do zelador, filhos de santo, calendário de giras, financeiro com Pix, mural, galeria, biblioteca, loja do axé, almoxarifado, WhatsApp Meta, atendimentos, portal público, notificações push e app PWA — tudo incluso no plano Premium. Lista completa em ${SITE_ORIGIN}/por-que-axecloud.`,
  },
  {
    q: 'Meus dados e da comunidade ficam seguros?',
    a: 'Sim. Cada terreiro tem ambiente isolado, criptografia em trânsito (HTTPS) e controles de acesso por perfil. Respeitamos a privacidade da casa e a LGPD.',
  },
] as const;

/** Cabeçalho da seção «A plataforma» na landing. */
export const HOME_PLATAFORMA = {
  titleBefore: 'Uma ferramenta ungida com',
  titleHighlight: 'Respeito e Tradição',
  lead: `Diferente de sistemas de e-commerce ou gerências de escritório frias, as funcionalidades do ${BRAND_NAME} foram esculpidas ouvindo zeladores, mães e pais de santo, ogãs e médiuns da corrente.`,
} as const;

export const HOME_STATIC_SECTIONS: readonly { heading: string; body: string }[] = [
  {
    heading: 'Privacidade Silenciosa',
    body: 'Ambiente fechado da sua casa religiosa. Apenas pessoas autorizadas têm acesso. Ficha de desenvolvimento espiritual, batismo e feitura do médium protegidos sob sigilo canônico absoluto.',
  },
  {
    heading: 'Respeito Litúrgico',
    body: 'Nossos campos utilizam termos litúrgicos reais: Amaci do Médium, Orixá de Cabeça, Guia de Frente (Caboclos, Exus, Pretos Velhos), Adoxado, Abian, Ogãs, Cambones, Coroa de Santo e Obrigações de Anos.',
  },
  {
    heading: 'Conexão Consistente',
    body: 'Aproxima o terreiro de seus praticantes frequentes através de avisos, escala de trabalhos espirituais nos dias de gira, comemorações de aniversariantes e de formações da corrente.',
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
      name: BRAND_NAME,
      alternateName: buildBrandAlternateNamesJsonLd(),
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
      name: BRAND_NAME,
      alternateName: buildBrandAlternateNamesJsonLd(),
      url: `${SITE_ORIGIN}/`,
      logo: `${SITE_ORIGIN}/pwa-512.png`,
      description: HOME_SEO.description,
      sameAs: buildOrganizationSameAs(),
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      name: BRAND_NAME,
      alternateName: buildBrandAlternateNamesJsonLd(),
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

export type BuildHomeHeadInjectOptions = {
  /** Preload da screenshot do tour — só na landing; no SPA (/dashboard, /login) gera aviso no console. */
  preloadTourImage?: boolean;
};

export function buildHomeHeadInject(options: BuildHomeHeadInjectOptions = {}): string {
  const { preloadTourImage = true } = options;
  const t = HOME_SEO.title;
  const d = HOME_SEO.description;
  const url = `${SITE_ORIGIN}/`;
  const ogAlt = HOME_SEO.ogImageAlt;

  const lines = [
    `<title>${escapeHtml(t)}</title>`,
    '',
    `<meta name="description" content="${escapeHtml(d)}" />`,
    `<meta name="keywords" content="${escapeHtml(HOME_SEO.keywords)}" />`,
    `<meta name="author" content="${escapeHtml(BRAND_NAME)}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<link rel="canonical" href="${url}" />`,
    '',
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(BRAND_NAME)}" />`,
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
  ];

  if (preloadTourImage) {
    lines.push(
      `<link rel="preload" as="image" href="/screenshots/painel-inicio.png?v=${LANDING_SCREENSHOT_VERSION}" fetchpriority="low" />`,
    );
  }

  lines.push(`<script type="application/ld+json">\n${buildHomeJsonLd()}\n    </script>`);

  return lines.join('\n    ');
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
    `    <article id="axecloud-seo-static" aria-label="Sobre o ${escapeHtml(BRAND_NAME)}">`,
    `      <h1>${escapeHtml(HOME_SEO.h1)}</h1>`,
    `      <p>${escapeHtml(HOME_SEO.description)}</p>`,
    `      <p>${escapeHtml(HOME_SEO.brandRecognition)}</p>`,
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
