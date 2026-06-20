export type LandingAppCard = {
  id: string;
  badge: string;
  title: string;
  description: string;
  who: string;
  features: readonly string[];
};

export const LANDING_APPS_HEADING = {
  kicker: 'Apps & PWA',
  title: 'Dois acessos para a casa — portal da comunidade e painel da diretoria',
  lead: 'O Ilê Asé funciona no navegador do celular ou do computador. Filhos de santo acompanham a casa pelo portal; zeladores e diretoria administram tudo pelo painel. Nos dois casos, dá para fixar na tela inicial como um app (PWA) — sem baixar na App Store ou Google Play.',
} as const;

export const LANDING_APP_CARDS: readonly LandingAppCard[] = [
  {
    id: 'filho',
    badge: 'Para filhos de santo',
    title: 'Portal do Filho de Santo',
    who: 'Quem já é cadastrado na casa entra com login e senha.',
    description:
      'Acesso respeitoso e organizado: agenda de giras, mural da casa, mensalidades com Pix e avisos importantes — tudo num só lugar, no celular ou no computador.',
    features: [
      'Calendário de giras, obrigações e eventos da casa',
      'Mural com comunicados e avisos da diretoria',
      'Mensalidades, histórico e pagamento via Pix',
      'Fixa na tela inicial do celular (PWA) em segundos',
    ],
  },
  {
    id: 'zelador',
    badge: 'Para zelador e diretoria',
    title: 'Painel do Zelador',
    who: 'Zeladores e diretoria entram com e-mail e senha do terreiro.',
    description:
      'Gestão completa da casa: filhos de santo, financeiro, giras, galeria, mural, biblioteca e loja do axé — no desktop ou no celular, com a mesma conta.',
    features: [
      'Cadastro, perfis e documentos dos filhos de santo',
      'Financeiro transparente com Pix e relatórios',
      'Calendário, galeria, mural e biblioteca de estudo',
      'Painel responsivo — use no celular como app (PWA)',
    ],
  },
] as const;

export const LANDING_PWA_STEPS = [
  {
    step: '1',
    title: 'Abre no navegador',
    desc: 'Acesse axecloud.com.br pelo Chrome ou Safari — no celular ou no PC.',
  },
  {
    step: '2',
    title: 'Entra com sua conta',
    desc: 'Filho de santo: login da casa. Zelador: e-mail cadastrado no terreiro.',
  },
  {
    step: '3',
    title: 'Fixa na tela inicial',
    desc: 'No celular, use “Adicionar à tela inicial”. Vira ícone como app, sem loja.',
  },
] as const;
