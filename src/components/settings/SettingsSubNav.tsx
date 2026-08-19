import {
  CreditCard,
  MapPinned,
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
  { id: 'profile', label: 'Conta e Casa', description: 'Identidade, foto e acesso', icon: User },
  { id: 'whatsapp', label: 'WhatsApp', description: 'Canal e automações', icon: MessageSquare },
  { id: 'subscription', label: 'Plano', description: 'Assinatura e recursos', icon: CreditCard },
  { id: 'portal', label: 'Dados do Mapa', description: 'Informações públicas da casa', icon: MapPinned },
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
          ? 'border-[#E5AE12]/55 bg-[#142019] shadow-[0_16px_34px_-24px_rgba(23,19,13,0.9)]'
          : 'border-[#DED5C7] bg-[#FFFDF8] hover:border-[#C6AF78] hover:bg-white',
      )}
    >
      <span
        className={cn(
          'absolute inset-y-0 left-0 w-1 transition-colors',
          isActive ? 'bg-[#E5AE12]' : 'bg-transparent group-hover:bg-[#C6AF78]',
        )}
      />
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl border', isActive ? 'border-[#E5AE12]/20 bg-[#E5AE12]/10 text-[#F5C842]' : 'border-[#E1D9CD] bg-[#F5F0E6] text-[#735F32]', item.iconClass)}>
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
    <div className="settings-tab-header relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_88%_10%,rgba(229,174,18,.18),transparent_28%),linear-gradient(135deg,#15231A,#0C1410)] px-5 py-7 text-white sm:px-7 sm:py-8">
      <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full border border-[#E5AE12]/10" />
      <div className="relative">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#F5C842]">Central da casa</p>
        <h1 className="flex items-center gap-3 font-display text-2xl font-black tracking-tight text-white sm:text-3xl">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#E5AE12]/20 bg-[#E5AE12]/10"><Settings className="h-5 w-5 text-[#F5C842]" aria-hidden /></span>
          Configurações
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-white/58">
          Uma central única para identidade, acessos, comunicação, assinatura e dados exibidos no mapa.
        </p>
      </div>
    </div>
  );
}
