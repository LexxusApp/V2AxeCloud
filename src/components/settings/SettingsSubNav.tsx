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
    <div className="settings-tab-header relative overflow-hidden border-b border-[#D4AF37]/35 bg-gradient-to-br from-[#09150E] via-[#0F261B] to-[#173A2A] px-6 py-7 text-white sm:px-8 sm:py-8">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br from-[#D4AF37]/20 via-[#1F5942]/30 to-transparent blur-3xl" />
      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full opacity-40 mix-blend-screen"
        viewBox="0 0 1200 130"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M-20 95 Q 260 25 560 70 T 1220 45"
          stroke="#F2CE55"
          strokeWidth="2.2"
          fill="none"
        />
      </svg>
      <div className="relative z-10 flex max-w-3xl items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#D4AF37]/50 bg-[#17251D] text-[#F6C94C] shadow-sm">
          <Settings className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <div className="mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E5AE12]/20 border border-[#E5AE12]/45 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#F6C94C]">
              ✦ GESTÃO ADMINISTRATIVA DO TERREIRO ✦
            </span>
          </div>
          <h1 className="font-display text-2xl font-black tracking-tight text-white sm:text-3xl">Configurações da Casa</h1>
          <p className="mt-1.5 text-xs sm:text-sm font-medium leading-relaxed text-[#D2E2D7]">
            Gerencie a identidade do terreiro, brasão da casa, credenciais de acesso e automações do canal oficial do WhatsApp.
          </p>
        </div>
      </div>
    </div>
  );
}
