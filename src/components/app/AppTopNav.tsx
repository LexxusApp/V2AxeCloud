import {
  ChevronDown,
  Download,
  Flame,
  Landmark,
  Loader2,
  Lock,
  LogOut,
  Menu,
  PieChart,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isInstalledRelatedWebApp, isStandalonePwa as detectStandalonePwa } from '../../lib/pwaInstall';
import { cn } from '../../lib/utils';
import { hasPlanAccess } from '../../constants/plans';
import {
  buildZeladorNavEntries,
  buildZeladorNavItems,
  FILHO_NAV,
  flattenZeladorNavEntries,
  navItemPlanFeature,
  ZELADOR_CASA_CHILD_IDS,
  ZELADOR_FINANCIAL_CHILD_IDS,
  type AppNavItem,
  type ZeladorNavEntry,
} from '../../constants/appNav';
import { performFastLogout } from '../../lib/logout';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

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

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

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
        'inline-flex shrink-0 items-center gap-1.5 font-bold transition-colors',
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

function NavGroupMobileSection({
  label,
  icon: GroupIcon,
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
          'flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-colors',
          isGroupActive || expanded
            ? 'border-primary/40 bg-primary/15 text-primary'
            : 'border-[#1E242B] bg-[#12161A] text-[#94A3B8] hover:border-[#94A3B8]/30 hover:text-[#F1F5F9]',
        )}
      >
        <GroupIcon className="h-4 w-4 shrink-0" aria-hidden />
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

