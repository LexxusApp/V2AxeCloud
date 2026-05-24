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
      'Acesse o AxéCloud — login para zeladores e filhos de santo. Gestão de terreiros de Umbanda e Candomblé: financeiro, almoxarifado e mural.',
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
      'Cadastre seu terreiro de Umbanda ou Candomblé no AxéCloud e organize financeiro, almoxarifado e portal do filho de santo.',
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

/** Atualiza title, description, canonical e robots conforme a rota da SPA. */
export function applyRouteSeo(pathname: string) {
  const path = normalizePath(pathname);
  const seo = ROUTE_SEO[path] ?? ROUTE_SEO[ROUTES.home];
  const canonical =
    seo.canonicalPath === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${seo.canonicalPath}`;

  document.title = seo.title;
  upsertMeta('description', seo.description);
  upsertMeta('robots', seo.robots);
  upsertCanonical(canonical);
  document.documentElement.lang = 'pt-BR';
}
