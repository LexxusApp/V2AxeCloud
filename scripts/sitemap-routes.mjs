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
];
