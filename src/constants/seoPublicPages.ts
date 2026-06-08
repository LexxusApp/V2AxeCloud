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
import { GLOSSARY_TERMS, PORTAL_ARTICLE } from '../content/portalContent';
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
    title: 'Entrar | AxéCloud',
    description:
      'Acesse o AxéCloud — login para zeladores e filhos de santo. Gestão de terreiros de Umbanda e Candomblé: financeiro, galeria de fotos e mural.',
    h1: 'Entrar no AxéCloud',
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
    title: 'Termos de Uso | AxéCloud',
    description:
      'Termos de Uso do AxéCloud — regras de utilização da plataforma de gestão para terreiros de Umbanda e Candomblé.',
    h1: TERMS_OF_USE_TITLE,
    intro: TERMS_OF_USE_SUMMARY,
    sections: legalSectionsToStatic(TERMS_OF_USE_SECTIONS),
  },
  {
    path: ROUTES.privacy,
    title: 'Política de Privacidade | AxéCloud',
    description:
      'Política de Privacidade do AxéCloud — como tratamos seus dados em conformidade com a LGPD.',
    h1: PRIVACY_POLICY_TITLE,
    intro: PRIVACY_POLICY_SUMMARY,
    sections: legalSectionsToStatic(PRIVACY_POLICY_SECTIONS),
  },
  {
    path: ROUTES.founderProgram,
    title: 'Programa Fundador | AxéCloud — 12 meses gratuitos para terreiros',
    description:
      'Inscreva sua casa de axé no Programa Fundador AxéCloud: uso gratuito por 12 meses, onboarding personalizado e prioridade no portal público de terreiros de Umbanda e Candomblé.',
    h1: 'Programa Fundador — 12 meses gratuitos para terreiros',
    intro: `Estamos selecionando até ${FOUNDER_PROGRAM.maxSlots} terreiros de Umbanda, Candomblé e Jurema para validar o AxéCloud. Uso completo gratuito por ${FOUNDER_PROGRAM.freeMonths} meses, onboarding personalizado e selo de Casa Fundadora no futuro diretório público.`,
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
      name: 'Programa Fundador AxéCloud',
      description: `Uso gratuito do AxéCloud por ${FOUNDER_PROGRAM.freeMonths} meses para terreiros selecionados`,
      price: '0',
      priceCurrency: 'BRL',
      url: `${SITE_ORIGIN}${ROUTES.founderProgram}`,
      seller: { '@type': 'Organization', name: 'AxéCloud', url: SITE_ORIGIN },
      eligibleRegion: { '@type': 'Country', name: 'Brasil' },
    },
  },
  {
    path: ROUTES.contentHub,
    title: 'Conteúdo | Portal AxéCloud — Umbanda e Candomblé',
    description:
      'Artigos e glossário sobre terreiros, filhos de santo e tradições afro-brasileiras — conteúdo educativo do portal AxéCloud.',
    h1: 'Conteúdo para quem busca entender a tradição',
    intro:
      'Artigos e glossário com linguagem respeitosa — base do portal público que estamos construindo junto com as casas fundadoras de Umbanda e Candomblé.',
    sections: [
      {
        heading: PORTAL_ARTICLE.title,
        body: `${PORTAL_ARTICLE.summary} Leia o artigo completo em ${SITE_ORIGIN}${ROUTES.contentArticle}.`,
      },
      {
        heading: 'Glossário do axé',
        body: `10 termos essenciais sobre terreiro, filho de santo, gira, orixá e tradições afro-brasileiras. Acesse em ${SITE_ORIGIN}${ROUTES.glossary}.`,
      },
      {
        heading: 'Programa Fundador',
        body: `Casas de axé podem se inscrever para usar o AxéCloud gratuitamente por ${FOUNDER_PROGRAM.freeMonths} meses em ${SITE_ORIGIN}${ROUTES.founderProgram}.`,
      },
    ],
  },
  {
    path: ROUTES.contentArticle,
    title: 'Como o AxéCloud ajuda terreiros | Portal AxéCloud',
    description: PORTAL_ARTICLE.summary,
    h1: PORTAL_ARTICLE.title,
    intro: PORTAL_ARTICLE.summary,
    sections: PORTAL_ARTICLE.sections.map((s) => ({ heading: s.title, body: s.body })),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: PORTAL_ARTICLE.title,
      description: PORTAL_ARTICLE.summary,
      datePublished: PORTAL_ARTICLE.publishedAt,
      inLanguage: 'pt-BR',
      author: { '@type': 'Organization', name: 'AxéCloud', url: SITE_ORIGIN },
      publisher: {
        '@type': 'Organization',
        name: 'AxéCloud',
        url: SITE_ORIGIN,
        logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/og-image.png` },
      },
      mainEntityOfPage: `${SITE_ORIGIN}${ROUTES.contentArticle}`,
    },
  },
  {
    path: ROUTES.glossary,
    title: 'Glossário do axé — 10 termos essenciais | AxéCloud',
    description:
      'Glossário introdutório: axé, terreiro, filho de santo, gira, orixá, umbanda, candomblé e mais — linguagem respeitosa para quem está conhecendo a tradição.',
    h1: 'Glossário do axé — 10 termos essenciais',
    intro:
      'Termos fundamentais da vida em terreiros de Umbanda e Candomblé, explicados com respeito à tradição afro-brasileira.',
    sections: GLOSSARY_TERMS.map((t) => ({ heading: t.term, body: t.definition })),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'DefinedTermSet',
      name: 'Glossário do axé — AxéCloud',
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
] as const;

export const PUBLIC_SITE_NAV_LINKS: readonly { href: string; label: string }[] = [
  { href: `${SITE_ORIGIN}/`, label: 'Início' },
  { href: `${SITE_ORIGIN}${ROUTES.login}`, label: 'Entrar' },
  { href: `${SITE_ORIGIN}${ROUTES.terms}`, label: 'Termos de Uso' },
  { href: `${SITE_ORIGIN}${ROUTES.privacy}`, label: 'Política de Privacidade' },
  { href: `${SITE_ORIGIN}${ROUTES.founderProgram}`, label: 'Programa Fundador' },
  { href: `${SITE_ORIGIN}${ROUTES.contentHub}`, label: 'Conteúdo' },
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
    `<meta name="robots" content="index, follow" />`,
    `<link rel="canonical" href="${url}" />`,
    '',
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:site_name" content="AxéCloud" />`,
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
