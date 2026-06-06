import { landingScreenshot } from './landingScreenshots';

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
  title: 'Apps para aproximar sua casa dos filhos de santo e da diretoria',
  lead: 'Além da gestão interna, o AxéCloud oferece acesso online para que filhos de santo e zeladores acompanhem giras, avisos e mensalidades com mais praticidade — direto no celular, sem instalar pela loja.',
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
    screenshot: landingScreenshot('portal-filho-home.png'),
    screenshotAlt: 'Tela inicial do portal do filho de santo no celular',
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
    screenshot: landingScreenshot('painel-zelador-home.png'),
    screenshotAlt: 'Dashboard do zelador do AxéCloud no celular',
  },
] as const;
