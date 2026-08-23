import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  HandHeart,
  Megaphone,
  MessageCircle,
  PackageCheck,
  Settings2,
  Users,
  Wallet,
} from 'lucide-react';

type ContextAction = {
  eyebrow: string;
  title: string;
  detail: string;
  action: string;
  target: string;
  icon: typeof ArrowRight;
};

const ADMIN_ACTIONS: Record<string, ContextAction> = {
  dashboard: {
    eyebrow: 'Próximo passo sugerido',
    title: 'Organize o próximo movimento da casa',
    detail: 'Agenda, corrente e avisos começam pela próxima gira.',
    action: 'Abrir agenda',
    target: 'calendar',
    icon: CalendarDays,
  },
  children: {
    eyebrow: 'Depois do cadastro',
    title: 'Mantenha a corrente financeiramente organizada',
    detail: 'Confira cobranças e mensalidades vinculadas aos filhos.',
    action: 'Ver mensalidades',
    target: 'financial-mensalidades',
    icon: Wallet,
  },
  calendar: {
    eyebrow: 'Com a gira organizada',
    title: 'Avise toda a corrente',
    detail: 'Transforme o próximo evento em um comunicado claro.',
    action: 'Criar comunicado',
    target: 'mural',
    icon: Megaphone,
  },
  frequencia: {
    eyebrow: 'Após conferir presenças',
    title: 'Revise a agenda da casa',
    detail: 'Use as próximas giras para preparar a corrente.',
    action: 'Abrir agenda',
    target: 'calendar',
    icon: CalendarDays,
  },
  mural: {
    eyebrow: 'Comunicação em movimento',
    title: 'Acompanhe as respostas da corrente',
    detail: 'Continue a conversa nos canais da casa.',
    action: 'Abrir mensagens',
    target: 'chat',
    icon: Megaphone,
  },
  chat: {
    eyebrow: 'Conversa com contexto',
    title: 'Consulte a pessoa antes de responder',
    detail: 'Acesse a corrente e confira o cadastro completo.',
    action: 'Ver corrente',
    target: 'children',
    icon: Users,
  },
  financial: {
    eyebrow: 'Rotina financeira',
    title: 'Confira quem ainda precisa de acompanhamento',
    detail: 'Concentre a revisão nas mensalidades em aberto.',
    action: 'Ver mensalidades',
    target: 'financial-mensalidades',
    icon: Wallet,
  },
  'financial-mensalidades': {
    eyebrow: 'Recebimentos preparados',
    title: 'Garanta que os dados Pix estejam corretos',
    detail: 'A chave e o vencimento alimentam todas as cobranças.',
    action: 'Configurar Pix',
    target: 'financial-configs',
    icon: Settings2,
  },
  'financial-configs': {
    eyebrow: 'Configuração concluída',
    title: 'Volte para a visão completa do caixa',
    detail: 'Acompanhe entradas, saídas e saldo da casa.',
    action: 'Ver financeiro',
    target: 'financial',
    icon: Wallet,
  },
  gallery: {
    eyebrow: 'Memória com contexto',
    title: 'Relacione os registros à rotina da casa',
    detail: 'Confira a agenda antes de organizar o próximo álbum.',
    action: 'Ver giras',
    target: 'calendar',
    icon: Camera,
  },
  inventory: {
    eyebrow: 'Estoque conferido',
    title: 'Prepare os itens para a próxima gira',
    detail: 'A agenda ajuda a antecipar compras e reposições.',
    action: 'Ver próxima gira',
    target: 'calendar',
    icon: PackageCheck,
  },
  library: {
    eyebrow: 'Conhecimento compartilhado',
    title: 'Avise a corrente sobre o novo material',
    detail: 'Leve o estudo publicado até quem precisa vê-lo.',
    action: 'Publicar aviso',
    target: 'mural',
    icon: BookOpen,
  },
  atendimentos: {
    eyebrow: 'Acolhimento em continuidade',
    title: 'Conecte os pedidos à próxima gira',
    detail: 'Veja quando a corrente estará reunida novamente.',
    action: 'Abrir agenda',
    target: 'calendar',
    icon: HandHeart,
  },
  settings: {
    eyebrow: 'Casa configurada',
    title: 'Confira a experiência entregue à corrente',
    detail: 'Volte ao início e veja o sistema como um todo.',
    action: 'Ver início',
    target: 'dashboard',
    icon: Settings2,
  },
  subscription: {
    eyebrow: 'Continuidade da casa',
    title: 'Assinatura conferida, rotina protegida',
    detail: 'Volte ao painel para continuar a gestão do terreiro.',
    action: 'Voltar ao início',
    target: 'dashboard',
    icon: Wallet,
  },
  suporte: {
    eyebrow: 'Precisa de ajuda?',
    title: 'Nossa equipe responde pelo WhatsApp',
    detail: 'Descreva o problema e retornamos no número informado.',
    action: 'Ver início',
    target: 'dashboard',
    icon: Settings2,
  },
};

