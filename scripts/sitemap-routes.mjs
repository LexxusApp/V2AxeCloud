/**
 * Rotas públicas indexáveis do AxéCloud (SPA Vite).
 * Edite aqui ao adicionar páginas de marketing ou legais com URL própria.
 *
 * Não inclua áreas autenticadas (dashboard, configurações, etc.).
 * Slugs de artigos: manter em sync com src/content/portalContent.ts
 */

const PORTAL_ARTICLE_PATHS = [
  '/conteudo/como-o-axecloud-ajuda-terreiros',
  '/conteudo/o-que-e-um-terreiro-guia-para-iniciantes',
  '/conteudo/mensalidade-na-casa-de-axe-organizacao',
  '/conteudo/giras-festas-e-calendario-da-casa',
  '/conteudo/como-visitar-um-terreiro-com-respeito',
];

export const SITEMAP_ROUTES = [
  {
    path: '/',
    changeFrequency: 'weekly',
    priority: 1,
    comment: 'Página inicial — login e apresentação',
  },
  {
    path: '/entrar',
    changeFrequency: 'monthly',
    priority: 0.9,
    comment: 'Entrada para zeladores e filhos de santo',
  },
  {
    path: '/termos',
    changeFrequency: 'yearly',
    priority: 0.5,
    comment: 'Termos de Uso públicos',
  },
  {
    path: '/privacidade',
    changeFrequency: 'yearly',
    priority: 0.5,
    comment: 'Política de Privacidade pública',
  },
  {
    path: '/programa-fundador',
    changeFrequency: 'weekly',
    priority: 0.95,
    comment: 'Programa Fundador — inscrição de terreiros',
  },
  {
    path: '/espaco-do-fiel',
    changeFrequency: 'weekly',
    priority: 0.9,
    comment: 'Espaço do Fiel — portal público de pedidos de reza',
  },
  {
    path: '/conteudo',
    changeFrequency: 'weekly',
    priority: 0.85,
    comment: 'Hub de conteúdo do portal',
  },
  ...PORTAL_ARTICLE_PATHS.map((path) => ({
    path,
    changeFrequency: 'monthly',
    priority: 0.8,
    comment: 'Artigo do portal AxéCloud',
  })),
  {
    path: '/por-que-axecloud',
    changeFrequency: 'monthly',
    priority: 0.92,
    comment: 'Comparativo explícito, módulos e PWA',
  },
  {
    path: '/conteudo/glossario',
    changeFrequency: 'monthly',
    priority: 0.8,
    comment: 'Glossário do axé — 20 termos',
  },
  {
    path: '/terreiros',
    changeFrequency: 'daily',
    priority: 0.9,
    comment: 'Diretório público de terreiros',
  },
  {
    path: '/eventos',
    changeFrequency: 'daily',
    priority: 0.85,
    comment: 'Agenda de eventos públicos',
  },
  {
    path: '/conteudo/calendario-liturgico',
    changeFrequency: 'yearly',
    priority: 0.75,
    comment: 'Calendário litúrgico de referência',
  },
];
