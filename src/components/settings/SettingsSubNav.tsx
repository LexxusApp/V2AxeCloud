import {
  CreditCard,
  Globe,
  MessageSquare,
  Settings,
  User,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type SettingsSection = 'profile' | 'terreiro' | 'whatsapp' | 'subscription' | 'portal';

type NavItem = {
  id: SettingsSection;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  iconClass?: string;
  activeBorder?: string;
};

const ITEMS: NavItem[] = [
  { id: 'profile', label: 'Perfil do Zelador', shortLabel: 'Perfil', icon: User, iconClass: 'text-[#3B82F6]', activeBorder: 'border-l-[#3B82F6]' },
  { id: 'terreiro', label: 'Informações do Terreiro', shortLabel: 'Terreiro', icon: Globe, iconClass: 'text-cyan-400', activeBorder: 'border-l-cyan-400' },
  { id: 'whatsapp', label: 'WhatsApp', shortLabel: 'WhatsApp', icon: MessageSquare, iconClass: 'text-[#10B981]', activeBorder: 'border-l-[#10B981]' },
  { id: 'subscription', label: 'Assinatura', shortLabel: 'Plano', icon: CreditCard, iconClass: 'text-primary', activeBorder: 'border-l-primary' },
  { id: 'portal', label: 'Portal do Consulente', shortLabel: 'Portal', icon: Globe, iconClass: 'text-sky-400', activeBorder: 'border-l-sky-400' },
];

type SettingsSubNavProps = {
  active: SettingsSection;
  onChange: (section: SettingsSection) => void;
};

function NavButton({
  item,
  isActive,
  onChange,
  compact = false,
}: {
  item: NavItem;
  isActive: boolean;
  onChange: (section: SettingsSection) => void;
  compact?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onChange(item.id)}
      className={cn(
        'flex items-center gap-2 font-bold transition-all',
        compact
          ? cn(
              'shrink-0 rounded-full border px-3 py-2 text-[11px] whitespace-nowrap',
              isActive
                ? 'border-primary/40 bg-primary/15 text-primary'
                : 'border-[#1E242B] bg-[#12161A] text-[#94A3B8] hover:text-white',
            )
          : cn(
              'w-full rounded-xl px-3.5 py-3 text-left text-xs',
              isActive
                ? cn('border-l-2 bg-[#1E252E] text-white shadow-sm', item.activeBorder)
                : 'text-[#94A3B8] hover:bg-white/5 hover:text-white',
            ),
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', item.iconClass)} aria-hidden />
      {compact ? item.shortLabel : item.label}
    </button>
  );
}

export function SettingsSubNav({ active, onChange }: SettingsSubNavProps) {
  return (
    <>
      <div className="lg:hidden">
        <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Sub-Menus</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#334155]">
          {ITEMS.map((item) => (
            <NavButton key={item.id} item={item} isActive={active === item.id} onChange={onChange} compact />
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-[#1E242B] bg-[#12161A]/80 p-3 text-center">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-500">
            Identidade de Fé
          </span>
          <p className="mt-1 text-[9px] leading-normal text-gray-400">
            As alterações refletem no mural, financeiro e na corrente de filhos de santo.
          </p>
        </div>
      </div>

      <div className="hidden space-y-2 lg:block">
        <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Sub-Menus</p>
        {ITEMS.map((item) => (
          <NavButton key={item.id} item={item} isActive={active === item.id} onChange={onChange} />
        ))}

        <div className="mt-4 border-t border-[#1E242B] px-2 pt-4">
          <div className="space-y-1 rounded-lg border border-[#1E242B] bg-[#12161A]/80 p-3 text-center">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-500">
              Identidade de Fé
            </span>
            <p className="text-[9px] leading-normal text-gray-400">
              As atualizações feitas aqui refletem nas assinaturas de mensagens, no mural, no financeiro e na corrente
              de filhos de santo do terreiro.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export function SettingsTabHeader() {
  return (
    <div className="flex flex-col gap-4 border-b border-[#1E242B] pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h5 className="flex items-center gap-2 font-display text-lg font-bold text-[#F1F5F9]">
          <Settings className="h-5 w-5 text-[#3B82F6]" aria-hidden />
          Configurações da Zeladoria
        </h5>
        <p className="text-xs text-[#94A3B8]">
          Gerencie a identidade da casa de Axé, customize assinaturas litúrgicas e conecte o WhatsApp do terreiro.
        </p>
      </div>
    </div>
  );
}
