import {
  Camera,
  ChevronDown,
  Download,
  Flame,
  Loader2,
  Lock,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { cn } from '../../lib/utils';
import { uploadFilhoProfilePhoto } from '../../lib/filhoProfilePhoto';
import { hasPlanAccess } from '../../constants/plans';
import {
  buildZeladorNavEntries,
  buildZeladorNavItems,
  FILHO_NAV,
  navItemPlanFeature,
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
  onFilhoFotoUpdated?: (url: string) => void;
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
  layout?: 'inline' | 'grid' | 'dropdown' | 'drawer';
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      role={layout === 'dropdown' ? 'menuitem' : 'tab'}
      aria-selected={layout === 'dropdown' ? undefined : isActive}
      onClick={onSelect}
      className={cn(
        'inline-flex shrink-0 items-center font-bold transition-colors touch-manipulation',
        layout === 'drawer'
          ? 'w-full min-h-[48px] gap-3 rounded-xl px-4 py-3 text-left text-sm'
          : layout === 'grid'
            ? 'w-full min-h-[44px] gap-1.5 rounded-xl border px-3 py-3 text-xs'
            : layout === 'dropdown'
              ? 'w-full min-h-[44px] gap-1.5 rounded-lg px-3 py-3 text-left text-sm'
              : 'gap-1.5 rounded-lg px-3 py-2 text-xs',
        isActive
          ? layout === 'grid'
            ? 'border-primary/40 bg-primary text-[#080A0D] shadow-sm'
            : layout === 'drawer'
              ? 'bg-primary text-[#080A0D] shadow-sm'
              : layout === 'dropdown'
                ? 'bg-primary/15 text-primary'
                : 'bg-primary text-[#080A0D] shadow-sm'
          : layout === 'grid'
            ? 'border-[#1E242B] bg-[#12161A] text-[#94A3B8] hover:border-[#94A3B8]/30 hover:text-[#F1F5F9]'
            : layout === 'drawer'
              ? 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]'
              : layout === 'dropdown'
                ? 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]'
                : 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]',
        isLocked && 'opacity-50',
      )}
    >
      <Icon
        className={cn(
          'shrink-0',
          layout === 'drawer' ? 'h-5 w-5' : layout === 'grid' || layout === 'dropdown' ? 'h-4 w-4' : 'h-3.5 w-3.5',
        )}
        aria-hidden
        strokeWidth={isActive ? 2.25 : 1.75}
        fill={isActive && item.filledWhenActive ? 'currentColor' : 'none'}
      />
      <span
        className={
          layout === 'grid'
            ? 'line-clamp-2 text-left leading-tight'
            : layout === 'dropdown' || layout === 'drawer'
              ? 'min-w-0 flex-1 leading-snug'
              : 'whitespace-nowrap'
        }
      >
        {item.label}
      </span>
      {isLocked ? <Lock className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
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
  variant = 'grid',
}: {
  label: string;
  icon: LucideIcon;
  items: AppNavItem[];
  activeTab: string;
  isItemLocked: (item: AppNavItem) => boolean;
  onSelect: (item: AppNavItem) => void;
  variant?: 'grid' | 'drawer';
}) {
  const isGroupActive = items.some((i) => i.id === activeTab);
  const [expanded, setExpanded] = useState(isGroupActive);

  useEffect(() => {
    if (isGroupActive) setExpanded(true);
  }, [isGroupActive]);

  if (variant === 'drawer') {
    return (
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setExpanded((o) => !o)}
          aria-expanded={expanded}
          className={cn(
            'flex w-full min-h-[48px] items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition-colors touch-manipulation',
            isGroupActive || expanded
              ? 'bg-primary/15 text-primary'
              : 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]',
          )}
        >
          <GroupIcon className="h-5 w-5 shrink-0" aria-hidden />
          <span className="flex-1">{label}</span>
          <ChevronDown
            className={cn('h-5 w-5 shrink-0 transition-transform', expanded && 'rotate-180')}
            aria-hidden
          />
        </button>
        {expanded ? (
          <div className="flex flex-col gap-1.5 pl-2">
            {items.map((item) => (
              <NavTab
                key={item.id}
                item={item}
                layout="drawer"
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
  onFilhoFotoUpdated,
}: AppTopNavProps) {
  const isLgDesktop = useMediaQuery('(min-width: 1024px)');
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isInstalled: isStandalonePwa, install } = usePwaInstall();
  const filhoPhotoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFilhoPhoto, setIsUploadingFilhoPhoto] = useState(false);
  const [filhoPhotoMessage, setFilhoPhotoMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    if (isLgDesktop) setMobileOpen(false);
  }, [isLgDesktop]);

  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen || isLgDesktop) return;

    const scrollRoot = headerRef.current?.parentElement?.querySelector(':scope > .app-v3-scroll');
    const prevOverflow = scrollRoot instanceof HTMLElement ? scrollRoot.style.overflow : '';
    if (scrollRoot instanceof HTMLElement) scrollRoot.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      if (scrollRoot instanceof HTMLElement) scrollRoot.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen, isLgDesktop]);

  const handleInstallApp = async () => {
    const outcome = await install();
    if (outcome === 'ios') {
      alert(
        'No iPhone ou iPad: toque em Compartilhar (ícone na barra do Safari) e escolha «Adicionar à Tela de Início».',
      );
      return;
    }
    if (outcome === 'unavailable') {
      alert(
        'No Chrome ou Edge: menu do navegador (⋮) → «Instalar aplicativo» ou «Adicionar à tela inicial».',
      );
    }
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

  const terreiroNome = tenantData?.nome || 'AxéCloud';
  const subtitle =
    userRole === 'filho'
      ? userDisplayName || 'Filho de Santo'
      : `${tenantData?.plan?.toUpperCase() || 'AXÉ'} · gestão do terreiro`;
  const profileFoto = userRole === 'filho' ? filhoFotoUrl : tenantData?.foto_url;

  useEffect(() => {
    if (!filhoPhotoMessage) return;
    const t = window.setTimeout(() => setFilhoPhotoMessage(null), 4000);
    return () => window.clearTimeout(t);
  }, [filhoPhotoMessage]);

  const handleFilhoPhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || userRole !== 'filho') return;

    setIsUploadingFilhoPhoto(true);
    try {
      const result = await uploadFilhoProfilePhoto(file);
      if (!result.ok) {
        setFilhoPhotoMessage({ text: result.error, type: 'error' });
        return;
      }
      onFilhoFotoUpdated?.(result.publicUrl);
      setFilhoPhotoMessage({ text: 'Foto de perfil atualizada!', type: 'success' });
    } catch (err: unknown) {
      setFilhoPhotoMessage({
        text: err instanceof Error ? err.message : 'Erro ao enviar foto.',
        type: 'error',
      });
    } finally {
      setIsUploadingFilhoPhoto(false);
    }
  };

  const isFilhoProfile = userRole === 'filho';

  const profileAvatar = (
    <div
      className={cn(
        'grid place-items-center overflow-hidden rounded-full border bg-gradient-to-br from-primary to-amber-500 shadow-sm shadow-primary/10',
        isFilhoProfile
          ? 'h-12 w-12 border-2 border-primary/50 shadow-md shadow-primary/15'
          : 'h-9 w-9 border-primary/40',
      )}
    >
      {profileFoto ? (
        <img
          src={profileFoto}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <Flame className={cn('text-[#13171D]', isFilhoProfile ? 'h-5 w-5' : 'h-4 w-4')} aria-hidden />
      )}
    </div>
  );

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

  const renderMobileDrawerEntry = (entry: ZeladorNavEntry, key: string) => {
    if (entry.type === 'item') {
      return (
        <NavTab
          key={key}
          item={entry.item}
          layout="drawer"
          isActive={activeTab === entry.item.id}
          isLocked={isItemLocked(entry.item)}
          onSelect={() => handleSelect(entry.item)}
        />
      );
    }

    return (
      <NavGroupMobileSection
        key={key}
        variant="drawer"
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
    <>
      {mobileOpen && !isLgDesktop ? (
        <div
          className="fixed inset-0 z-[60] bg-black/65 lg:hidden"
          aria-hidden
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-[70] w-[min(88vw,19.75rem)] flex-col border-r border-[#1E242B] bg-[#0B0D11] lg:hidden',
          mobileOpen ? 'flex' : 'hidden',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de módulos do AxéCloud"
      >
        <div className="flex min-h-[56px] shrink-0 items-center justify-between gap-3 border-b border-[#1E242B] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-[#F1F5F9]">{terreiroNome}</p>
            <p className="truncate text-[11px] font-medium text-primary">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] touch-manipulation"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <nav
          className="flex flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-3 py-4 no-scrollbar"
          role="tablist"
          aria-label="Módulos do AxéCloud"
        >
          {userRole === 'filho'
            ? navItems.map((item) => (
                <NavTab
                  key={item.id}
                  item={item}
                  layout="drawer"
                  isActive={activeTab === item.id}
                  isLocked={isItemLocked(item)}
                  onSelect={() => handleSelect(item)}
                />
              ))
            : zeladorEntries?.map((entry, index) =>
                renderMobileDrawerEntry(entry, entry.type === 'item' ? entry.item.id : `drawer-${index}`),
              )}
        </nav>

        <div className="shrink-0 space-y-2 border-t border-[#1E242B] px-3 py-4">
          {showInstallButton ? (
            <button
              type="button"
              onClick={() => void handleInstallApp()}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-primary/35 bg-[#12161A] px-4 text-sm font-bold text-primary touch-manipulation"
            >
              <Download className="h-5 w-5 shrink-0" aria-hidden />
              Instalar aplicativo
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void performFastLogout()}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] px-4 text-sm font-bold text-[#94A3B8] touch-manipulation hover:border-[#2F3643] hover:text-[#F1F5F9]"
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden />
            Sair
          </button>
        </div>
      </aside>

      <header
        ref={headerRef}
        className="relative z-50 w-full max-w-full min-w-0 shrink-0 overflow-hidden border-b border-[#1E242B] bg-[#13171D]"
      >
        <div className="flex w-full min-w-0 flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:gap-2">
        <div className="flex min-w-0 shrink-0 items-center justify-between gap-3 lg:max-w-[min(100%,15rem)] xl:max-w-xs">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex shrink-0 flex-col items-center gap-0.5">
              {userRole === 'filho' ? (
                <button
                  type="button"
                  onClick={() => !isUploadingFilhoPhoto && filhoPhotoInputRef.current?.click()}
                  disabled={isUploadingFilhoPhoto}
                  className="group relative shrink-0 rounded-full disabled:opacity-70"
                  aria-label="Alterar foto de perfil"
                  title="Alterar foto de perfil"
                >
                  {profileAvatar}
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#13171D] bg-[#1A1F26] text-primary shadow-md ring-1 ring-primary/25 transition-transform group-hover:scale-105 group-active:scale-95">
                    {isUploadingFilhoPhoto ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                      <Camera className="h-3 w-3" aria-hidden />
                    )}
                  </span>
                  <input
                    ref={filhoPhotoInputRef}
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/*"
                    onChange={(e) => void handleFilhoPhotoUpload(e)}
                  />
                </button>
              ) : (
                profileAvatar
              )}
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate font-display text-sm font-bold leading-tight text-[#F1F5F9]">
                {terreiroNome}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-medium text-primary">{subtitle}</p>
              {userRole === 'filho' && filhoPhotoMessage ? (
                <p
                  className={cn(
                    'mt-0.5 truncate text-[10px] font-semibold',
                    filhoPhotoMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400',
                  )}
                  role="status"
                >
                  {filhoPhotoMessage.text}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] touch-manipulation"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Fechar menu de módulos' : 'Abrir menu de módulos'}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

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
    </>
  );
}

export function AppPageShell({
  children,
  fullWidth,
}: {
  children: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full flex-1 px-4 py-6 sm:px-6 md:py-8 lg:px-8',
        fullWidth ? 'max-w-none' : 'max-w-[1600px]',
      )}
    >
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
