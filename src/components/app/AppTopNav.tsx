import {
  Flame,
  Loader2,
  Lock,
  Menu,
  X,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { hasPlanAccess } from '../../constants/plans';
import { buildZeladorNavItems, FILHO_NAV, type AppNavItem } from '../../constants/appNav';
import { PwaInstallTopbarButton } from '../PwaInstallTopbarButton';
import { performFastLogout } from '../../lib/logout';

type AppTopNavProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: 'admin' | 'filho';
  isAdmin?: boolean;
  tenantData?: {
    nome: string;
    plan: string;
    tenant_id?: string | null;
    foto_url?: string | null;
    tradicao?: string | null;
  } | null;
  userDisplayName?: string;
  filhoFotoUrl?: string | null;
};

function NavTab({
  item,
  isActive,
  isLocked,
  onSelect,
  layout = 'inline',
}: {
  item: AppNavItem;
  isActive: boolean;
  isLocked: boolean;
  onSelect: () => void;
  layout?: 'inline' | 'grid';
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onSelect}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 font-bold transition-all',
        layout === 'grid'
          ? 'w-full rounded-xl border px-3 py-2.5 text-[11px]'
          : 'rounded-lg px-3 py-2 text-xs',
        isActive
          ? layout === 'grid'
            ? 'border-primary/40 bg-primary text-[#080A0D] shadow-sm'
            : 'bg-primary text-[#080A0D] shadow-sm'
          : layout === 'grid'
            ? 'border-[#1E242B] bg-[#12161A] text-[#94A3B8] hover:border-[#94A3B8]/30 hover:text-[#F1F5F9]'
            : 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]',
        isLocked && 'opacity-50',
      )}
    >
      <Icon
        className={cn('shrink-0', layout === 'grid' ? 'h-4 w-4' : 'h-3.5 w-3.5')}
        aria-hidden
        strokeWidth={isActive ? 2.25 : 1.75}
        fill={isActive && item.filledWhenActive ? 'currentColor' : 'none'}
      />
      <span className={layout === 'grid' ? 'line-clamp-2 text-left leading-tight' : 'whitespace-nowrap'}>
        {item.label}
      </span>
      {isLocked ? <Lock className="h-3 w-3 shrink-0 text-primary" aria-hidden /> : null}
    </button>
  );
}

export default function AppTopNav({
  activeTab,
  setActiveTab,
  userRole,
  isAdmin,
  tenantData,
  userDisplayName,
  filhoFotoUrl,
}: AppTopNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = useMemo(
    () => (userRole === 'filho' ? FILHO_NAV : buildZeladorNavItems(tenantData?.tradicao)),
    [userRole, tenantData?.tradicao],
  );

  const activeItem = navItems.find((item) => item.id === activeTab);

  const handleSelect = (item: AppNavItem) => {
    const locked = userRole === 'admin' && !hasPlanAccess(tenantData?.plan, item.id, isAdmin);
    if (locked) {
      alert(
        `Este recurso não está disponível no plano ${tenantData?.plan?.toUpperCase() || 'AXÉ'}. Atualize seu plano para acessar.`,
      );
      return;
    }
    setActiveTab(item.id);
    setMobileOpen(false);
  };

  const terreiroNome = tenantData?.nome || 'AXÉCLOUD';
  const subtitle =
    userRole === 'filho'
      ? userDisplayName || 'Filho de Santo'
      : `${tenantData?.plan?.toUpperCase() || 'AXÉ'} · gestão do terreiro`;
  const profileFoto =
    userRole === 'filho' ? filhoFotoUrl : tenantData?.foto_url;

  return (
    <header className="shrink-0 border-b border-[#1E242B] bg-[#13171D]">
      <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex min-w-0 items-center justify-between gap-3 lg:justify-start">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex shrink-0 flex-col items-center gap-0.5">
              <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-primary/40 bg-gradient-to-br from-primary to-amber-500 shadow-sm shadow-primary/10">
                {profileFoto ? (
                  <img
                    src={profileFoto}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Flame className="h-4 w-4 text-[#13171D]" aria-hidden />
                )}
              </div>
              <button
                type="button"
                onClick={() => void performFastLogout()}
                className="text-[9px] font-medium tracking-wide text-[#4B5563] transition-colors hover:text-[#94A3B8]"
              >
                sair
              </button>
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate font-display text-sm font-bold leading-tight text-[#F1F5F9]">
                {terreiroNome}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-medium text-primary">{subtitle}</p>
              {!mobileOpen && activeItem ? (
                <p className="mt-1.5 flex items-center gap-1 lg:hidden">
                  <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    <activeItem.icon className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate">{activeItem.label}</span>
                  </span>
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 lg:hidden">
            <PwaInstallTopbarButton />
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="rounded-lg p-2 text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Fechar menu de módulos' : 'Abrir menu de módulos'}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:hidden"
            role="tablist"
            aria-label="Módulos do AxéCloud"
          >
            {navItems.map((item) => (
              <NavTab
                key={item.id}
                item={item}
                layout="grid"
                isActive={activeTab === item.id}
                isLocked={
                  userRole === 'admin' && !hasPlanAccess(tenantData?.plan, item.id, isAdmin)
                }
                onSelect={() => handleSelect(item)}
              />
            ))}
          </div>
        ) : null}

        <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
          <div
            className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto rounded-xl border border-[#1E242B] bg-[#12161A] p-1.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#334155]"
            role="tablist"
            aria-label="Módulos do AxéCloud"
          >
            {navItems.map((item) => (
              <NavTab
                key={item.id}
                item={item}
                isActive={activeTab === item.id}
                isLocked={
                  userRole === 'admin' && !hasPlanAccess(tenantData?.plan, item.id, isAdmin)
                }
                onSelect={() => handleSelect(item)}
              />
            ))}
          </div>
          <div className="hidden shrink-0 items-center sm:flex">
            <PwaInstallTopbarButton />
          </div>
        </div>
      </div>
    </header>
  );
}

export function AppPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 md:py-8 lg:px-8">
      {children}
    </div>
  );
}

export function AppPanelLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
