import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  BookOpen,
  CalendarDays,
  HandHeart,
  ImageIcon,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Package,
  Smartphone,
  Store,
  Users,
  Wallet,
  Globe,
} from 'lucide-react';
import type { LandingIconAccent } from '../components/landing/landingIconAccents';

export type LandingModuleItem = {
  id: string;
  icon: LucideIcon;
  iconAccent: LandingIconAccent;
  title: string;
  description: string;
  /** Módulo disponível no painel hoje (não roadmap). */
  live: true;
};

/** Catálogo completo de módulos reais do AxéCloud — fonte única para landing, comparativo e SEO. */
export const LANDING_MODULES: readonly LandingModuleItem[] = [
  {
    id: 'painel',
    icon: LayoutDashboard,
    iconAccent: 'violet',
    title: 'Painel do zelador',
    description:
      'Resumo da casa: filhos cadastrados, giras próximas, pendências financeiras e atalhos para a rotina da diretoria.',
    live: true,
  },
  {
    id: 'filhos',
    icon: Users,
    iconAccent: 'gold',
    title: 'Filhos de santo',
    description:
      'Cadastro com cargos litúrgicos, orixás, guias, contatos e ficha espiritual — termos reais da sua tradição.',
    live: true,
  },
  {
    id: 'agenda',
    icon: CalendarDays,
    iconAccent: 'rose',
    title: 'Calendário de giras',
    description:
      'Giras, festas, obrigações e eventos. Convites com confirmação de presença e lembretes para a comunidade.',
    live: true,
  },
  {
    id: 'financeiro',
    icon: Wallet,
    iconAccent: 'emerald',
    title: 'Financeiro + Pix',
    description:
      'Mensalidades, doações, despesas e caixinha. Pix integrado, histórico transparente e cobrança sem planilha.',
    live: true,
  },
  {
    id: 'mural',
    icon: Megaphone,
    iconAccent: 'sky',
    title: 'Mural de avisos',
    description:
      'Comunicados oficiais da diretoria visíveis no portal — menos dependência de grupos espalhados no WhatsApp.',
    live: true,
  },
  {
    id: 'galeria',
    icon: ImageIcon,
    iconAccent: 'violet',
    title: 'Galeria de fotos',
    description:
      'Álbuns por gira, festa ou tema. Memória da casa reunida com acesso controlado pela diretoria.',
    live: true,
  },
  {
    id: 'biblioteca',
    icon: BookOpen,
    iconAccent: 'amber',
    title: 'Biblioteca de estudo',
    description:
      'Materiais, pontos e textos organizados para filhos de santo aprofundarem a caminhada na casa.',
    live: true,
  },
  {
    id: 'loja',
    icon: Store,
    iconAccent: 'gold',
    title: 'Loja do axé',
    description:
      'Venda de velas, ervas e itens da casa com pedidos e estoque integrados ao financeiro.',
    live: true,
  },
  {
    id: 'almoxarifado',
    icon: Package,
    iconAccent: 'emerald',
    title: 'Almoxarifado',
    description:
      'Controle de materiais rituais, velas e insumos. Alertas de estoque crítico via WhatsApp (Meta).',
    live: true,
  },
  {
    id: 'whatsapp',
    icon: MessageCircle,
    iconAccent: 'sky',
    title: 'WhatsApp oficial (Meta)',
    description:
      'Lembretes de gira, convites, mensalidade e estoque — templates aprovados pela Meta Cloud API.',
    live: true,
  },
  {
    id: 'atendimentos',
    icon: HandHeart,
    iconAccent: 'rose',
    title: 'Atendimentos e pedidos de reza',
    description:
      'Pedidos do Espaço do Fiel chegam no painel. Zelador aceita, responde e acompanha com privacidade.',
    live: true,
  },
  {
    id: 'portal',
    icon: Globe,
    iconAccent: 'violet',
    title: 'Portal público e diretório',
    description:
      'Perfil da casa por cidade, eventos públicos e visibilidade no portal do axé — além da gestão interna.',
    live: true,
  },
  {
    id: 'pwa',
    icon: Smartphone,
    iconAccent: 'amber',
    title: 'App instalável (PWA)',
    description:
      'Fixe na tela inicial do celular ou computador — ícone como app, sem baixar na App Store ou Google Play.',
    live: true,
  },
  {
    id: 'push',
    icon: Bell,
    iconAccent: 'sky',
    title: 'Notificações push',
    description:
      'Avisos no celular quando a diretoria publica no mural ou quando há novidade na casa.',
    live: true,
  },
] as const;

export const LANDING_MODULES_HEADING = {
  kicker: 'Módulos reais',
  title: 'Tudo que já existe no AxéCloud — hoje',
  lead: 'Não é promessa de roadmap: são módulos ativos no painel do zelador e no portal do filho de santo. Um valor, sem cobrar por módulo extra.',
} as const;
