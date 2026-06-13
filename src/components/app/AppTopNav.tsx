import {
  ChevronDown,
  Flame,
  Landmark,
  Loader2,
  Lock,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { hasPlanAccess } from '../../constants/plans';
import {
  buildZeladorNavEntries,
  buildZeladorNavItems,
  FILHO_NAV,
  ZELADOR_CASA_CHILD_IDS,
  type AppNavItem,
  type ZeladorNavEntry,
} from '../../constants/appNav';
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
  layout?: 'inline' | 'grid' | 'dropdown';
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      role={layout === 'dropdown' ? 'menuitem' : 'tab'}
      aria-selected={layout === 'dropdown' ? undefined : isActive}
      onClick={onSelect}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 font-bold transition-all',
        layout === 'grid'
          ? 'w-full rounded-xl border px-3 py-2.5 text-[11px]'
          : layout === 'dropdown'
            ? 'w-full rounded-lg px-3 py-2.5 text-left text-xs'
            : 'rounded-lg px-3 py-2 text-xs',
        isActive
          ? layout === 'grid'
            ? 'border-primary/40 bg-primary text-[#080A0D] shadow-sm'
            : layout === 'dropdown'
              ? 'bg-primary/15 text-primary'
              : 'bg-primary text-[#080A0D] shadow-sm'
          : layout === 'grid'
            ? 'border-[#1E242B] bg-[#12161A] text-[#94A3B8] hover:border-[#94A3B8]/30 hover:text-[#F1F5F9]'
            : layout === 'dropdown'
              ? 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]'
              : 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]',
        isLocked && 'opacity-50',
      )}
    >
      <Icon
        className={cn('shrink-0', layout === 'grid' || layout === 'dropdown' ? 'h-4 w-4' : 'h-3.5 w-3.5')}
        aria-hidden
        strokeWidth={isActive ? 2.25 : 1.75}
        fill={isActive && item.filledWhenActive ? 'currentColor' : 'none'}
      />
      <span
        className={
          layout === 'grid'
            ? 'line-clamp-2 text-left leading-tight'
            : layout === 'dropdown'
              ? 'flex-1'
              : 'whitespace-nowrap'
        }
      >
        {item.label}
      </span>
      {isLocked ? <Lock className="h-3 w-3 shrink-0 text-primary" aria-hidden /> : null}
    </button>
  );
}

