import {
  Camera,
  ChevronDown,
  CircleHelp,
  Download,
  Loader2,
  Lock,
  LogOut,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { useObrigacoesUnread } from '../../hooks/useObrigacoesUnread';
import { cn } from '../../lib/utils';
import { uploadFilhoProfilePhoto } from '../../lib/filhoProfilePhoto';
import { hasPlanAccess, isLifetimePlan } from '../../constants/plans';
import { getSubscriptionDueState } from '../../lib/subscriptionDue';
import {
  buildZeladorNavEntries,
  buildZeladorNavItems,
  FILHO_NAV,
  navItemPlanFeature,
  type AppNavItem,
  type ZeladorNavEntry,
} from '../../constants/appNav';
import { openFilhoTour } from '../../constants/filhoGuide';
import { performFastLogout } from '../../lib/logout';
import Avatar from '../Avatar';
import { AxeCloudEmblem } from '../AxeCloudLogoMark';
import NotificationPanel from '../NotificationPanel';

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
    expires_at?: string | null;
    status?: string | null;
    is_trial?: boolean;
  } | null;
  userDisplayName?: string;
  userId?: string | null;
  userEmail?: string | null;
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

function formatSidebarDueDate(value?: string | null) {
  if (!value) return null;
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12)
    : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date);
  const year = new Intl.DateTimeFormat('pt-BR', { year: 'numeric' }).format(date);
  return `${day} ${month} ${year}`;
}

