import { BRAND_NAME, PORTAL_BRAND, buildBrandKeywordsMeta } from './seoBrandKeywords';
import {
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_SUMMARY,
  PRIVACY_POLICY_TITLE,
  TERMS_OF_USE_SECTIONS,
  TERMS_OF_USE_SUMMARY,
  TERMS_OF_USE_TITLE,
  type LegalSection,
} from '../content/legalTerms';
import {
  FOUNDER_BENEFITS,
  FOUNDER_PROGRAM,
  FOUNDER_REQUIREMENTS,
} from './founderProgram';
import {
  GLOSSARY_TERMS,
  PORTAL_ARTICLES,
  contentArticlePath,
} from '../content/portalContent';
import { ROUTES } from '../lib/routes';

const SITE_ORIGIN = 'https://axecloud.com.br';

export type PublicPrerenderPage = {
  path: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: readonly { heading: string; body: string }[];
  /** JSON-LD opcional (Article, Offer, DefinedTermSet, etc.) */
  jsonLd?: Record<string, unknown> | readonly Record<string, unknown>[];
};

function legalSectionsToStatic(sections: readonly LegalSection[]): { heading: string; body: string }[] {
  return sections.map((s) => ({ heading: s.title, body: s.body }));
}

/** HTML estático por URL — servido em dist/{path}/index.html para crawlers e canonical corretos. */
export const PUBLIC_PRERENDER_PAGES: readonly PublicPrerenderPage[] = [
  {
    path: ROUTES.login,
    title: `Entrar | ${BRAND_NAME}`,
    description:
      `Acesse o ${BRAND_NAME} — login para zeladores e filhos de santo. Gestão de terreiros de Umbanda e Candomblé: financeiro, galeria de fotos e mural.`,
    h1: `Entrar no ${BRAND_NAME}`,
    intro:
      'Faça login como zelador(a) ou filho de santo para acessar o painel do terreiro, mensalidades, mural, calendário de giras e galeria de fotos.',
    sections: [
      {
        heading: 'Acesso para zeladores',
        body: 'Zeladores e diretoria administram financeiro, cadastros, galeria e configurações do terreiro após autenticação com e-mail e senha.',
      },
      {
        heading: 'Portal do filho de santo',
        body: 'Integrantes da casa acessam mural, biblioteca, calendário e mensalidades no portal dedicado, com credenciais próprias.',
      },
    ],
  },
  {
    path: ROUTES.terms,
    title: `Termos de Uso | ${BRAND_NAME}`,
    description:
      `Termos de Uso do ${BRAND_NAME} — regras de utilização da plataforma de gestão para terreiros de Umbanda e Candomblé.`,
    h1: TERMS_OF_USE_TITLE,
    intro: TERMS_OF_USE_SUMMARY,
    sections: legalSectionsToStatic(TERMS_OF_USE_SECTIONS),
  },
  {
    path: ROUTES.privacy,
    title: `Política de Privacidade | ${BRAND_NAME}`,
    description:
      `Política de Privacidade do ${BRAND_NAME} — como tratamos seus dados em conformidade com a LGPD.`,
    h1: PRIVACY_POLICY_TITLE,
    intro: PRIVACY_POLICY_SUMMARY,
    sections: legalSectionsToStatic(PRIVACY_POLICY_SECTIONS),
  },
  {
    path: ROUTES.founderProgram,
    title: `Programa Fundador | ${BRAND_NAME} — 12 meses gratuitos para terreiros`,
    description:
      `Inscreva sua casa de axé no Programa Fundador ${BRAND_NAME}: uso gratuito por 12 meses, onboarding personalizado e prioridade no portal público de terreiros de Umbanda e Candomblé.`,
    h1: 'Programa Fundador — 12 meses gratuitos para terreiros',
    intro: `Estamos selecionando até ${FOUNDER_PROGRAM.maxSlots} terreiros de Umbanda, Candomblé e Jurema para validar o ${BRAND_NAME}. Uso completo gratuito por ${FOUNDER_PROGRAM.freeMonths} meses, onboarding personalizado e selo de Casa Fundadora no futuro diretório público.`,
    sections: [
      ...FOUNDER_BENEFITS.map((body, i) => ({
        heading: `Benefício ${i + 1}`,
        body,
      })),
      {
        heading: 'Requisitos para participar',
        body: FOUNDER_REQUIREMENTS.join(' '),
      },
      {
        heading: 'Região piloto',
        body: `${FOUNDER_PROGRAM.pilotCity}. ${FOUNDER_PROGRAM.pilotRegionNote}`,
      },
    ],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Offer',
      name: `Programa Fundador ${BRAND_NAME}`,
      description: `Uso gratuito do ${BRAND_NAME} por ${FOUNDER_PROGRAM.freeMonths} meses para terreiros selecionados`,
      price: '0',
      priceCurrency: 'BRL',
      url: `${SITE_ORIGIN}${ROUTES.founderProgram}`,
      seller: { '@type': 'Organization', name: BRAND_NAME, url: SITE_ORIGIN },
      eligibleRegion: { '@type': 'Country', name: 'Brasil' },
    },
  },
  {
    path: ROUTES.contentHub,
    title: `Conteúdo | ${PORTAL_BRAND} — Umbanda e Candomblé`,
    description:
      `Artigos e glossário sobre terreiros, filhos de santo e tradições afro-brasileiras — conteúdo educativo do ${PORTAL_BRAND}.`,
    h1: 'Conteúdo para quem busca entender a tradição',
    intro:
      'Artigos e glossário com linguagem respeitosa — base do portal público que estamos construindo junto com as casas fundadoras de Umbanda e Candomblé.',
    sections: [
      ...PORTAL_ARTICLES.map((article) => ({
        heading: article.title,
        body: `${article.summary} Leia o artigo completo em ${SITE_ORIGIN}${contentArticlePath(article.slug)}.`,
      })),
      {
        heading: 'Glossário do axé',
        body: `${GLOSSARY_TERMS.length} termos essenciais sobre terreiro, filho de santo, gira, orixá e tradições afro-brasileiras. Acesse em ${SITE_ORIGIN}${ROUTES.glossary}.`,
      },
      {
        heading: 'Programa Fundador',
        body: `Casas de axé podem se inscrever para usar o ${BRAND_NAME} gratuitamente por ${FOUNDER_PROGRAM.freeMonths} meses em ${SITE_ORIGIN}${ROUTES.founderProgram}.`,
      },
    ],
  },
  ...PORTAL_ARTICLES.map((article) => ({
    path: contentArticlePath(article.slug),
    title: `${article.title} | ${PORTAL_BRAND}`,
    description: article.summary,
    h1: article.title,
    intro: article.summary,
    sections: article.sections.map((s) => ({ heading: s.title, body: s.body })),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.summary,
      datePublished: article.publishedAt,
      inLanguage: 'pt-BR',
      author: { '@type': 'Organization', name: BRAND_NAME, url: SITE_ORIGIN },
      publisher: {
        '@type': 'Organization',
        name: BRAND_NAME,
        url: SITE_ORIGIN,
        logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/og-image.png` },
      },
      mainEntityOfPage: `${SITE_ORIGIN}${contentArticlePath(article.slug)}`,
    },
  })),
  {
    path: ROUTES.glossary,
    title: `Glossário do axé — 20 termos essenciais | ${BRAND_NAME}`,
    description:
      'Glossário introdutório: axé, terreiro, filho de santo, gira, orixá, umbanda, candomblé, exu, firma e mais — linguagem respeitosa para quem está conhecendo a tradição.',
    h1: 'Glossário do axé — 20 termos essenciais',
    intro:
      'Termos fundamentais da vida em terreiros de Umbanda e Candomblé, explicados com respeito à tradição afro-brasileira.',
    sections: GLOSSARY_TERMS.map((t) => ({ heading: t.term, body: t.definition })),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'DefinedTermSet',
      name: `Glossário do axé — ${BRAND_NAME}`,
      description:
        'Glossário introdutório de termos de terreiros de Umbanda e Candomblé',
      inLanguage: 'pt-BR',
      hasDefinedTerm: GLOSSARY_TERMS.map((t) => ({
        '@type': 'DefinedTerm',
        name: t.term,
        description: t.definition,
      })),
    },
  },
  {
    path: ROUTES.espacoDoFiel,
    title: `Espaço do Fiel — Pedir Reza | ${BRAND_NAME}`,
    description:
      'Portal público de pedidos de reza: selecione um terreiro parceiro por cidade, acenda sua vela virtual e acompanhe o altar com respeito e privacidade.',
    h1: 'Portal Público de Pedidos de Reza',
    intro:
      'Ambiente dedicado do visitante e herdeiro de fé — selecione uma casa parceira, firme seu pedido e acompanhe a vela virtual no altar.',
    sections: [
      {
        heading: 'Selecione o terreiro por cidade',
        body: 'Encontre casas religiosas parceiras em São Paulo, Rio de Janeiro, Salvador e outras cidades.',
      },
      {
        heading: 'Formulário de amparo',
        body: 'Envie seu pedido de reza com tipo, linha de trabalho e cor da vela virtual.',
      },
      {
        heading: 'Altar virtual',
        body: 'Acompanhe o status do pedido — vela acesa quando aceito pelo zelador, apagada enquanto pendente.',
      },
    ],
  },
] as const;

/** Paths com HTML pré-renderizado em dist/{path}/index.html (app bundle). */
export const PUBLIC_PRERENDER_PATHS: readonly string[] = PUBLIC_PRERENDER_PAGES.map((p) => p.path);

export const PUBLIC_SITE_NAV_LINKS: readonly { href: string; label: string }[] = [
  { href: `${SITE_ORIGIN}/`, label: 'Início' },
  { href: `${SITE_ORIGIN}${ROUTES.login}`, label: 'Entrar' },
  { href: `${SITE_ORIGIN}${ROUTES.founderProgram}`, label: 'Programa Fundador' },
  { href: `${SITE_ORIGIN}${ROUTES.contentHub}`, label: 'Conteúdo' },
  { href: `${SITE_ORIGIN}${ROUTES.glossary}`, label: 'Glossário do axé' },
  { href: `${SITE_ORIGIN}${ROUTES.espacoDoFiel}`, label: 'Espaço do Fiel' },
  { href: `${SITE_ORIGIN}${ROUTES.terms}`, label: 'Termos de Uso' },
  { href: `${SITE_ORIGIN}${ROUTES.privacy}`, label: 'Política de Privacidade' },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function canonicalUrl(path: string): string {
  return path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;
}

export function buildPublicSiteNavHtml(): string {
  const links = PUBLIC_SITE_NAV_LINKS.map(
    (l) => `        <a href="${l.href}">${escapeHtml(l.label)}</a>`,
  ).join('\n');
  return [
    `      <nav aria-label="Páginas do site">`,
    links,
    `      </nav>`,
  ].join('\n');
}

function buildJsonLdScript(page: PublicPrerenderPage): string {
  if (!page.jsonLd) return '';
  const blocks = Array.isArray(page.jsonLd) ? page.jsonLd : [page.jsonLd];
  return blocks
    .map(
      (block) =>
        `<script type="application/ld+json">${JSON.stringify(block).replace(/</g, '\\u003c')}</script>`,
    )
    .join('\n    ');
}

export function buildPublicPageHeadInject(page: PublicPrerenderPage): string {
  const url = canonicalUrl(page.path);
  const t = page.title;
  const d = page.description;
  const ogType = page.path.startsWith('/conteudo/') && page.path !== ROUTES.contentHub
    ? 'article'
    : 'website';
  const jsonLd = buildJsonLdScript(page);

  return [
    `<title>${escapeHtml(t)}</title>`,
    '',
    `<meta name="description" content="${escapeHtml(d)}" />`,
    `<meta name="keywords" content="${escapeHtml(buildBrandKeywordsMeta())}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<link rel="canonical" href="${url}" />`,
    '',
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:site_name" content="${escapeHtml(BRAND_NAME)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${escapeHtml(t)}" />`,
    `<meta property="og:description" content="${escapeHtml(d)}" />`,
    `<meta property="og:image" content="${SITE_ORIGIN}/og-image.png" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(t)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(d)}" />`,
    `<meta name="twitter:image" content="${SITE_ORIGIN}/og-image.png" />`,
    jsonLd ? `\n    ${jsonLd}` : '',
  ]
    .filter(Boolean)
    .join('\n    ');
}

export function buildPublicPageBodyInject(page: PublicPrerenderPage): string {
  const sections = page.sections
    .map((s) => `      <h2>${escapeHtml(s.heading)}</h2>\n      <p>${escapeHtml(s.body)}</p>`)
    .join('\n\n');

  return [
    `    <article id="axecloud-seo-static" aria-label="${escapeHtml(page.h1)}">`,
    `      <h1>${escapeHtml(page.h1)}</h1>`,
    `      <p>${escapeHtml(page.intro)}</p>`,
    '',
    sections,
    '',
    buildPublicSiteNavHtml(),
    `    </article>`,
  ].join('\n');
}

export function buildPublicPageNoscript(page: PublicPrerenderPage): string {
  const sections = page.sections
    .slice(0, 3)
    .map((s) => `<h2>${escapeHtml(s.heading)}</h2><p>${escapeHtml(s.body)}</p>`)
    .join('');
  const nav = PUBLIC_SITE_NAV_LINKS.map(
    (l) => `<a href="${l.href}">${escapeHtml(l.label)}</a>`,
  ).join(' · ');

  return [
    `<h1>${escapeHtml(page.h1)}</h1>`,
    `<p>${escapeHtml(page.intro)}</p>`,
    sections,
    `<p>${nav}</p>`,
    `<p>Ative o JavaScript para acessar a plataforma completa.</p>`,
  ].join('');
}
