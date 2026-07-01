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
  COMPARISON_INTRO,
  COMPARISON_PWA,
  COMPARISON_ROWS,
  COMPARISON_VS_STATUS_QUO,
} from './comparisonContent';
import { LANDING_MODULES } from './landingModules';
import { TRIAL_DAYS } from '../../lib/planPricing';
import {
  GLOSSARY_TERMS,
  PORTAL_ARTICLES,
  contentArticlePath,
} from '../content/portalContent';
import { ROUTES } from '../lib/routes';
import { linkifyAxecloudArticleBody } from '../lib/seoLinkify';

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
      `O ${BRAND_NAME} é o software de gestão de terreiros para Umbanda, Candomblé e Jurema. Nesta página você acessa o painel da sua casa: zeladores e diretoria entram com e-mail e senha; filhos de santo usam o ID da casa e CPF fornecidos pelo zelador. Funciona no navegador e pode ser instalado como app (PWA) na tela inicial do celular.`,
    sections: [
      {
        heading: 'Acesso para zeladores e diretoria',
        body:
          'Zeladores, mães e pais de santo, ogãs e membros da diretoria administram financeiro com Pix, cadastro de filhos, galeria de fotos, calendário de giras, mural de avisos, biblioteca e loja do axé. O login é feito com o e-mail cadastrado na abertura da conta do terreiro e a senha definida por você.',
      },
      {
        heading: 'Portal do filho de santo',
        body:
          'Cada integrante da casa recebe credenciais próprias: um identificador curto (ID) e o CPF, informados pelo zelador no momento do cadastro. No portal, o filho acompanha mensalidades, avisos do mural, calendário de giras, biblioteca de estudos e obrigações — separado do painel administrativo.',
      },
      {
        heading: 'Recuperação de senha',
        body:
          'Esqueceu a senha do zelador? Na tela de entrada, use "Esqueceu sua senha?" com o e-mail de login e o WhatsApp cadastrado no terreiro — enviamos um código de 6 dígitos. Filhos de santo devem solicitar novo acesso ao zelador da casa.',
      },
      {
        heading: 'Segurança e privacidade',
        body:
          'Cada terreiro possui ambiente isolado na nuvem. A conexão é criptografada (HTTPS) e os dados da casa não são compartilhados com outros terreiros. Respeitamos a LGPD e a confidencialidade litúrgica dos registros da comunidade.',
      },
      {
        heading: 'Ainda não tem conta?',
        body:
          `Terreiros novos podem criar conta em ${SITE_ORIGIN}${ROUTES.register} e testar o plano Premium por ${TRIAL_DAYS} dias grátis, sem cartão de crédito. Casas já cadastradas entram diretamente por esta página.`,
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
    path: ROUTES.contentHub,
    title: `Conteúdo | ${PORTAL_BRAND} — Umbanda e Candomblé`,
    description:
      `Artigos e glossário sobre terreiros, filhos de santo e tradições afro-brasileiras — conteúdo educativo do ${PORTAL_BRAND}.`,
    h1: 'Conteúdo para quem busca entender a tradição',
    intro:
      'Artigos e glossário com linguagem respeitosa — base do portal público de terreiros de Umbanda e Candomblé. Para software de gestão de terreiros, veja https://axecloud.com.br/ e o comparativo em https://axecloud.com.br/por-que-axecloud.',
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
        heading: 'Teste grátis',
        body: `Cadastre seu terreiro em ${SITE_ORIGIN}${ROUTES.register} e use o ${BRAND_NAME} por ${TRIAL_DAYS} dias grátis — plano Premium completo, sem cartão de crédito.`,
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
    path: ROUTES.espacoDoFiel,
    title: `Espaço do Fiel — Pedir Reza | ${BRAND_NAME}`,
    description:
      'Portal público de pedidos de reza: selecione um terreiro parceiro por cidade, acenda sua vela virtual e acompanhe o altar com respeito e privacidade.',
    h1: 'Portal Público de Pedidos de Reza',
    intro:
      `O Espaço do Fiel é o portal público do ${BRAND_NAME} para quem deseja firmar um pedido de reza em um terreiro parceiro. Você escolhe a casa por cidade, descreve sua intenção com respeito, acende uma vela virtual no altar e acompanha o andamento — tudo com privacidade. Terreiros com portal ativo recebem o pedido no painel e respondem quando aceitarem o trabalho espiritual.`,
    sections: [
      {
        heading: 'Selecione o terreiro por cidade',
        body:
          'Navegue pelo diretório de casas parceiras em São Paulo, Rio de Janeiro, Salvador, Belo Horizonte e outras cidades. Cada terreiro exibe tradição (Umbanda, Candomblé, Jurema), nome público e se aceita pedidos online. Filtre por cidade para encontrar uma casa próxima ou de confiança.',
      },
      {
        heading: 'Formulário de amparo espiritual',
        body:
          'Informe seu nome, a intenção do pedido, a linha ou entidade de trabalho (Caboclos, Pretos Velhos, Exus, Erês, Orixás ou outra conforme a casa), o tipo de amparo (proteção, abertura de caminhos, saúde, equilíbrio emocional) e a cor da vela virtual. O zelador recebe a solicitação e decide se a casa pode atender.',
      },
      {
        heading: 'Altar virtual e acompanhamento',
        body:
          'Quando o pedido é aceito, a vela acende no altar virtual da página — símbolo de que a casa recebeu e firmou seu amparo. Enquanto pendente, a vela permanece apagada. Você pode acompanhar o status e trocar mensagens respeitosas com a equipe do terreiro quando disponível.',
      },
      {
        heading: 'Privacidade e respeito',
        body:
          'Seus dados são tratados com confidencialidade conforme a LGPD. Não divulgamos endereços nem detalhes íntimos dos pedidos publicamente. O portal foi desenhado para consulentes, filhos à distância e pessoas que buscam acolhimento espiritual com dignidade.',
      },
      {
        heading: 'Para terreiros que querem activar o portal',
        body:
          `Casas de axé parceiras do ${BRAND_NAME} ativam o Espaço do Fiel nas configurações do painel. Zeladores gerenciam pedidos, respondem consulentes e mantêm o altar atualizado. Para usar o sistema completo, cadastre-se em ${SITE_ORIGIN}${ROUTES.register} — ${TRIAL_DAYS} dias grátis para testar.`,
      },
      {
        heading: 'Outros recursos do portal',
        body:
          `Além dos pedidos de reza, o ${PORTAL_BRAND} oferece diretório de terreiros, agenda de eventos públicos, calendário litúrgico de referência, glossário do axé e artigos educativos sobre tradições afro-brasileiras — sempre com linguagem respeitosa.`,
      },
    ],
  },
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
    path: ROUTES.whyAxeCloud,
    title: `Por que ${BRAND_NAME}? Comparativo e módulos`,
    description: COMPARISON_INTRO.description,
    h1: COMPARISON_INTRO.h1,
    intro: COMPARISON_INTRO.lead,
    sections: [
      ...COMPARISON_VS_STATUS_QUO.map((block) => ({
        heading: block.heading,
        body: block.body,
      })),
      ...COMPARISON_ROWS.map((row) => ({
        heading: row.feature,
        body: `Planilha/WhatsApp: ${row.planilha}. AxéCloud: ${row.axecloud}. Outros sistemas de terreiro: ${row.outros}.${row.note ? ` ${row.note}` : ''}`,
      })),
      {
        heading: COMPARISON_PWA.title,
        body: `${COMPARISON_PWA.lead} Passos: ${COMPARISON_PWA.steps.map((s) => s.title).join('; ')}.`,
      },
      {
        heading: 'Módulos incluídos no plano Premium',
        body: LANDING_MODULES.map((m) => m.title).join(', '),
      },
    ],
  },
] as const;

