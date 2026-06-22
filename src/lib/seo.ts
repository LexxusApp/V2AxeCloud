import { metadata as homeMetadata } from '../app/page';
import { BRAND_NAME, PORTAL_BRAND, buildBrandKeywordsMeta } from '../constants/seoBrandKeywords';
import { getPortalArticleBySlug, parseContentArticleSlug } from '../content/portalContent';
import { ROUTES, normalizePath } from './routes';

const SITE_ORIGIN = 'https://axecloud.com.br';

const DEFAULT_TITLE = homeMetadata.title;
const DEFAULT_DESCRIPTION = homeMetadata.description;

type RouteSeo = {
  title: string;
  description: string;
  canonicalPath: string;
  robots: string;
};

const ROUTE_SEO: Record<string, RouteSeo> = {
  [ROUTES.home]: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: '/',
    robots: 'index, follow',
  },
  [ROUTES.login]: {
    title: `Entrar | ${BRAND_NAME}`,
    description:
      `Acesse o ${BRAND_NAME} — login para zeladores e filhos de santo. Gestão de terreiros de Umbanda e Candomblé: financeiro, galeria de fotos e mural.`,
    canonicalPath: '/entrar',
    robots: 'index, follow',
  },
  [ROUTES.loginLegacy]: {
    title: `Entrar | ${BRAND_NAME}`,
    description:
      `Acesse o ${BRAND_NAME} — login para zeladores e filhos de santo. Gestão de terreiros de Umbanda e Candomblé: financeiro, galeria de fotos e mural.`,
    canonicalPath: '/entrar',
    robots: 'noindex, follow',
  },
  [ROUTES.terms]: {
    title: `Termos de Uso | ${BRAND_NAME}`,
    description:
      `Termos de Uso do ${BRAND_NAME} — regras de utilização da plataforma de gestão para terreiros de Umbanda e Candomblé.`,
    canonicalPath: '/termos',
    robots: 'index, follow',
  },
  [ROUTES.privacy]: {
    title: `Política de Privacidade | ${BRAND_NAME}`,
    description:
      `Política de Privacidade do ${BRAND_NAME} — como tratamos seus dados em conformidade com a LGPD.`,
    canonicalPath: '/privacidade',
    robots: 'index, follow',
  },
  [ROUTES.register]: {
    title: `Cadastrar terreiro | ${BRAND_NAME}`,
    description:
      `Cadastre seu terreiro de Umbanda ou Candomblé no ${BRAND_NAME} e organize financeiro, galeria de fotos e portal do filho de santo.`,
    canonicalPath: '/register',
    robots: 'noindex, follow',
  },
  [ROUTES.checkout]: {
    title: `Checkout | ${BRAND_NAME}`,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: '/checkout',
    robots: 'noindex, nofollow',
  },
  [ROUTES.dashboard]: {
    title: `Painel | ${BRAND_NAME}`,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: '/dashboard',
    robots: 'noindex, nofollow',
  },
  [ROUTES.previewPainel]: {
    title: `Preview do painel | ${BRAND_NAME}`,
    description: 'Prévia visual do painel de gestão Ilê Asé — explore módulos com dados fictícios.',
    canonicalPath: '/preview-painel',
    robots: 'noindex, follow',
  },
  [ROUTES.founderProgram]: {
    title: `Cadastro | ${BRAND_NAME} — 30 dias grátis`,
    description:
      `Cadastre seu terreiro no ${BRAND_NAME} e teste o plano Premium por 30 dias sem pagar. Depois, mensalidade via PIX.`,
    canonicalPath: '/register',
    robots: 'noindex, follow',
  },
  [ROUTES.contentHub]: {
    title: `Conteúdo | ${PORTAL_BRAND} — Umbanda e Candomblé`,
    description:
      `Artigos e glossário sobre terreiros, filhos de santo e tradições afro-brasileiras — conteúdo educativo do ${PORTAL_BRAND}.`,
    canonicalPath: '/conteudo',
    robots: 'index, follow',
  },
  [ROUTES.glossary]: {
    title: `Glossário do axé — 20 termos essenciais | ${BRAND_NAME}`,
    description:
      'Glossário introdutório: axé, terreiro, filho de santo, gira, orixá, umbanda, candomblé, exu, firma e mais — linguagem respeitosa para quem está conhecendo a tradição.',
    canonicalPath: '/conteudo/glossario',
    robots: 'index, follow',
  },
  [ROUTES.espacoDoFiel]: {
    title: `Espaço do Fiel — Pedir Reza | ${BRAND_NAME}`,
    description:
      'Portal público de pedidos de reza: selecione um terreiro parceiro por cidade, acenda sua vela virtual e acompanhe o altar com respeito e privacidade.',
    canonicalPath: '/espaco-do-fiel',
    robots: 'index, follow',
  },
  [ROUTES.terreiros]: {
    title: `Diretório de terreiros | ${PORTAL_BRAND}`,
    description:
      'Encontre casas de Umbanda, Candomblé e tradições afins com perfil público verificado — por cidade, tradição e pedidos de reza online.',
    canonicalPath: '/terreiros',
    robots: 'index, follow',
  },
  [ROUTES.eventosPublicos]: {
    title: `Eventos públicos — giras e festas | ${BRAND_NAME}`,
    description:
      `Agenda de giras e festas públicas divulgadas por terreiros parceiros do ${PORTAL_BRAND}.`,
    canonicalPath: '/eventos',
    robots: 'index, follow',
  },
  [ROUTES.liturgicalCalendar]: {
    title: `Calendário litúrgico de referência | ${PORTAL_BRAND}`,
    description:
      'Datas culturais frequentemente celebradas em casas de axé — referência educativa; cada terreiro tem calendário próprio.',
    canonicalPath: '/conteudo/calendario-liturgico',
    robots: 'index, follow',
  },
};

function upsertMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertOg(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertTwitter(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function resolveRouteSeo(path: string): RouteSeo {
  if (path.startsWith(`${ROUTES.eventRsvp}/`)) {
    return {
      title: `Confirmação de presença | ${BRAND_NAME}`,
      description: 'Confirme ou decline seu convite para o evento do terreiro.',
      canonicalPath: path,
      robots: 'noindex, nofollow',
    };
  }

  if (path.startsWith(`${ROUTES.consulentePortal}/`)) {
    return {
      title: `Portal do consulente | ${BRAND_NAME}`,
      description: DEFAULT_DESCRIPTION,
      canonicalPath: path,
      robots: 'noindex, follow',
    };
  }

  if (path.startsWith(`${ROUTES.terreiros}/`)) {
    return {
      title: `Terreiro | ${PORTAL_BRAND}`,
      description:
        'Perfil público de terreiro de Umbanda ou Candomblé — pedidos de reza, eventos e informações com respeito à tradição.',
      canonicalPath: path,
      robots: 'index, follow',
    };
  }

  const articleSlug = parseContentArticleSlug(path);
  if (articleSlug) {
    const article = getPortalArticleBySlug(articleSlug);
    if (article) {
      return {
        title: `${article.title} | ${PORTAL_BRAND}`,
        description: article.summary,
        canonicalPath: path,
        robots: 'index, follow',
      };
    }
  }

  return ROUTE_SEO[path] ?? ROUTE_SEO[ROUTES.home];
}

/** Atualiza title, description, canonical, robots e Open Graph conforme a rota da SPA. */
export function applyRouteSeo(pathname: string) {
  const path = normalizePath(pathname);
  const seo = resolveRouteSeo(path);
  const canonical =
    seo.canonicalPath === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${seo.canonicalPath}`;
  const ogType =
    path.startsWith('/conteudo/') && path !== ROUTES.contentHub ? 'article' : 'website';

  document.title = seo.title;
  upsertMeta('description', seo.description);
  upsertMeta('keywords', buildBrandKeywordsMeta());
  upsertMeta('robots', seo.robots);
  upsertCanonical(canonical);
  upsertOg('og:type', ogType);
  upsertOg('og:site_name', BRAND_NAME);
  upsertOg('og:url', canonical);
  upsertOg('og:title', seo.title);
  upsertOg('og:description', seo.description);
  upsertOg('og:image', `${SITE_ORIGIN}/og-image.png`);
  upsertOg('og:locale', 'pt_BR');
  upsertTwitter('twitter:card', 'summary_large_image');
  upsertTwitter('twitter:title', seo.title);
  upsertTwitter('twitter:description', seo.description);
  upsertTwitter('twitter:image', `${SITE_ORIGIN}/og-image.png`);
  document.documentElement.lang = 'pt-BR';
}
