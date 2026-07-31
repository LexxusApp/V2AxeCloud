import {
  CreditCard,
  Globe,
  MessageSquare,
  Settings,
  Trash2,
  User,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type SettingsSection = 'profile' | 'whatsapp' | 'subscription' | 'portal';

type NavItem = {
  id: SettingsSection;
  label: string;
  description: string;
  icon: LucideIcon;
  iconClass?: string;
};

const ITEMS: NavItem[] = [
  { id: 'profile', label: 'Conta e Casa', description: 'Identidade, foto e acesso', icon: User, iconClass: 'text-[#60A5FA]' },
  { id: 'whatsapp', label: 'WhatsApp', description: 'Canal e automações', icon: MessageSquare, iconClass: 'text-[#34D399]' },
  { id: 'subscription', label: 'Plano', description: 'Assinatura e recursos', icon: CreditCard, iconClass: 'text-primary' },
  { id: 'portal', label: 'Portal Público', description: 'Diretório e pedidos', icon: Globe, iconClass: 'text-sky-300' },
];

type SettingsSubNavProps = {
  active: SettingsSection;
  onChange: (section: SettingsSection) => void;
  onDeleteAccount?: () => void;
};

export function SettingsDangerZone({ onDeleteAccount }: { onDeleteAccount?: () => void }) {
  if (!onDeleteAccount) return null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-rose-500/45 bg-[#2A0F15] p-4 shadow-[0_14px_36px_-28px_rgba(190,24,93,0.9)] sm:flex-row sm:items-center sm:justify-between">
      <div>
        <span className="block text-[10px] font-black uppercase tracking-wider text-rose-300">Zona de perigo</span>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-rose-100/80">
          Exclui permanentemente a conta, o terreiro e todos os dados relacionados.
        </p>
      </div>
      <button
        type="button"
        onClick={onDeleteAccount}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-400/40 bg-rose-600 px-4 text-xs font-black text-white shadow-lg shadow-rose-950/30 transition hover:bg-rose-500"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Excluir conta
      </button>
    </div>
  );
}

function NavButton({
  item,
  isActive,
  onChange,
}: {
  item: NavItem;
  isActive: boolean;
  onChange: (section: SettingsSection) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onChange(item.id)}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left transition',
        isActive
          ? 'border-primary/55 bg-[#11151A] shadow-[0_16px_34px_-24px_rgba(23,19,13,0.9)]'
          : 'border-[#252C35] bg-[#13171D] hover:border-[#3B4654] hover:bg-[#171C22]',
      )}
    >
      <span
        className={cn(
          'absolute inset-y-0 left-0 w-1 transition-colors',
          isActive ? 'bg-primary' : 'bg-transparent group-hover:bg-[#3B4654]',
        )}
      />
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/5 bg-[#0F1318]', item.iconClass)}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className={cn('block text-xs font-black', isActive ? 'text-white' : 'text-[#CBD5E1]')}>{item.label}</span>
        <span className="mt-0.5 block text-[10px] font-semibold text-[#94A3B8]">{item.description}</span>
      </span>
    </button>
  );
}

export function SettingsSubNav({ active, onChange }: SettingsSubNavProps) {
  return (
    <nav
      aria-label="Áreas de configuração"
      className="settings-subnav grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {ITEMS.map((item) => (
        <NavButton key={item.id} item={item} isActive={active === item.id} onChange={onChange} />
      ))}
    </nav>
  );
}

export function SettingsTabHeader() {
  return (
    <div className="settings-tab-header flex flex-col gap-4 border-b border-[#D8D0C4] pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">Painel da casa</p>
        <h1 className="flex items-center gap-2 font-display text-2xl font-black tracking-tight text-[#17130D] sm:text-3xl">
          <Settings className="h-6 w-6 text-[#3B82F6]" aria-hidden />
          Configurações
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm font-semibold leading-relaxed text-[#665F55]">
          Organize a identidade da casa, acessos, comunicações e presença pública.
        </p>
      </div>
    </div>
  );
}