function NavCasaMobileSection({
  label,
  icon: CasaIcon,
  items,
  activeTab,
  isItemLocked,
  onSelect,
}: {
  label: string;
  icon: LucideIcon;
  items: AppNavItem[];
  activeTab: string;
  isItemLocked: (item: AppNavItem) => boolean;
  onSelect: (item: AppNavItem) => void;
}) {
  const isGroupActive = items.some((i) => i.id === activeTab);
  const [expanded, setExpanded] = useState(isGroupActive);

  useEffect(() => {
    if (isGroupActive) setExpanded(true);
  }, [isGroupActive]);

  return (
    <div className="col-span-2 space-y-2 sm:col-span-3">
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        aria-expanded={expanded}
        className={cn(
          'flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-all',
          isGroupActive || expanded
            ? 'border-primary/40 bg-primary/15 text-primary'
            : 'border-[#1E242B] bg-[#12161A] text-[#94A3B8] hover:border-[#94A3B8]/30 hover:text-[#F1F5F9]',
        )}
      >
        <CasaIcon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1">{label}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform', expanded && 'rotate-180')}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <NavTab
              key={item.id}
              item={item}
              layout="grid"
              isActive={activeTab === item.id}
              isLocked={isItemLocked(item)}
              onSelect={() => onSelect(item)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NavCasaDropdown({
  label,
  icon: CasaIcon,
  items,
  activeTab,
  isItemLocked,
  onSelect,
}: {
  label: string;
  icon: LucideIcon;
  items: AppNavItem[];
  activeTab: string;
  isItemLocked: (item: AppNavItem) => boolean;
  onSelect: (item: AppNavItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isGroupActive = items.some((i) => i.id === activeTab);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        role="tab"
        aria-selected={isGroupActive}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all',
          isGroupActive || open
            ? 'bg-primary text-[#080A0D] shadow-sm'
            : 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]',
        )}
      >
        <CasaIcon className="h-3.5 w-3.5 shrink-0" aria-hidden strokeWidth={isGroupActive ? 2.25 : 1.75} />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Módulos da casa"
          className="absolute left-0 top-full z-[60] mt-1.5 min-w-[12.5rem] overflow-hidden rounded-xl border border-[#1E242B] bg-[#13171D] p-1 shadow-xl shadow-black/40"
        >
          {items.map((item) => (
            <NavTab
              key={item.id}
              item={item}
              layout="dropdown"
              isActive={activeTab === item.id}
              isLocked={isItemLocked(item)}
              onSelect={() => {
                onSelect(item);
                setOpen(false);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
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

  const zeladorEntries = useMemo(
    () => (userRole === 'filho' ? null : buildZeladorNavEntries(tenantData?.tradicao)),
    [userRole, tenantData?.tradicao],
  );

  const activeItem = navItems.find((item) => item.id === activeTab);
  const casaChildIds = useMemo(() => new Set<string>(ZELADOR_CASA_CHILD_IDS), []);
  const activeCasaItem =
    userRole === 'admin' && casaChildIds.has(activeTab)
      ? navItems.find((item) => item.id === activeTab)
      : null;

  const isItemLocked = (item: AppNavItem) =>
    userRole === 'admin' && !hasPlanAccess(tenantData?.plan, item.id, isAdmin);

  const handleSelect = (item: AppNavItem) => {
    if (isItemLocked(item)) {
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
  const profileFoto = userRole === 'filho' ? filhoFotoUrl : tenantData?.foto_url;

  const renderMobileEntry = (entry: ZeladorNavEntry, key: string) => {
    if (entry.type === 'item') {
      return (
        <NavTab
          key={key}
          item={entry.item}
          layout="grid"
          isActive={activeTab === entry.item.id}
          isLocked={isItemLocked(entry.item)}
          onSelect={() => handleSelect(entry.item)}
        />
      );
    }

    return (
      <NavCasaMobileSection
        key={key}
        label={entry.label}
        icon={entry.icon}
        items={entry.items}
        activeTab={activeTab}
        isItemLocked={isItemLocked}
        onSelect={handleSelect}
      />
    );
  };

  const renderDesktopEntry = (entry: ZeladorNavEntry, key: string) => {
    if (entry.type === 'item') {
      return (
        <NavTab
          key={key}
          item={entry.item}
          isActive={activeTab === entry.item.id}
          isLocked={isItemLocked(entry.item)}
          onSelect={() => handleSelect(entry.item)}
        />
      );
    }

    return (
      <NavCasaDropdown
        key={key}
        label={entry.label}
        icon={entry.icon}
        items={entry.items}
        activeTab={activeTab}
        isItemLocked={isItemLocked}
        onSelect={handleSelect}
      />
    );
  };

  return (
    <header className="relative z-30 shrink-0 overflow-visible border-b border-[#1E242B] bg-[#13171D]">
      <div className="flex flex-col gap-3 overflow-visible px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
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
              {!mobileOpen && (activeCasaItem || activeItem) ? (
                <p className="mt-1.5 flex items-center gap-1 lg:hidden">
                  <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {activeCasaItem ? (
                      <>
                        <Landmark className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">
                          Casa · {activeCasaItem.label}
                        </span>
                      </>
                    ) : activeItem ? (
                      <>
                        <activeItem.icon className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">{activeItem.label}</span>
                      </>
                    ) : null}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 lg:hidden">
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
            {userRole === 'filho'
              ? navItems.map((item) => (
                  <NavTab
                    key={item.id}
                    item={item}
                    layout="grid"
                    isActive={activeTab === item.id}
                    isLocked={isItemLocked(item)}
                    onSelect={() => handleSelect(item)}
                  />
                ))
              : zeladorEntries?.map((entry, index) =>
                  renderMobileEntry(entry, entry.type === 'item' ? entry.item.id : `casa-${index}`),
                )}
          </div>
        ) : null}

        <div className="hidden min-w-0 flex-1 items-center overflow-visible lg:flex">
          <div
            className="flex min-w-0 flex-1 flex-wrap items-center gap-1 overflow-visible rounded-xl border border-[#1E242B] bg-[#12161A] p-1.5"
            role="tablist"
            aria-label="Módulos do AxéCloud"
          >
            {userRole === 'filho'
              ? navItems.map((item) => (
                  <NavTab
                    key={item.id}
                    item={item}
                    isActive={activeTab === item.id}
                    isLocked={isItemLocked(item)}
                    onSelect={() => handleSelect(item)}
                  />
                ))
              : zeladorEntries?.map((entry, index) =>
                  renderDesktopEntry(entry, entry.type === 'item' ? entry.item.id : `casa-${index}`),
                )}
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