function NavGroupDropdown({
  label,
  icon: GroupIcon,
  items,
  activeTab,
  isItemLocked,
  onSelect,
  menuLabel,
}: {
  label: string;
  icon: LucideIcon;
  items: AppNavItem[];
  activeTab: string;
  isItemLocked: (item: AppNavItem) => boolean;
  onSelect: (item: AppNavItem) => void;
  menuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isGroupActive = items.some((i) => i.id === activeTab);

  const syncMenuPosition = () => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 6,
      left: rect.left,
    });
  };

  useEffect(() => {
    if (!open) return;
    syncMenuPosition();
    const onScrollOrResize = () => syncMenuPosition();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        role="tab"
        aria-selected={isGroupActive}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors',
          isGroupActive || open
            ? 'bg-primary text-[#080A0D] shadow-sm'
            : 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]',
        )}
      >
        <GroupIcon className="h-3.5 w-3.5 shrink-0" aria-hidden strokeWidth={isGroupActive ? 2.25 : 1.75} />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={menuLabel}
          style={{ top: menuPos.top, left: menuPos.left }}
          className="fixed z-[80] min-w-[12.5rem] rounded-xl border border-[#1E242B] bg-[#13171D] p-1 shadow-lg"
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
  const isLgDesktop = useMediaQuery('(min-width: 1024px)');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalonePwa, setIsStandalonePwa] = useState(false);

  useEffect(() => {
    const syncStandalone = () => {
      setIsStandalonePwa(detectStandalonePwa());
    };

    syncStandalone();

    void isInstalledRelatedWebApp().then((installed) => {
      if (installed) setIsStandalonePwa(true);
    });

    const displayMq = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'] as const;
    const mqls = displayMq.map((mode) => window.matchMedia(`(display-mode: ${mode})`));
    const onDisplayChange = () => syncStandalone();
    mqls.forEach((mql) => mql.addEventListener('change', onDisplayChange));

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPwaInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => {
      mqls.forEach((mql) => mql.removeEventListener('change', onDisplayChange));
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  useEffect(() => {
    if (isLgDesktop) setMobileOpen(false);
  }, [isLgDesktop]);

  const handleInstallApp = async () => {
    if (pwaInstallPrompt) {
      await pwaInstallPrompt.prompt();
      await pwaInstallPrompt.userChoice;
      setPwaInstallPrompt(null);
      return;
    }

    const isIos =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as Window & { MSStream?: unknown }).MSStream;

    if (isIos) {
      alert(
        'No iPhone ou iPad: toque em Compartilhar (ícone na barra do Safari) e escolha «Adicionar à Tela de Início».',
      );
      return;
    }

    alert(
      'No Chrome ou Edge: menu do navegador (⋮) → «Instalar aplicativo» ou «Adicionar à tela inicial».',
    );
  };

  const showInstallButton = !isStandalonePwa;

  const navItems = useMemo(
    () => (userRole === 'filho' ? FILHO_NAV : buildZeladorNavItems(tenantData?.tradicao)),
    [userRole, tenantData?.tradicao],
  );

  const zeladorEntries = useMemo(
    () => (userRole === 'filho' ? null : buildZeladorNavEntries(tenantData?.tradicao)),
    [userRole, tenantData?.tradicao],
  );

  const zeladorFlatItems = useMemo(
    () => (zeladorEntries ? flattenZeladorNavEntries(zeladorEntries) : navItems),
    [zeladorEntries, navItems],
  );

  const activeItem = zeladorFlatItems.find((item) => item.id === activeTab) ?? navItems.find((item) => item.id === activeTab);
  const casaChildIds = useMemo(() => new Set<string>(ZELADOR_CASA_CHILD_IDS), []);
  const financialChildIds = useMemo(() => new Set<string>(ZELADOR_FINANCIAL_CHILD_IDS), []);
  const activeCasaItem =
    userRole === 'admin' && casaChildIds.has(activeTab)
      ? zeladorFlatItems.find((item) => item.id === activeTab)
      : null;
  const activeFinancialItem =
    userRole === 'admin' && financialChildIds.has(activeTab)
      ? zeladorFlatItems.find((item) => item.id === activeTab)
      : null;

  const isItemLocked = (item: AppNavItem) =>
    userRole === 'admin' && !hasPlanAccess(tenantData?.plan, navItemPlanFeature(item.id), isAdmin);

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

  const headerActions = (compact?: boolean) => (
    <>
      {showInstallButton ? (
        <button
          type="button"
          onClick={() => void handleInstallApp()}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/35 bg-[#12161A] px-2.5 py-2 text-xs font-bold text-primary transition-all hover:border-primary/50 hover:bg-primary/10 sm:px-3"
          title="Instalar aplicativo"
        >
          <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className={compact ? 'sr-only sm:not-sr-only sm:inline' : 'hidden 2xl:inline'}>
            Instalar aplicativo
          </span>
          <span className={compact ? 'inline sm:hidden' : 'inline 2xl:hidden'}>Instalar</span>
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => void performFastLogout()}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#1E242B] bg-[#12161A] px-2.5 py-2 text-xs font-bold text-[#94A3B8] transition-all hover:border-[#2F3643] hover:text-[#F1F5F9] sm:px-3"
        title="Sair"
      >
        <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className={compact ? 'sr-only sm:not-sr-only sm:inline' : undefined}>Sair</span>
      </button>
    </>
  );

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
      <NavGroupMobileSection
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
      <NavGroupDropdown
        key={key}
        label={entry.label}
        icon={entry.icon}
        items={entry.items}
        activeTab={activeTab}
        isItemLocked={isItemLocked}
        onSelect={handleSelect}
        menuLabel={entry.type === 'casa' ? 'Módulos da casa' : 'Módulos financeiros'}
      />
    );
  };

  return (
    <header className="relative z-30 w-full max-w-full min-w-0 shrink-0 overflow-visible border-b border-[#1E242B] bg-[#13171D]">
      <div className="flex w-full min-w-0 flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:gap-2">
        <div className="flex min-w-0 shrink-0 items-center justify-between gap-3 lg:max-w-[min(100%,15rem)] xl:max-w-xs">
          <div className="flex min-w-0 items-center gap-3">
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
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate font-display text-sm font-bold leading-tight text-[#F1F5F9]">
                {terreiroNome}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-medium text-primary">{subtitle}</p>
              {!mobileOpen && (activeCasaItem || activeFinancialItem || activeItem) ? (
                <p className="mt-1.5 flex items-center gap-1 lg:hidden">
                  <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {activeCasaItem ? (
                      <>
                        <Landmark className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">
                          Casa · {activeCasaItem.label}
                        </span>
                      </>
                    ) : activeFinancialItem ? (
                      <>
                        <PieChart className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">
                          Financeiro · {activeFinancialItem.label}
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
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:hidden">
            {headerActions(true)}
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

        {isLgDesktop ? (
          <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div
              className="flex w-max items-center gap-1 rounded-xl border border-[#1E242B] bg-[#12161A] p-1.5"
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
        ) : null}

        <div className="hidden shrink-0 items-center gap-2 pl-1 lg:flex">{headerActions()}</div>
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
