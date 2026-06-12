import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CalendarDays,
  Flower2,
  HandHeart,
  Home,
  Images,
  Landmark,
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

/** Módulos agrupados no menu «Casa» (zelador). */
export const ZELADOR_CASA_CHILD_IDS = ['children', 'calendar', 'mural'] as const;

export type ZeladorNavEntry =
  | { type: 'item'; item: AppNavItem }
  | { type: 'casa'; label: string; icon: LucideIcon; items: AppNavItem[] };

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

/** Menu do zelador com grupo «Casa» (Filhos, Giras, Mural) para caber sem scroll horizontal. */
export function buildZeladorNavEntries(tradicao?: string | null): ZeladorNavEntry[] {
  const items = buildZeladorNavItems(tradicao);
  const casaSet = new Set<string>(ZELADOR_CASA_CHILD_IDS);
  const casaItems = ZELADOR_CASA_CHILD_IDS.map((id) => items.find((i) => i.id === id)).filter(
    (i): i is AppNavItem => i != null,
  );

  const entries: ZeladorNavEntry[] = [];
  let casaInserted = false;

  for (const item of items) {
    if (casaSet.has(item.id)) {
      if (!casaInserted) {
        entries.push({
          type: 'casa',
          label: 'Casa',
          icon: Landmark,
          items: casaItems,
        });
        casaInserted = true;
      }
      continue;
    }
    entries.push({ type: 'item', item });
  }

  return entries;
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
