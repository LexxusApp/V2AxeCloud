import {
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_SUMMARY,
  PRIVACY_POLICY_TITLE,
  TERMS_OF_USE_SECTIONS,
  TERMS_OF_USE_SUMMARY,
  TERMS_OF_USE_TITLE,
  type LegalSection,
} from '../content/legalTerms';
import { ROUTES } from '../lib/routes';

const SITE_ORIGIN = 'https://axecloud.com.br';

export type PublicPrerenderPage = {
  path: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: readonly { heading: string; body: string }[];
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

export function buildPublicPageHeadInject(page: PublicPrerenderPage): string {
  const url = canonicalUrl(page.path);
  const t = page.title;
  const d = page.description;

  return [
    `<title>${escapeHtml(t)}</title>`,
    '',
    `<meta name="description" content="${escapeHtml(d)}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<link rel="canonical" href="${url}" />`,
    '',
    `<meta property="og:type" content="website" />`,
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
  ].join('\n    ');
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
    `    <div id="axecloud-boot" aria-hidden="true">`,
    `      <div class="spinner"></div>`,
    `      <p>Carregando AxéCloud...</p>`,
    `    </div>`,
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
