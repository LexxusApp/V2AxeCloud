import { metadata as homeMetadata } from '../app/page';
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
    title: 'Entrar | AxéCloud',
    description:
      'Acesse o AxéCloud — login para zeladores e filhos de santo. Gestão de terreiros de Umbanda e Candomblé: financeiro, galeria de fotos e mural.',
    canonicalPath: '/login',
    robots: 'index, follow',
  },
  [ROUTES.terms]: {
    title: 'Termos de Uso | AxéCloud',
    description:
      'Termos de Uso do AxéCloud — regras de utilização da plataforma de gestão para terreiros de Umbanda e Candomblé.',
    canonicalPath: '/termos',
    robots: 'index, follow',
  },
  [ROUTES.privacy]: {
    title: 'Política de Privacidade | AxéCloud',
    description:
      'Política de Privacidade do AxéCloud — como tratamos seus dados em conformidade com a LGPD.',
    canonicalPath: '/privacidade',
    robots: 'index, follow',
  },
  [ROUTES.register]: {
    title: 'Cadastrar terreiro | AxéCloud',
    description:
      'Cadastre seu terreiro de Umbanda ou Candomblé no AxéCloud e organize financeiro, galeria de fotos e portal do filho de santo.',
    canonicalPath: '/register',
    robots: 'noindex, follow',
  },
  [ROUTES.checkout]: {
    title: 'Checkout | AxéCloud',
    description: DEFAULT_DESCRIPTION,
    canonicalPath: '/checkout',
    robots: 'noindex, nofollow',
  },
  [ROUTES.dashboard]: {
    title: 'Painel | AxéCloud',
    description: DEFAULT_DESCRIPTION,
    canonicalPath: '/dashboard',
    robots: 'noindex, nofollow',
  },
  [ROUTES.founderProgram]: {
    title: 'Programa Fundador | AxéCloud — 12 meses gratuitos para terreiros',
    description:
      'Inscreva sua casa de axé no Programa Fundador AxéCloud: uso gratuito por 12 meses, onboarding personalizado e prioridade no portal público de terreiros de Umbanda e Candomblé.',
    canonicalPath: '/programa-fundador',
    robots: 'index, follow',
  },
  [ROUTES.contentHub]: {
    title: 'Conteúdo | Portal AxéCloud — Umbanda e Candomblé',
    description:
      'Artigos e glossário sobre terreiros, filhos de santo e tradições afro-brasileiras — conteúdo educativo do portal AxéCloud.',
    canonicalPath: '/conteudo',
    robots: 'index, follow',
  },
  [ROUTES.contentArticle]: {
    title: 'Como o AxéCloud ajuda terreiros | Portal AxéCloud',
    description:
      'Gestão financeira, galeria de fotos, calendário de giras e portal do filho de santo — como o AxéCloud organiza casas de Umbanda e Candomblé.',
    canonicalPath: '/conteudo/como-o-axecloud-ajuda-terreiros',
    robots: 'index, follow',
  },
  [ROUTES.glossary]: {
    title: 'Glossário do axé — 10 termos essenciais | AxéCloud',
    description:
      'Glossário introdutório: axé, terreiro, filho de santo, gira, orixá, umbanda, candomblé e mais — linguagem respeitosa para quem está conhecendo a tradição.',
    canonicalPath: '/conteudo/glossario',
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
  if (path.startsWith(`${ROUTES.consulentePortal}/`)) {
    return {
      title: 'Portal do consulente | AxéCloud',
      description: DEFAULT_DESCRIPTION,
      canonicalPath: path,
      robots: 'noindex, follow',
    };
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
  upsertMeta('robots', seo.robots);
  upsertCanonical(canonical);
  upsertOg('og:type', ogType);
  upsertOg('og:site_name', 'AxéCloud');
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
