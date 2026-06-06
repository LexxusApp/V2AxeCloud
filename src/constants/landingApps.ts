export type LandingAppCard = {
  id: string;
  badge: string;
  title: string;
  description: string;
  features: readonly string[];
  screenshot: string;
  screenshotAlt: string;
};

export const LANDING_APPS_HEADING = {
  kicker: 'Apps & PWA',
  title: 'Apps para aproximar sua casa da comunidade e dos consulentes',
  lead: 'Além da gestão interna, o AxéCloud oferece portais online para filhos de santo, zeladores e consulentes — giras, avisos, mensalidades e pedidos de reza com praticidade no celular.',
} as const;

export const LANDING_APP_CARDS: readonly LandingAppCard[] = [
  {
    id: 'filho',
    badge: 'Para filhos de santo',
    title: 'Portal do Filho de Santo',
    description:
      'A casa compartilha agenda, comunicados e informações importantes com a comunidade em um acesso simples, organizado e respeitoso.',
    features: [
      'Calendário de giras e obrigações',
      'Comunicados do mural da casa',
      'Mensalidades e Pix integrado',
      'Acesso simples pelo celular (PWA)',
    ],
    screenshot: '/screenshots/acesso-celular.png',
    screenshotAlt: 'Portal do filho de santo do AxéCloud no celular',
  },
  {
    id: 'zelador',
    badge: 'Para zelador e diretoria',
    title: 'Painel do Zelador',
    description:
      'A diretoria administra filhos de santo, finanças, giras e galeria em um painel completo — no computador ou no celular.',
    features: [
      'Cadastro e gestão de filhos de santo',
      'Financeiro transparente com Pix',
      'Galeria de fotos e calendário de giras',
      'Mural, biblioteca e loja do axé',
    ],
    screenshot: '/screenshots/painel-inicio.png',
    screenshotAlt: 'Painel do zelador do AxéCloud no celular',
  },
  {
    id: 'consulente',
    badge: 'Para consulentes',
    title: 'Portal do Consulente',
    description:
      'Quem consulta a casa pode enviar pedidos de reza e acompanhar avisos importantes em um acesso público simples, sem precisar ser filho de santo.',
    features: [
      'Pedidos de reza pela internet',
      'Avisos e orientações da casa',
      'Contacto organizado para a diretoria',
      'Atendimento centralizado no painel',
    ],
    screenshot: '/screenshots/formulario-de-acesso.png',
    screenshotAlt: 'Portal do consulente do AxéCloud',
  },
] as const;
