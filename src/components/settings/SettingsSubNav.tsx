import { MessageSquare, Settings, Trash2, User, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export type SettingsSection = 'profile' | 'whatsapp';

type NavItem = {
  id: SettingsSection;
  label: string;
  description: string;
  icon: LucideIcon;
  iconClass?: string;
};

const ITEMS: NavItem[] = [
  { id: 'profile', label: 'Conta e Casa', description: 'Identidade, foto e acesso', icon: User },
  { id: 'whatsapp', label: 'WhatsApp', description: 'Canal e automações', icon: MessageSquare },
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
        'group flex min-h-14 min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B98B0D] focus-visible:ring-offset-2',
        isActive
          ? 'border-[#173323] bg-[#173323] text-white shadow-[0_12px_24px_-18px_rgba(23,51,35,.8)]'
          : 'border-transparent bg-transparent text-[#352F27] hover:border-[#D7C9AE] hover:bg-[#FFF9ED]',
      )}
    >
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', isActive ? 'bg-[#F4C430] text-[#173323]' : 'bg-[#E5DCCB] text-[#6B5830]', item.iconClass)}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className={cn('block text-xs font-black', isActive ? 'text-white' : 'text-[#2B251D]')}>{item.label}</span>
        <span className={cn('mt-0.5 block text-[10px] font-semibold', isActive ? 'text-white/55' : 'text-[#7A7165]')}>{item.description}</span>
      </span>
    </button>
  );
}

export function SettingsSubNav({ active, onChange }: SettingsSubNavProps) {
  return (
    <nav
      aria-label="Áreas de configuração"
      className="settings-subnav grid grid-cols-2 gap-2 lg:grid-cols-1"
    >
      {ITEMS.map((item) => (
        <NavButton key={item.id} item={item} isActive={active === item.id} onChange={onChange} />
      ))}
    </nav>
  );
}

export function SettingsTabHeader() {
  return (
    <div className="settings-tab-header border-b border-white/10 bg-[#10281B] px-5 py-6 text-white sm:px-7 sm:py-7">
      <div className="flex max-w-3xl items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#F4C430] text-[#173323]">
          <Settings className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight text-white sm:text-3xl">Configurações</h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-white/65">
            Gerencie a identidade da casa, a segurança da conta e os avisos pelo WhatsApp.
          </p>
        </div>
      </div>
    </div>
  );
}