const FILHO_ACTIONS: Record<string, ContextAction> = {
  profile: {
    eyebrow: 'Sua próxima ação',
    title: 'Confira a agenda da casa',
    detail: 'Veja giras, festas e compromissos da corrente.',
    action: 'Abrir agenda',
    target: 'calendar',
    icon: CalendarDays,
  },
  financial: {
    eyebrow: 'Depois da mensalidade',
    title: 'Continue acompanhando sua caminhada',
    detail: 'Volte ao seu perfil e veja os próximos movimentos.',
    action: 'Ver perfil',
    target: 'profile',
    icon: Users,
  },
  calendar: {
    eyebrow: 'Agenda conferida',
    title: 'Veja os avisos mais recentes',
    detail: 'A casa pode ter publicado orientações para a próxima gira.',
    action: 'Abrir mural',
    target: 'mural',
    icon: Megaphone,
  },
  library: {
    eyebrow: 'Depois do estudo',
    title: 'Volte para sua trajetória',
    detail: 'Continue acompanhando sua caminhada dentro da casa.',
    action: 'Ver perfil',
    target: 'profile',
    icon: BookOpen,
  },
  mural: {
    eyebrow: 'Avisos conferidos',
    title: 'Veja quando a corrente se reúne',
    detail: 'Consulte a agenda para não perder o próximo encontro.',
    action: 'Abrir agenda',
    target: 'calendar',
    icon: CalendarDays,
  },
  obrigacoes: {
    eyebrow: 'Orientações conferidas',
    title: 'Confirme a próxima gira',
    detail: 'A casa precisa saber se você estará na corrente.',
    action: 'Abrir agenda',
    target: 'calendar',
    icon: CalendarDays,
  },
  store: {
    eyebrow: 'Depois da loja',
    title: 'Fale com a casa se precisar',
    detail: 'Use as conversas para tirar dúvidas sobre pedidos e reservas.',
    action: 'Abrir conversas',
    target: 'chat',
    icon: MessageCircle,
  },
  chat: {
    eyebrow: 'Conversa em andamento',
    title: 'Veja o que a casa publicou',
    detail: 'Recados e avisos ficam no mural dos comunicados.',
    action: 'Abrir mural',
    target: 'mural',
    icon: Megaphone,
  },
};

export function ContextualActionBar({
  activeTab,
  userRole,
  onNavigate,
}: {
  activeTab: string;
  userRole?: string | null;
  onNavigate: (tab: string) => void;
}) {
  const actions = userRole === 'filho' ? FILHO_ACTIONS : ADMIN_ACTIONS;
  const item = actions[activeTab] || actions.dashboard || FILHO_ACTIONS.profile;
  if (!item) return null;
  const Icon = item.icon;

  return (
    <div className="context-action-wrap">
      <aside className="context-action" aria-label="Próxima ação sugerida">
        <span className="context-action__icon"><Icon className="h-4 w-4" aria-hidden /></span>
        <span className="context-action__copy">
          <small>{item.eyebrow}</small>
          <strong>{item.title}</strong>
          <span>{item.detail}</span>
        </span>
        <button type="button" onClick={() => onNavigate(item.target)}>
          {item.action}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </aside>
    </div>
  );
}
