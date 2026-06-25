import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Flame,
  Flower2,
  HandHeart,
  Home,
  Images,
  Landmark,
  LogOut,
  Megaphone,
  MessageCircle,
  Newspaper,
  Package,
  PieChart,
  Settings as SettingsIcon,
  ShoppingBag,
  Smartphone,
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
export const ZELADOR_CASA_CHILD_IDS = ['children', 'calendar', 'frequencia', 'mural', 'chat'] as const;

/** Sub-rotas do menu «Financeiro» (zelador). */
export const ZELADOR_FINANCIAL_CHILD_IDS = ['financial', 'financial-mensalidades', 'financial-configs'] as const;

export const ZELADOR_FINANCIAL_ITEMS: AppNavItem[] = [
  { id: 'financial', label: 'Visão geral', icon: PieChart },
  { id: 'financial-mensalidades', label: 'Mensalidades', icon: Wallet },
  { id: 'financial-configs', label: 'Configurações Pix', icon: Smartphone },
];

export type ZeladorNavEntry =
  | { type: 'item'; item: AppNavItem }
  | { type: 'casa'; label: string; icon: LucideIcon; items: AppNavItem[] }
  | { type: 'financial'; label: string; icon: LucideIcon; items: AppNavItem[] };

/** Mapeia id de navegação para feature de plano (sub-rotas do financeiro → `financial`). */
export function navItemPlanFeature(itemId: string): string {
  if (itemId === 'financial' || itemId.startsWith('financial-')) return 'financial';
  if (itemId === 'frequencia') return 'gestao_eventos';
  return itemId;
}

export type FinancialSubview = 'overview' | 'mensalidades' | 'configs';

export function isFinancialNavTab(tab: string): boolean {
  return tab === 'financial' || tab.startsWith('financial-');
}

export function financialSubviewFromTab(tab: string): FinancialSubview {
  if (tab === 'financial-mensalidades') return 'mensalidades';
  if (tab === 'financial-configs') return 'configs';
  return 'overview';
}

const ZELADOR_CORE: AppNavItem[] = [
  { id: 'dashboard', label: 'Início', icon: Home, filledWhenActive: true },
  { id: 'children', label: 'Filhos de Santo', icon: User },
  { id: 'financial', label: 'Financeiro', icon: PieChart },
  { id: 'calendar', label: 'Giras', icon: CalendarDays },
  { id: 'frequencia', label: 'Frequência', icon: ClipboardList },
  { id: 'mural', label: 'Mural', icon: Megaphone },
  { id: 'chat', label: 'Mensagens', icon: MessageCircle },
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

/** Menu do zelador com grupos «Casa» e «Financeiro» para caber sem scroll horizontal. */
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
    if (item.id === 'financial') {
      entries.push({
        type: 'financial',
        label: 'Financeiro',
        icon: PieChart,
        items: ZELADOR_FINANCIAL_ITEMS,
      });
      continue;
    }
    entries.push({ type: 'item', item });
  }

  return entries;
}

/** Todos os itens selecionáveis (inclui filhos de grupos) para breadcrumb e estado ativo. */
export function flattenZeladorNavEntries(entries: ZeladorNavEntry[]): AppNavItem[] {
  const flat: AppNavItem[] = [];
  for (const entry of entries) {
    if (entry.type === 'item') flat.push(entry.item);
    else flat.push(...entry.items);
  }
  return flat;
}

export const FILHO_NAV: AppNavItem[] = [
  { id: 'profile', label: 'Meu Perfil', icon: UserCircle },
  { id: 'obrigacoes', label: 'Obrigações', icon: Flame },
  { id: 'financial', label: 'Mensalidade', icon: Wallet },
  { id: 'calendar', label: 'Giras', icon: CalendarDays },
  { id: 'library', label: 'Biblioteca', icon: BookOpen },
  { id: 'store', label: 'Loja', icon: ShoppingBag },
  { id: 'mural', label: 'Mural', icon: Newspaper },
  { id: 'chat', label: 'Conversas', icon: MessageCircle },
];

export { LogOut };
