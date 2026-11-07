import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, ChevronDown, ChevronRight, Download, HelpCircle, LogOut, Menu, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Search, Settings, UserRound, X } from 'lucide-react';
import { buildZeladorNavEntries, FILHO_NAV, flattenZeladorNavEntries, managementHubFromTab, navItemPlanFeature, type AppNavItem } from '../../constants/appNav';
import { hasPlanAccess } from '../../constants/plans';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { useObrigacoesUnread } from '../../hooks/useObrigacoesUnread';
import { performFastLogout } from '../../lib/logout';
import { openFilhoTour } from '../../constants/filhoGuide';
import Avatar from '../Avatar';
import NotificationPanel from '../NotificationPanel';
import type { AppTopNavProps } from './AppTopNav';
import { AppOperationStatus } from './AppOperationStatus';
import { ModernInterfaceContext } from './ModernInterfaceContext';
import { openSettingsDestination } from '../../lib/settingsNavigation';
import './modern-app.css';

const ACCOUNT_ITEMS = new Set(['subscription', 'settings', 'suporte']);
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export default function ModernAppShell({ children, activeTab, setActiveTab, userRole, isAdmin, tenantData, userDisplayName, userId, userEmail, filhoFotoUrl }: AppTopNavProps & { children: ReactNode }) {
  const isMember = userRole === 'filho';
  const entries = useMemo(() => buildZeladorNavEntries(tenantData?.tradicao, tenantData?.tenant_id, userEmail), [tenantData?.tradicao, tenantData?.tenant_id, userEmail]);
  const items = useMemo(() => isMember ? FILHO_NAV : flattenZeladorNavEntries(entries), [isMember, entries]);
  const currentItem = items.find(item => item.id === activeTab) || items.find(item => item.id === managementHubFromTab(activeTab));
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('axecloud:modern-sidebar') === 'collapsed'; } catch { return false; } });
  const [groups, setGroups] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const pwa = usePwaInstall();
  const { unreadCount: obligationCount } = useObrigacoesUnread(isMember, userId, tenantData?.tenant_id, userEmail);
  const isCoAdmin = Boolean((tenantData as any)?.is_co_admin);
  const name = userDisplayName
    ? (isCoAdmin ? `${userDisplayName} (Co-Admin)` : userDisplayName)
    : (isMember ? 'Membro da casa' : isCoAdmin ? 'Co-Administrador(a)' : 'Zelador(a)');
  const house = tenantData?.nome || 'Sua casa';

  useEffect(() => {
    const group = entries.find(entry => entry.type !== 'item' && entry.items.some(item => item.id === activeTab));
    if (group && group.type !== 'item') setGroups(previous => previous.includes(group.type) ? previous : [...previous, group.type]);
    setDrawerOpen(false);
    setAccountOpen(false);
  }, [activeTab, entries]);

  useEffect(() => {
    if (!accountOpen) return;
    const outside = (event: PointerEvent) => { if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setAccountOpen(false); accountTrigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [accountOpen]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(open => !open); }
    };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, []);

  function navigate(id: string) { setSearchOpen(false); setDrawerOpen(false); setAccountOpen(false); setActiveTab(id); }
  function openAccount() { if (isMember) navigate('profile'); else openSettingsDestination({ section: 'profile' }, navigate); }
  function toggleSidebar() {
    setCollapsed(value => { try { localStorage.setItem('axecloud:modern-sidebar', value ? 'expanded' : 'collapsed'); } catch { /* preference is optional */ } return !value; });
  }
  function selectGroup(type: string) {
    if (collapsed) { setCollapsed(false); try { localStorage.setItem('axecloud:modern-sidebar', 'expanded'); } catch { /* preference is optional */ } }
    setGroups(previous => previous.includes(type) ? previous.filter(value => value !== type) : [...previous, type]);
  }
  const navItem = (item: AppNavItem, child = false, dockItem = false) => {
    const financial = activeTab === 'financial' || activeTab.startsWith('financial-');
    const active = financial ? (dockItem && item.id === 'financial') || item.id === activeTab : managementHubFromTab(activeTab) === item.id;
    const allowed = isMember || hasPlanAccess(tenantData?.plan, navItemPlanFeature(item.id), Boolean(isAdmin));
    const Icon = item.icon;
    return <button key={item.id} type="button" className={`modern-nav-item${child ? ' is-child' : ''}${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} title={collapsed ? item.label : undefined} onClick={() => navigate(item.id)}>
      <Icon size={19} aria-hidden="true"/><span>{item.label}</span>{!allowed && <small>Plano</small>}{item.id === 'obrigacoes' && obligationCount > 0 && <small>{obligationCount}</small>}
    </button>;
  };
  const navigation = (prefix: string) => <>
    <div className="modern-nav-label">{isMember ? 'Sua caminhada' : 'Gestão da casa'}</div>
    {isMember ? items.map(item => navItem(item)) : entries.filter(entry => entry.type !== 'item' || !ACCOUNT_ITEMS.has(entry.item.id)).map(entry => {
      if (entry.type === 'item') return navItem(entry.item);
      const Icon = entry.icon, expanded = groups.includes(entry.type), railCollapsed = prefix === 'desktop' && collapsed, active = entry.items.some(item => item.id === activeTab);
      return <div className="modern-nav-group" key={entry.type}><button type="button" className={`modern-nav-item${active ? ' has-active-child' : ''}`} aria-expanded={expanded && !railCollapsed} aria-controls={`${prefix}-modern-group-${entry.type}`} title={collapsed ? entry.label : undefined} onClick={() => selectGroup(entry.type)}><Icon size={19} aria-hidden="true"/><span>{entry.label}</span><ChevronDown size={15} className={expanded ? 'is-rotated' : ''} aria-hidden="true"/></button>{expanded && !railCollapsed && <div id={`${prefix}-modern-group-${entry.type}`} className="modern-nav-children">{entry.items.map(item => navItem(item, true))}</div>}</div>;
    })}
    {!isMember && <><div className="modern-nav-label is-account">Conta e suporte</div>{items.filter(item => ACCOUNT_ITEMS.has(item.id) && (!isCoAdmin || item.id !== 'subscription')).map(item => navItem(item))}</>}
    {isAdmin && navItem({ id: 'admin', label: 'Administração', icon: Settings })}
  </>;
  const dock = isMember ? ['profile', 'calendar', 'financial', 'chat'] : ['dashboard', 'children', 'calendar', 'financial'];
  const found = items.filter(item => normalize(item.label).includes(normalize(query)));

  return <ModernInterfaceContext.Provider value={true}><div className={`modern-app app-v3 app-v4-experiment app-v5-identity${collapsed ? ' modern-is-collapsed' : ''}`} data-role={userRole} data-tab={activeTab}>
    <a className="modern-skip" href="#modern-main">Ir para o conteúdo</a>
    <aside className="modern-sidebar" aria-label="Menu principal">
      <button type="button" className="modern-brand" aria-label="Ir para o início" onClick={() => navigate(isMember ? 'profile' : 'dashboard')}><img src="/trident-cropped.png" alt=""/><span>Axé<span>Cloud</span></span></button>
      <nav aria-label="Áreas do sistema">{navigation('desktop')}</nav>
      <div className="modern-sidebar-foot">{pwa.canInstall && <button type="button" className="modern-install" onClick={() => void pwa.install()}><Download size={17}/><span>Instalar aplicativo</span></button>}<button type="button" className="modern-account-link" onClick={openAccount}><Avatar src={isMember ? filhoFotoUrl : tenantData?.foto_url} name={name} className="h-9 w-9 shrink-0"/><span><strong>{name}</strong><small>{isMember ? house : 'Minha conta e configurações'}</small></span><MoreHorizontal size={18}/></button></div>
    </aside>
    <div className="modern-workspace">
      <header className="modern-topbar">
        <button type="button" className="modern-icon modern-collapse" onClick={toggleSidebar} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>{collapsed ? <PanelLeftOpen size={20}/> : <PanelLeftClose size={20}/>}</button>
        <button type="button" className="modern-icon modern-mobile-menu" aria-label="Abrir menu" onClick={() => setDrawerOpen(true)}><Menu size={21}/></button>
        <div className="modern-context"><small>{house}</small><span>{isMember ? 'Minha casa' : 'Painel'}<ChevronRight size={13}/><strong>{currentItem?.label || (activeTab === 'child-profile' ? 'Perfil do membro' : 'Minha conta')}</strong>{isCoAdmin && <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">👑 Co-Admin</span>}</span></div>
        <button type="button" className="modern-search-trigger" onClick={() => setSearchOpen(true)} aria-label="Buscar no sistema"><Search size={18}/><span>Buscar no sistema</span><kbd>Ctrl K</kbd></button>
        <NotificationPanel tenantData={tenantData} userRole={userRole} userId={userId} onNavigate={navigate} placement="inline"/>
        <div ref={accountRef} className="modern-account"><button ref={accountTrigger} type="button" className="modern-profile-trigger" aria-label="Opções da minha conta" aria-expanded={accountOpen} aria-controls="modern-account-options" onClick={() => setAccountOpen(open => !open)}><Avatar src={isMember ? filhoFotoUrl : tenantData?.foto_url} name={name} className="h-9 w-9"/></button>{accountOpen && <div id="modern-account-options" className="modern-account-options"><strong>{name}</strong><small>{userEmail || house}</small><button type="button" onClick={openAccount}><UserRound size={17}/>{isMember ? 'Meu perfil' : 'Minha conta'}</button>{!isMember && !isCoAdmin && <button type="button" onClick={() => navigate('subscription')}><Settings size={17}/>Minha assinatura</button>}<button type="button" onClick={() => { if (isMember) { setAccountOpen(false); openFilhoTour(); } else navigate('suporte'); }}><HelpCircle size={17}/>Ajuda e suporte</button><button type="button" onClick={() => void performFastLogout()}><LogOut size={17}/>Sair da conta</button></div>}</div>
      </header>
      <AppOperationStatus/>
      <main ref={mainRef} id="modern-main" tabIndex={-1} className="modern-content app-page-shell" data-role={userRole} data-tab={activeTab}>{children}</main>
    </div>
    <nav className="modern-dock" aria-label="Navegação principal no celular">{dock.map(id => { const item = items.find(item => item.id === id); return item ? navItem({ ...item, label: id === 'children' ? 'Corrente' : id === 'financial' && !isMember ? 'Financeiro' : item.label }, false, true) : null; })}<button type="button" className="modern-nav-item" aria-label="Mais opções do menu" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><MoreHorizontal size={21}/><span>Mais</span></button></nav>
    <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}><Dialog.Portal><Dialog.Overlay className="modern-dialog-overlay"/><Dialog.Content className="modern-drawer"><div className="modern-dialog-heading"><Dialog.Title>Menu da casa</Dialog.Title><Dialog.Close asChild><button type="button" className="modern-icon" aria-label="Fechar menu"><X size={21}/></button></Dialog.Close></div><Dialog.Description>{house}</Dialog.Description><nav aria-label="Todas as áreas do sistema">{navigation('mobile')}</nav><button type="button" className="modern-drawer-logout" onClick={() => void performFastLogout()}><LogOut size={18}/>Sair da conta</button></Dialog.Content></Dialog.Portal></Dialog.Root>
    <Dialog.Root open={searchOpen} onOpenChange={setSearchOpen}><Dialog.Portal><Dialog.Overlay className="modern-dialog-overlay"/><Dialog.Content className="modern-search-dialog"><div className="modern-dialog-heading"><Dialog.Title>Buscar no sistema</Dialog.Title><Dialog.Close asChild><button type="button" className="modern-icon" aria-label="Fechar busca"><X size={21}/></button></Dialog.Close></div><Dialog.Description>Encontre uma área da sua casa.</Dialog.Description><label className="modern-search-input"><Search size={19}/><input aria-label="Nome da área" value={query} onChange={event => setQuery(event.target.value)} placeholder="Mensalidades, biblioteca, giras…"/></label><div className="modern-search-results">{found.length ? found.map(item => <button key={item.id} type="button" onClick={() => navigate(item.id)}><item.icon size={19}/><span>{item.label}</span><ArrowRight size={17}/></button>) : <p>Nenhuma área encontrada. Tente outro nome.</p>}</div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div></ModernInterfaceContext.Provider>;
}