function NavTab({
  item,
  isActive,
  isLocked,
  onSelect,
  layout = 'inline',
  badgeCount = 0,
}: {
  item: AppNavItem;
  isActive: boolean;
  isLocked: boolean;
  onSelect: () => void;
  layout?: 'inline' | 'grid' | 'dropdown' | 'drawer' | 'drawer-sub';
  badgeCount?: number;
}) {
  const Icon = item.icon;
  const isDrawerLayout = layout === 'drawer' || layout === 'drawer-sub';
  const showBadge = badgeCount > 0;
  const badgeLabel = badgeCount > 9 ? '9+' : String(badgeCount);
  return (
    <button
      type="button"
      role={layout === 'dropdown' ? 'menuitem' : 'tab'}
      aria-selected={layout === 'dropdown' ? undefined : isActive}
      aria-label={showBadge ? `${item.label}, ${badgeCount} nova${badgeCount === 1 ? '' : 's'}` : undefined}
      onClick={onSelect}
      className={cn(
        'relative inline-flex shrink-0 items-center transition-colors touch-manipulation',
        layout === 'drawer-sub' ? 'font-semibold' : 'font-bold',
        layout === 'drawer'
          ? 'w-full min-h-[36px] gap-2.5 rounded-lg px-3 py-1.5 text-left text-[13px]'
          : layout === 'drawer-sub'
            ? 'w-full min-h-[34px] gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px]'
            : layout === 'grid'
              ? 'w-full min-h-[44px] gap-1.5 rounded-xl border px-3 py-3 text-xs'
              : layout === 'dropdown'
                ? 'w-full min-h-[44px] gap-1.5 rounded-lg px-3 py-3 text-left text-sm'
                : 'gap-1.5 rounded-lg px-3 py-2 text-xs',
        isActive
          ? layout === 'grid'
            ? 'border-primary/40 bg-primary text-[#080A0D] shadow-sm'
            : isDrawerLayout
              ? 'bg-primary text-[#080A0D] shadow-sm'
              : layout === 'dropdown'
                ? 'bg-primary/15 text-primary'
                : 'bg-primary text-[#080A0D] shadow-sm'
          : layout === 'grid'
            ? 'border-[#1E242B] bg-[#12161A] text-[#94A3B8] hover:border-[#94A3B8]/30 hover:text-[#F1F5F9]'
            : layout === 'drawer-sub'
              ? 'text-[#7B8798] hover:bg-white/[0.04] hover:text-[#F1F5F9]'
              : layout === 'drawer'
                ? 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]'
                : layout === 'dropdown'
                  ? 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]'
                  : 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]',
        isLocked && 'opacity-50',
      )}
    >
      <span className="relative shrink-0">
        <Icon
          className={cn(
            'shrink-0',
            layout === 'drawer'
              ? 'h-4 w-4'
              : layout === 'drawer-sub'
                ? 'h-3.5 w-3.5'
                : layout === 'grid' || layout === 'dropdown'
                  ? 'h-4 w-4'
                  : 'h-3.5 w-3.5',
          )}
          aria-hidden
          strokeWidth={isActive ? 2.25 : 1.75}
          fill={isActive && item.filledWhenActive ? 'currentColor' : 'none'}
        />
        {showBadge && !isDrawerLayout && layout !== 'dropdown' ? (
          <span
            className={cn(
              'absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] font-black leading-none',
              isActive ? 'bg-[#080A0D] text-primary' : 'bg-primary text-[#080A0D]',
            )}
            aria-hidden
          >
            {badgeLabel}
          </span>
        ) : null}
      </span>
      <span
        className={
          layout === 'grid'
            ? 'line-clamp-2 text-left leading-tight'
            : isDrawerLayout || layout === 'dropdown'
              ? 'min-w-0 flex-1 leading-snug'
              : 'whitespace-nowrap'
        }
      >
        {item.label}
      </span>
      {showBadge && (isDrawerLayout || layout === 'dropdown') ? (
        <span
          className={cn(
            'ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black',
            isActive ? 'bg-[#080A0D] text-primary' : 'bg-primary text-[#080A0D]',
          )}
          aria-hidden
        >
          {badgeLabel}
        </span>
      ) : null}
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
  menuLabel,
  variant = 'grid',
  defaultExpanded = false,
}: {
  label: string;
  icon: LucideIcon;
  items: AppNavItem[];
  activeTab: string;
  isItemLocked: (item: AppNavItem) => boolean;
  onSelect: (item: AppNavItem) => void;
  menuLabel?: string;
  variant?: 'grid' | 'drawer';
  defaultExpanded?: boolean;
}) {
  const isGroupActive = items.some((i) => i.id === activeTab);
  const [expanded, setExpanded] = useState(defaultExpanded || isGroupActive);

  useEffect(() => {
    if (isGroupActive) setExpanded(true);
  }, [isGroupActive]);

  if (variant === 'drawer') {
    return (
      <div className={cn(expanded && 'rounded-xl bg-white/[0.02]')}>
        <button
          type="button"
          onClick={() => setExpanded((o) => !o)}
          aria-expanded={expanded}
          className={cn(
            'flex w-full min-h-[36px] items-center gap-2.5 px-3 py-1.5 text-left text-[13px] font-bold transition-colors touch-manipulation',
            expanded ? 'rounded-t-lg' : 'rounded-lg',
            isGroupActive || expanded
              ? 'bg-primary/15 text-primary'
              : 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]',
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
          <div
            role="group"
            aria-label={menuLabel ?? label}
            className="ml-2 mt-0.5 space-y-0.5 rounded-b-lg border border-[#1E242B] border-l-2 border-l-primary/30 bg-[#12161A]/70 py-1 pl-1.5 pr-1"
          >
            {items.map((item) => (
              <NavTab
                key={item.id}
                item={item}
                layout="drawer-sub"
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

export default function AppTopNav({
  activeTab,
  setActiveTab,
  userRole,
  isAdmin,
  tenantData,
  userDisplayName,
  userId,
  userEmail,
  filhoFotoUrl,
  onFilhoFotoUpdated,
}: AppTopNavProps) {
  const isLgDesktop = useMediaQuery('(min-width: 880px)');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopPinned, setDesktopPinned] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('axecloud:sidebar-pinned') === '1' : false,
  );
  const [desktopHovered, setDesktopHovered] = useState(false);
  const desktopExpanded = desktopPinned || desktopHovered;
  const desktopCompact = !desktopExpanded;
  const { isInstalled: isStandalonePwa, install } = usePwaInstall();
  const filhoPhotoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFilhoPhoto, setIsUploadingFilhoPhoto] = useState(false);
  const [filhoPhotoMessage, setFilhoPhotoMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);
  const { unreadCount: obrigacoesUnread } = useObrigacoesUnread(
    userRole === 'filho',
    userId,
    tenantData?.tenant_id,
    userEmail,
  );

  const subscriptionDue = getSubscriptionDueState({
      expiresAt: tenantData?.expires_at,
      plan: tenantData?.plan,
      status: tenantData?.status,
      isTrial: tenantData?.is_trial,
    });
  const subscriptionNeedsAttention =
    userRole !== 'filho' &&
    !isLifetimePlan(String(tenantData?.plan || '')) &&
    subscriptionDue.needsAttention;

  const badgeForItem = (itemId: string) => {
    if (userRole === 'filho' && itemId === 'obrigacoes') return obrigacoesUnread;
    if (userRole !== 'filho' && itemId === 'subscription' && subscriptionNeedsAttention) return 1;
    return 0;
  };

  useEffect(() => {
    if (isLgDesktop) setMobileOpen(false);
  }, [isLgDesktop]);

  useEffect(() => {
    localStorage.setItem('axecloud:sidebar-pinned', desktopPinned ? '1' : '0');
    document.documentElement.style.setProperty(
      '--app-sidebar-width',
      desktopExpanded ? '15rem' : '4.75rem',
    );
    return () => {
      document.documentElement.style.removeProperty('--app-sidebar-width');
    };
  }, [desktopExpanded, desktopPinned]);

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
  const mobileDockItems = useMemo(() => {
    const ids =
      userRole === 'filho'
        ? ['profile', 'calendar', 'financial', 'chat']
        : ['dashboard', 'children', 'calendar', 'financial'];
    return ids
      .map((id) => navItems.find((item) => item.id === id))
      .filter((item): item is AppNavItem => item != null);
  }, [navItems, userRole]);

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

  const terreiroNome = tenantData?.nome?.trim() || 'Meu Terreiro';
  const dueDateLabel = formatSidebarDueDate(tenantData?.expires_at);
  const subtitle =
    userRole === 'filho'
      ? userDisplayName || 'Filho de Santo'
      : isLifetimePlan(String(tenantData?.plan || ''))
        ? 'Acesso vitalício'
        : subscriptionDue.isOverdue
          ? dueDateLabel
            ? `Vencida em ${dueDateLabel}`
            : 'Mensalidade vencida'
          : subscriptionDue.daysRemaining === 0
            ? 'Vence hoje'
            : subscriptionDue.daysRemaining != null && subscriptionDue.daysRemaining <= 7
              ? `Vence em ${subscriptionDue.daysRemaining} dia${subscriptionDue.daysRemaining === 1 ? '' : 's'}`
              : dueDateLabel
                ? `Vence em ${dueDateLabel}`
                : 'Vencimento não informado';
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
      if (result.ok === false) {
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
        'overflow-hidden rounded-full border bg-gradient-to-br from-primary to-amber-500 shadow-sm shadow-primary/10',
        isFilhoProfile
          ? 'h-12 w-12 border-2 border-primary/50 shadow-md shadow-primary/15'
          : 'h-9 w-9 border-primary/40',
      )}
    >
      <Avatar
        src={profileFoto}
        name={isFilhoProfile ? userDisplayName || 'Filho de Santo' : terreiroNome}
        alt=""
        className="h-full w-full"
        textSize={isFilhoProfile ? 'text-sm' : 'text-xs'}
      />
    </div>
  );

  const renderMobileDrawerEntry = (entry: ZeladorNavEntry, key: string, defaultExpanded = false) => {
    if (entry.type === 'item') {
      return (
        <NavTab
          key={key}
          item={entry.item}
          layout="drawer"
          isActive={activeTab === entry.item.id}
          isLocked={isItemLocked(entry.item)}
          badgeCount={badgeForItem(entry.item.id)}
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
        menuLabel={entry.type === 'casa' ? 'Módulos da casa' : entry.type === 'financial' ? 'Módulos financeiros' : 'Módulos de gestão avançada'}
        defaultExpanded={defaultExpanded}
      />
    );
  };

  return (
    <>
      {isLgDesktop ? (
        <NotificationPanel
          tenantData={tenantData}
          userRole={userRole}
          userId={userId}
          onNavigate={setActiveTab}
          placement="fixed"
        />
      ) : null}

      <aside
        onMouseEnter={() => setDesktopHovered(true)}
        onMouseLeave={() => setDesktopHovered(false)}
        onFocusCapture={() => setDesktopHovered(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDesktopHovered(false);
          }
        }}
        data-expanded={desktopExpanded ? 'true' : 'false'}
        className={cn(
          'app-v5-sidebar fixed inset-y-0 left-0 z-[55] hidden flex-col border-r border-[#242A32] bg-[#0B0D11] transition-[width,box-shadow] duration-300 ease-out min-[880px]:flex',
          desktopCompact ? 'w-[4.75rem]' : 'w-60',
        )}
      >
        <button
          type="button"
          onClick={() => setDesktopPinned((value) => !value)}
          title={desktopPinned ? 'Usar expansão automática' : 'Fixar menu aberto'}
          aria-label={desktopPinned ? 'Desafixar menu lateral' : 'Fixar menu lateral aberto'}
          aria-pressed={desktopPinned}
          className="app-v5-sidebar-toggle absolute -right-3 top-5 z-10 grid h-8 w-8 place-items-center rounded-full border border-[#343C47] bg-[#151A21] text-[#CBD5E1] shadow-lg transition hover:border-primary/50 hover:bg-primary hover:text-[#17130D]"
        >
          {desktopPinned ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>

        <div className={cn('app-v5-brand border-b border-[#242A32] py-2', desktopCompact ? 'px-2' : 'px-2.5')}>
          {desktopCompact ? (
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="group flex w-full items-center justify-center rounded-xl p-0.5 text-left transition-colors hover:bg-white/[0.04]"
              aria-label="Ir para o início"
            >
              <AxeCloudEmblem className="h-8 w-8" />
            </button>
          ) : (
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setActiveTab(userRole === 'filho' ? 'profile' : 'settings')}
                className="app-v5-sidebar-copy flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05]"
                aria-label={userRole === 'filho' ? 'Abrir meu perfil' : 'Abrir configurações da casa'}
              >
                <div
                  className={cn(
                    'overflow-hidden rounded-full border bg-gradient-to-br from-primary to-amber-500 shadow-sm shadow-primary/10',
                    isFilhoProfile
                      ? 'h-7 w-7 border border-primary/50'
                      : 'h-6 w-6 border-primary/40',
                  )}
                >
                  <Avatar
                    src={profileFoto}
                    name={isFilhoProfile ? userDisplayName || 'Filho de Santo' : terreiroNome}
                    alt=""
                    className="h-full w-full"
                    textSize="text-[9px]"
                  />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[11px] font-extrabold leading-tight text-[#F8FAFC]">
                    {terreiroNome}
                  </span>
                  <span className="mt-0.5 block truncate text-[8px] font-bold uppercase tracking-[0.08em] text-primary">
                    {subtitle}
                  </span>
                </span>
              </button>
            </div>
          )}
        </div>

        <div className={cn('pb-1 pt-2', desktopCompact ? 'px-1.5 text-center' : 'px-3')}>
          <p className={cn('font-black uppercase tracking-[0.16em] text-[#738095]', desktopCompact ? 'text-[8px]' : 'px-1.5 text-[9px]')}>
            {desktopCompact ? 'Axé' : 'Gestão da casa'}
          </p>
        </div>

        <nav
          className={cn(
            'app-v5-primary-nav flex flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain pb-2 no-scrollbar',
            desktopCompact ? 'items-center px-1.5' : 'px-2.5',
          )}
          role="tablist"
          aria-label="Módulos do AxéCloud"
        >
          {desktopCompact
            ? navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      'relative grid h-10 w-10 shrink-0 place-items-center rounded-lg border transition-colors',
                      active
                        ? 'border-primary bg-primary text-[#080A0D]'
                        : 'border-transparent text-[#9AA6B7] hover:border-white/10 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {badgeForItem(item.id) > 0 ? (
                      <span className="absolute right-1 top-1 h-2 w-2 rounded-full border border-[#0B0D11] bg-amber-400" aria-label="Requer atenção" />
                    ) : null}
                  </button>
                );
              })
            : userRole === 'filho'
            ? navItems.map((item) => (
                <NavTab
                  key={item.id}
                  item={item}
                  layout="drawer"
                  isActive={activeTab === item.id}
                  isLocked={isItemLocked(item)}
                  badgeCount={badgeForItem(item.id)}
                  onSelect={() => handleSelect(item)}
                />
              ))
            : zeladorEntries?.map((entry, index) =>
                renderMobileDrawerEntry(
                  entry,
                  entry.type === 'item' ? entry.item.id : `desktop-${index}`,
                ),
              )}
        </nav>

        <div className={cn('app-v5-sidebar-footer border-t border-[#242A32]', desktopCompact ? 'space-y-1.5 p-2' : 'space-y-1.5 p-2.5')}>
          {userRole === 'filho' ? (
            <div className={cn(!desktopCompact && 'rounded-lg border border-white/[0.06] bg-white/[0.025] p-1.5')}>
              <button
                type="button"
                onClick={() => openFilhoTour()}
                title="Como usar o app"
                className={cn(
                  'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#242A32] bg-[#12161A] text-[11px] font-black text-[#E8EDF5] transition-colors hover:border-primary/35 hover:text-primary',
                  desktopCompact ? 'w-10 px-0' : 'w-full px-2.5',
                )}
              >
                <CircleHelp className="h-3.5 w-3.5" aria-hidden />
                {!desktopCompact ? 'Como usar' : <span className="sr-only">Como usar</span>}
              </button>
            </div>
          ) : null}
          {showInstallButton ? (
            <div className={cn(!desktopCompact && 'rounded-lg border border-primary/15 bg-primary/[0.06] p-1.5')}>
              <button
                type="button"
                onClick={() => void handleInstallApp()}
                title="Instalar aplicativo"
                className={cn(
                  'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-primary text-[11px] font-black text-[#080A0D] transition-colors hover:bg-[#FFD34E]',
                  desktopCompact ? 'w-10 px-0' : 'w-full px-2.5',
                )}
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                {!desktopCompact ? 'Instalar aplicativo' : <span className="sr-only">Instalar aplicativo</span>}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void performFastLogout()}
            title="Sair"
            className={cn(
              'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#242A32] bg-[#12161A] text-[12px] font-bold text-[#94A3B8] transition-colors hover:border-red-500/30 hover:bg-red-500/[0.06] hover:text-red-300',
              desktopCompact ? 'w-10 px-0' : 'w-full px-3',
            )}
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            {!desktopCompact ? 'Sair' : <span className="sr-only">Sair</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && !isLgDesktop ? (
        <div
          className="fixed inset-0 z-[60] bg-black/65 min-[880px]:hidden"
          aria-hidden
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'app-v5-mobile-drawer fixed left-0 top-0 bottom-0 z-[70] w-[min(88vw,19.75rem)] flex-col border-r border-[#1E242B] bg-[#0B0D11] min-[880px]:hidden',
          mobileOpen ? 'flex' : 'hidden',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de módulos do AxéCloud"
      >
        <div className="flex min-h-[56px] shrink-0 items-center justify-between gap-3 border-b border-[#1E242B] px-4 py-3">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-primary/40 bg-gradient-to-br from-primary to-amber-500">
            <Avatar
              src={profileFoto}
              name={isFilhoProfile ? userDisplayName || 'Filho de Santo' : terreiroNome}
              alt=""
              className="h-full w-full"
              textSize="text-[10px]"
            />
          </div>
          <div className="min-w-0 flex-1">
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
          // Remonta o conteúdo a cada abertura para os grupos (Casa/Financeiro)
          // voltarem recolhidos — o drawer fica no DOM mesmo fechado.
          key={mobileOpen ? 'drawer-open' : 'drawer-closed'}
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
                  badgeCount={badgeForItem(item.id)}
                  onSelect={() => handleSelect(item)}
                />
              ))
            : zeladorEntries?.map((entry, index) =>
                renderMobileDrawerEntry(entry, entry.type === 'item' ? entry.item.id : `drawer-${index}`),
              )}
        </nav>

        <div className="shrink-0 space-y-2 border-t border-[#1E242B] px-3 py-4">
          {userRole === 'filho' ? (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openFilhoTour();
              }}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[#2A313C] bg-[#12161A] px-4 text-sm font-bold text-[#E8EDF5] touch-manipulation hover:border-primary/40 hover:text-primary"
            >
              <CircleHelp className="h-5 w-5 shrink-0" aria-hidden />
              Como usar o app
            </button>
          ) : null}
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
        className="app-v5-mobile-header sticky top-0 z-50 w-full max-w-full min-w-0 shrink-0 overflow-hidden border-b border-[#242A32] bg-[#101319] pt-[env(safe-area-inset-top,0px)] min-[880px]:hidden"
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
          <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
            <NotificationPanel
              tenantData={tenantData}
              userRole={userRole}
              userId={userId}
              onNavigate={setActiveTab}
              placement="inline"
            />
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

      </div>
    </header>

      <nav className="app-v5-bottom-nav fixed inset-x-3 bottom-3 z-[52] grid grid-cols-5 items-center min-[880px]:hidden" aria-label="Navegação principal">
        {mobileDockItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          const tourTarget =
            item.id === 'financial'
              ? 'nav-mensalidade'
              : item.id === 'calendar'
                ? 'nav-giras'
                : item.id === 'chat'
                  ? 'nav-conversas'
                  : undefined;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item)}
              aria-current={active ? 'page' : undefined}
              className={cn('app-v5-bottom-nav__item', active && 'is-active')}
              data-filho-tour={tourTarget}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
              <span>{item.label === 'Filhos de Santo' ? 'Corrente' : item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          className={cn('app-v5-bottom-nav__item', mobileOpen && 'is-active')}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden />
          <span>Mais</span>
        </button>
      </nav>
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
        'app-view-canvas mx-auto w-full flex-1 px-4 py-5 sm:px-6 md:py-7 lg:px-8 xl:px-10',
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
