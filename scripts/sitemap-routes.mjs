/**
 * Rotas públicas indexáveis do AxéCloud (SPA Vite).
 * Edite aqui ao adicionar páginas de marketing ou legais com URL própria.
 *
 * Não inclua áreas autenticadas (dashboard, configurações, etc.).
 */

export const SITEMAP_ROUTES = [
  {
    path: '/',
    changeFrequency: 'weekly',
    priority: 1,
    comment: 'Página inicial — login e apresentação',
  },
  {
    path: '/login',
    changeFrequency: 'monthly',
    priority: 0.9,
    comment: 'Entrada direta para login',
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
  {
    path: '/conteudo/como-o-axecloud-ajuda-terreiros',
    changeFrequency: 'monthly',
    priority: 0.8,
    comment: 'Artigo — como o AxéCloud ajuda terreiros',
  },
  {
    path: '/conteudo/glossario',
    changeFrequency: 'monthly',
    priority: 0.8,
    comment: 'Glossário do axé',
  },
];
