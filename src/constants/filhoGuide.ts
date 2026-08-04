import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CalendarDays,
  Flame,
  Megaphone,
  MessageCircle,
  ShoppingBag,
  UserCircle,
  Wallet,
} from 'lucide-react';

export const FILHO_WELCOME_SEEN_KEY = 'axecloud:filho-welcome-seen';
export const FILHO_OPEN_GUIDE_EVENT = 'axecloud:open-filho-guide';

export type FilhoGuideFeature = {
  tab: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  tone: 'cyan' | 'violet' | 'green' | 'rose' | 'gold' | 'slate' | 'amber' | 'teal';
};

/** Oito funções do portal do filho — copy direta para descoberta. */
export const FILHO_GUIDE_FEATURES: FilhoGuideFeature[] = [
  {
    tab: 'profile',
    label: 'Início',
    detail: 'Resumo da casa e o que pede sua atenção agora',
    icon: UserCircle,
    tone: 'slate',
  },
  {
    tab: 'obrigacoes',
    label: 'Obrigações',
    detail: 'Orientações e preceitos da sua caminhada',
    icon: Flame,
    tone: 'violet',
  },
  {
    tab: 'financial',
    label: 'Mensalidade',
    detail: 'Ver pendência e pagar com Pix',
    icon: Wallet,
    tone: 'green',
  },
  {
    tab: 'calendar',
    label: 'Giras',
    detail: 'Agenda da casa e confirmar presença',
    icon: CalendarDays,
    tone: 'cyan',
  },
  {
    tab: 'library',
    label: 'Biblioteca',
    detail: 'Materiais e estudos liberados pela casa',
    icon: BookOpen,
    tone: 'gold',
  },
  {
    tab: 'store',
    label: 'Loja',
    detail: 'Ver produtos e reservar itens da casa',
    icon: ShoppingBag,
    tone: 'amber',
  },
  {
    tab: 'mural',
    label: 'Comunicados',
    detail: 'Recados e avisos publicados pela casa',
    icon: Megaphone,
    tone: 'rose',
  },
  {
    tab: 'chat',
    label: 'Conversas',
    detail: 'Falar diretamente com a casa',
    icon: MessageCircle,
    tone: 'teal',
  },
];

export function openFilhoGuide(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FILHO_OPEN_GUIDE_EVENT));
}
