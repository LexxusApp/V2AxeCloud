/**
 * Rotas públicas indexáveis do AxéCloud (SPA Vite).
 * Edite aqui ao adicionar páginas de marketing ou legais com URL própria.
 *
 * Não inclua áreas autenticadas (dashboard, configurações, etc.).
 * Slugs de artigos: manter em sync com src/content/portalContent.ts
 */

const PORTAL_ARTICLE_PATHS = [
  '/conteudo/gestao-de-terreiros',
  '/conteudo/como-o-axecloud-ajuda-terreiros',
  '/conteudo/o-que-e-um-terreiro-guia-para-iniciantes',
  '/conteudo/mensalidade-na-casa-de-axe-organizacao',
  '/conteudo/giras-festas-e-calendario-da-casa',
  '/conteudo/como-visitar-um-terreiro-com-respeito',
  '/conteudo/planilha-ou-software-quando-migrar-gestao-terreiro',
  '/conteudo/como-instalar-axecloud-celular-pwa',
  '/conteudo/whatsapp-oficial-vs-grupos-comunicacao-terreiro',
  '/conteudo/melhor-software-terreiro-2026-o-que-avaliar',
  '/conteudo/sistema-para-terreiro-guia-completo',
  '/conteudo/software-para-terreiro-de-umbanda-recursos',
  '/conteudo/gestao-financeira-terreiro-pix-mensalidades',
  '/conteudo/como-cobrar-mensalidade-terreiro-sem-constranger',
  '/conteudo/como-organizar-presenca-em-gira',
  '/conteudo/vale-a-pena-software-terreiro-pequeno',
  '/conteudo/portal-filho-de-santo-no-celular',
  '/conteudo/o-que-sistema-terreiro-precisa-ter-2026',
];

const FEATURE_PATHS = [
  '/recursos',
  '/recursos/financeiro-pix-mensalidades',
  '/recursos/calendario-giras',
  '/recursos/portal-filho-de-santo',
  '/recursos/whatsapp-oficial',
  '/recursos/app-pwa-terreiro',
  '/recursos/painel-do-zelador',
  '/recursos/cadastro-filhos-de-santo',
  '/recursos/mural-de-avisos',
  '/recursos/galeria-fotos-terreiro',
  '/recursos/biblioteca-estudos-terreiro',
  '/recursos/loja-do-axe',
  '/recursos/almoxarifado-terreiro',
  '/recursos/atendimentos-pedidos-reza',
  '/recursos/diretorio-publico-terreiros',
  '/recursos/notificacoes-push',
  '/recursos/obrigacoes-alertas',
  '/recursos/frequencia-check-in',
  '/recursos/central-relatorios',
  '/recursos/patrimonio-sagrado',
  '/recursos/documentos-da-casa',
  '/recursos/consulentes-agenda',
  '/recursos/caminhada-mediunica',
  '/recursos/calendario-liturgico',
  '/recursos/desenvolvimento-mediunico',
  '/recursos/controle-camarinha',
];

const COMMERCIAL_PATHS = [
  '/sistema-de-gestao-para-terreiros',
  '/financeiro-para-terreiros',
  '/mensalidades-para-terreiros',
  '/gestao-de-filhos-de-santo',
];

const PUBLIC_SITE_SHELL_LASTMOD = '2026-08-27';
const LEGAL_CONTENT_LASTMOD = '2026-08-14';

const SITEMAP_BASE_ROUTES = [
  {
    path: '/',
    changeFrequency: 'weekly',
    priority: 1,
    comment: 'Página inicial — login e apresentação',
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
    path: '/por-que-axecloud/vs-planilhas',
    changeFrequency: 'monthly',
    priority: 0.9,
    comment: 'AxéCloud vs planilhas — decisão de migração',
  },
  ...COMMERCIAL_PATHS.map((path, index) => ({
    path,
    changeFrequency: 'monthly',
    priority: index === 0 ? 0.95 : 0.9,
    comment: 'Página comercial de alta intenção',
  })),
  ...FEATURE_PATHS.map((path) => ({
    path,
    changeFrequency: 'monthly',
    priority: path === '/recursos' ? 0.9 : 0.85,
    comment: 'Página de recurso / funcionalidade',
  })),
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

export const SITEMAP_ROUTES = SITEMAP_BASE_ROUTES.map((route) => ({
  ...route,
  lastModified:
    route.path === '/termos' || route.path === '/privacidade'
      ? LEGAL_CONTENT_LASTMOD
      : PUBLIC_SITE_SHELL_LASTMOD,
}));
