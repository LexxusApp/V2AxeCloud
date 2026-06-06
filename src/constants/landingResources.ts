import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  ImageIcon,
  Megaphone,
  Smartphone,
  Users,
  Wallet,
} from 'lucide-react';

export type LandingResourceItem = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
};

/** Módulos reais do AxéCloud — espelha a grade de recursos do mercado, com vocabulário da casa. */
export const LANDING_RESOURCES: readonly LandingResourceItem[] = [
  {
    id: 'agenda',
    icon: CalendarDays,
    title: 'Calendário de giras',
    description:
      'Organize giras, festas, obrigações e compromissos da casa em uma agenda visual que zelador e filhos de santo acompanham juntos.',
  },
  {
    id: 'financeiro',
    icon: Wallet,
    title: 'Financeiro + Pix',
    description:
      'Controle mensalidades, doações e despesas com Pix integrado, histórico claro e leitura transparente para a diretoria.',
  },
  {
    id: 'filhos',
    icon: Users,
    title: 'Filhos de santo',
    description:
      'Cadastre filhos de santo, cargos, orixás e contatos. Toda a corrente da casa organizada num único painel.',
  },
  {
    id: 'mural',
    icon: Megaphone,
    title: 'Mural de avisos',
    description:
      'Publique comunicados oficiais da diretoria para a comunidade — avisos visíveis no portal, sem depender só de grupos.',
  },
  {
    id: 'galeria',
    icon: ImageIcon,
    title: 'Galeria de fotos',
    description:
      'Álbuns por gira e evento: memória do terreiro reunida em um só lugar, com acesso controlado pela casa.',
  },
  {
    id: 'acesso',
    icon: Smartphone,
    title: 'Acesso online',
    description:
      'Funciona no celular, tablet ou computador pelo navegador — zelador, filhos de santo e diretoria, sem instalar app.',
  },
] as const;

export const LANDING_RESOURCES_HEADING = {
  kicker: 'Recursos',
  title: 'Tudo que sua casa precisa organizar em um só lugar',
  lead: 'Filhos de santo, giras, financeiro, mural, galeria e portal reunidos numa plataforma simples, segura e feita para terreiros de axé.',
} as const;