/** Paths com HTML pré-renderizado em dist/{path}/index.html (app bundle). */
export const PUBLIC_PRERENDER_PATHS: readonly string[] = PUBLIC_PRERENDER_PAGES.map((p) => p.path);

export const PUBLIC_SITE_NAV_LINKS: readonly { href: string; label: string }[] = [
  { href: `${SITE_ORIGIN}/`, label: 'Início' },
  { href: `${SITE_ORIGIN}${ROUTES.login}`, label: 'Entrar' },
  { href: `${SITE_ORIGIN}${ROUTES.register}`, label: `Teste grátis ${TRIAL_DAYS} dias` },
  { href: `${SITE_ORIGIN}${ROUTES.contentHub}`, label: 'Conteúdo' },
  { href: `${SITE_ORIGIN}${ROUTES.whyAxeCloud}`, label: 'Por que AxéCloud' },
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
    .map(
      (s) =>
        `      <h2>${escapeHtml(s.heading)}</h2>\n      <p>${linkifyAxecloudArticleBody(s.body)}</p>`,
    )
    .join('\n\n');

  const intro = linkifyAxecloudArticleBody(page.intro);

  return [
    `    <article id="axecloud-seo-static" aria-label="${escapeHtml(page.h1)}">`,
    `      <h1>${escapeHtml(page.h1)}</h1>`,
    `      <p>${intro}</p>`,
    '',
    sections,
    '',
    buildPublicSiteNavHtml(),
    `    </article>`,
  ].join('\n');
}

export function buildPublicPageNoscript(page: PublicPrerenderPage): string {
  const sections = page.sections
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
