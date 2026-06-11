import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CalendarDays,
  Flower2,
  HandHeart,
  Home,
  Images,
  LogOut,
  Megaphone,
  Newspaper,
  Package,
  PieChart,
  Settings as SettingsIcon,
  ShoppingBag,
  User,
  UserCircle,
  Wallet,
} from 'lucide-react';
import { showAtendimentosModule, showCamarinhaModule } from '../lib/tradicaoModules';

export type AppNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  filledWhenActive?: boolean;
};

const ZELADOR_CORE: AppNavItem[] = [
  { id: 'dashboard', label: 'Início', icon: Home, filledWhenActive: true },
  { id: 'children', label: 'Filhos de Santo', icon: User },
  { id: 'financial', label: 'Financeiro', icon: PieChart },
  { id: 'calendar', label: 'Giras', icon: CalendarDays },
  { id: 'mural', label: 'Mural', icon: Megaphone },
  { id: 'gallery', label: 'Galeria', icon: Images },
  { id: 'inventory', label: 'Almoxarifado', icon: Package },
  { id: 'library', label: 'Biblioteca', icon: BookOpen },
  { id: 'store', label: 'Loja', icon: ShoppingBag },
  { id: 'settings', label: 'Configurações', icon: SettingsIcon },
];

export function buildZeladorNavItems(tradicao?: string | null): AppNavItem[] {
  const tradition: AppNavItem[] = [];
  if (showCamarinhaModule(tradicao)) {
    tradition.push({ id: 'camarinha', label: 'Camarinha', icon: Flower2 });
  }
  if (showAtendimentosModule(tradicao)) {
    tradition.push({ id: 'atendimentos', label: 'Atendimentos', icon: HandHeart });
  }
  if (tradition.length === 0) return ZELADOR_CORE;
  const storeIdx = ZELADOR_CORE.findIndex((i) => i.id === 'store');
  const beforeStore = ZELADOR_CORE.slice(0, storeIdx);
  const storeAndAfter = ZELADOR_CORE.slice(storeIdx);
  return [...beforeStore, ...tradition, ...storeAndAfter];
}

export const FILHO_NAV: AppNavItem[] = [
  { id: 'profile', label: 'Meu Perfil', icon: UserCircle },
  { id: 'financial', label: 'Mensalidade', icon: Wallet },
  { id: 'calendar', label: 'Giras', icon: CalendarDays },
  { id: 'library', label: 'Biblioteca', icon: BookOpen },
  { id: 'store', label: 'Loja', icon: ShoppingBag },
  { id: 'mural', label: 'Mural', icon: Newspaper },
];

export { LogOut };
