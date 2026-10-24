import React, { useState, useRef, useEffect } from 'react';
import { isCantinaEnabled } from '../../lib/cantinaFeature';
import './berry-dashboard.css';

interface BerryAppShellProps {
  activeTab: string;
  setActiveTab: (tab: string, subview?: string) => void;
  userRole?: string;
  isAdmin?: boolean;
  terreiroNome?: string;
  zeladorNome?: string;
  userEmail?: string | null;
  tenantId?: string | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export const BerryAppShell: React.FC<BerryAppShellProps> = ({
  activeTab,
  setActiveTab,
  userRole = 'Zelador',
  isAdmin = false,
  terreiroNome = 'Sede',
  zeladorNome = 'Zeladoria Geral',
  userEmail,
  tenantId,
  onLogout,
  children,
}) => {
  const isCasaActive = ['children', 'obligations', 'calendar', 'frequencia', 'mural', 'chat'].includes(activeTab);
  const isFinanceiroActive = ['financial', 'financial-mensalidades', 'financial-cantina', 'financial-configs'].includes(activeTab);

  // Submenus iniciam recolhidos na Dashboard e só abrem se a rota ativa pertencer ao grupo
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [casaExpanded, setCasaExpanded] = useState(() => isCasaActive);
  const [financeiroExpanded, setFinanceiroExpanded] = useState(() => isFinanceiroActive);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [popoverSearch, setPopoverSearch] = useState('');
  const [waAlertsEnabled, setWaAlertsEnabled] = useState(true);
  const [dndEnabled, setDndEnabled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Se o usuário navegar para uma rota interna do grupo, expande automaticamente
  useEffect(() => {
    if (isCasaActive) setCasaExpanded(true);
  }, [isCasaActive]);

  useEffect(() => {
    if (isFinanceiroActive) setFinanceiroExpanded(true);
  }, [isFinanceiroActive]);

  const cantinaEnabled = isCantinaEnabled(
    { tenant_id: tenantId, email: userEmail },
    userEmail
  );

  // Fecha o dropdown de perfil ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`axe-berry-mode app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      
      {/* 1. TOPBAR */}
      <header className="app-topbar">
        <div className="topbar-left">
          <a
            href="#dashboard"
            onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }}
            className="topbar-brand-link"
            title="AxéCloud — Gestão para Terreiros"
          >
            <img src="/axecloud-trident.png" alt="AxéCloud" className="topbar-brand-icon" width="32" height="40" />
            <div className="topbar-brand-nametag">
              <div className="topbar-brand-name"><span>Axé</span><em>Cloud</em></div>
              <div className="topbar-brand-tag">GESTÃO DE TERREIROS</div>
            </div>
          </a>

          <button
            className="topbar-menu-toggle"
            id="sidebar-toggle-btn"
            title="Recolher / expandir menu"
            aria-label="Recolher / expandir menu lateral"
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          </button>

          <div className="berry-search-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input type="text" placeholder="Pesquisar médiuns, giras, finanças... (Ctrl+K)" className="berry-search-input" />
          </div>
        </div>

        <div className="topbar-right">
          <button className="topbar-btn notification" title="Notificações e avisos" type="button" onClick={() => setActiveTab('mural')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            <span className="badge-dot" />
          </button>

          {/* BERRY PROFILE CHIP */}
          <div className="profile-chip-container" ref={dropdownRef}>
            <div
              className="berry-profile-chip"
              id="profile-chip-btn"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              role="button"
              tabIndex={0}
              title="Perfil e Configurações da Casa"
            >
              <div className="profile-avatar-wrap">
                <span className="text-xs font-bold text-amber-500">
                  {(zeladorNome || terreiroNome).slice(0, 2).toUpperCase()}
                </span>
              </div>
              <svg className="profile-gear-icon" xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>

            {/* POPOVER DE PERFIL ESTILO BERRY PRO */}
            {profileDropdownOpen && (
              <div className="berry-profile-dropdown show" id="profile-dropdown" style={{ display: 'flex' }}>
                {/* 1. Header do Usuário */}
                <div className="popover-user-header">
                  <div className="popover-greeting">Olá, <strong>{zeladorNome || terreiroNome}</strong></div>
                  <div className="popover-role">{userRole} · AxéCloud</div>
                </div>

                {/* 2. Campo de busca interno */}
                <div className="popover-search-wrap">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar opções da conta..."
                    className="popover-search-input"
                    value={popoverSearch}
                    onChange={(e) => setPopoverSearch(e.target.value)}
                  />
                </div>

                {/* 3. Card de Assinatura (Estilo Berry Upgrade Card) */}
                <div className="popover-plan-card">
                  <div className="plan-card-floating-badge" title="Status Pro">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </div>
                  <div className="plan-card-title">Plano AxéCloud Pro</div>
                  <div className="plan-card-desc">Terreiro verificado no Radar com WhatsApp oficial ativo.</div>
                  <button
                    className="btn-plan-action"
                    type="button"
                    onClick={() => { setProfileDropdownOpen(false); setActiveTab('subscription'); }}
                  >
                    Gerenciar Plano
                  </button>
                </div>

                {/* 4. Controles Rápidos (Toggles Block) */}
                <div className="popover-toggles-card">
                  <div className="toggle-row">
                    <span className="toggle-label">Avisos no WhatsApp</span>
                    <label className="berry-switch" title="Ativar ou pausar avisos automáticos">
                      <input
                        type="checkbox"
                        checked={waAlertsEnabled}
                        onChange={(e) => setWaAlertsEnabled(e.target.checked)}
                      />
                      <span className="switch-slider" />
                    </label>
                  </div>
                  <div className="toggle-row">
                    <span className="toggle-label">Modo Silencioso (DND)</span>
                    <label className="berry-switch" title="Silenciar notificações temporariamente">
                      <input
                        type="checkbox"
                        checked={dndEnabled}
                        onChange={(e) => setDndEnabled(e.target.checked)}
                      />
                      <span className="switch-slider" />
                    </label>
                  </div>
                </div>

                {/* 5. Links de Navegação da Conta */}
                <div className="popover-menu-list">
                  {(!popoverSearch || 'configurações da conta'.includes(popoverSearch.toLowerCase())) && (
                    <button
                      className="popover-menu-item"
                      type="button"
                      onClick={() => { setProfileDropdownOpen(false); setActiveTab('settings'); }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span>Configurações da Conta</span>
                    </button>
                  )}

                  {(!popoverSearch || 'perfil público radar'.includes(popoverSearch.toLowerCase())) && (
                    <button
                      className="popover-menu-item"
                      type="button"
                      onClick={() => { setProfileDropdownOpen(false); setActiveTab('radar'); }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 10c0 3.976-7 10-7 10s-7-6.024-7-10a7 7 0 0 1 14 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span>Perfil Público no Radar</span>
                      <span className="menu-pill-badge">Ativo</span>
                    </button>
                  )}

                  {(!popoverSearch || 'suporte e ajuda'.includes(popoverSearch.toLowerCase())) && (
                    <button
                      className="popover-menu-item"
                      type="button"
                      onClick={() => { setProfileDropdownOpen(false); setActiveTab('suporte'); }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <path d="M12 17h.01" />
                      </svg>
                      <span>Suporte e Ajuda</span>
                    </button>
                  )}

                  {(!popoverSearch || 'sair da conta'.includes(popoverSearch.toLowerCase())) && (
                    <button
                      className="popover-menu-item logout"
                      type="button"
                      onClick={() => { setProfileDropdownOpen(false); onLogout(); }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" x2="9" y1="12" y2="12" />
                      </svg>
                      <span>Sair da Conta</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. APP WORKSPACE (MENU LATERAL + CORPO) */}
      <div className="app-workspace">
        
        {/* SIDEBAR */}
        <aside className="app-sidebar">
          <nav className="sidebar-nav">
            <div className="nav-section-title">GESTÃO DA CASA</div>
            
            <a
              href="#dashboard"
              onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }}
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              title="Início"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Início</span>
            </a>

            {/* GRUPO RECOLHÍVEL: CASA */}
            <div className={`nav-group ${casaExpanded ? 'is-expanded' : ''}`} id="nav-group-casa">
              <button
                type="button"
                className={`nav-group-header ${isCasaActive ? 'text-amber-400 font-bold' : ''}`}
                title="Casa"
                onClick={() => setCasaExpanded(!casaExpanded)}
              >
                <div className="nav-group-title">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  </svg>
                  <span>Casa</span>
                </div>
                <svg className="nav-group-chevron" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              
              <div className="nav-group-subitems">
                <a
                  href="#children"
                  onClick={(e) => { e.preventDefault(); setActiveTab('children'); }}
                  className={`nav-sub-item ${activeTab === 'children' ? 'active' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span>Filhos de Santo</span>
                </a>
                <a
                  href="#obligations"
                  onClick={(e) => { e.preventDefault(); setActiveTab('obligations'); }}
                  className={`nav-sub-item ${activeTab === 'obligations' ? 'active' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                  </svg>
                  <span>Obrigações</span>
                </a>
                <a
                  href="#calendar"
                  onClick={(e) => { e.preventDefault(); setActiveTab('calendar'); }}
                  className={`nav-sub-item ${activeTab === 'calendar' ? 'active' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                  <span>Giras</span>
                </a>
                <a
                  href="#frequencia"
                  onClick={(e) => { e.preventDefault(); setActiveTab('frequencia'); }}
                  className={`nav-sub-item ${activeTab === 'frequencia' ? 'active' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" />
                  </svg>
                  <span>Frequência</span>
                </a>
                <a
                  href="#mural"
                  onClick={(e) => { e.preventDefault(); setActiveTab('mural'); }}
                  className={`nav-sub-item ${activeTab === 'mural' ? 'active' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                  </svg>
                  <span>Comunicados</span>
                </a>
                <a
                  href="#chat"
                  onClick={(e) => { e.preventDefault(); setActiveTab('chat'); }}
                  className={`nav-sub-item ${activeTab === 'chat' ? 'active' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                  </svg>
                  <span>Mensagens</span>
                </a>
              </div>
            </div>

                        {/* GRUPO RECOLHÍVEL: FINANCEIRO */}
            <div className={`nav-group ${financeiroExpanded ? 'is-expanded' : ''}`} id="nav-group-financeiro">
              <button
                type="button"
                className={`nav-group-header ${isFinanceiroActive ? 'text-amber-400 font-bold' : ''}`}
                onClick={() => setFinanceiroExpanded(!financeiroExpanded)}
                aria-expanded={financeiroExpanded}
              >
                <div className="nav-group-title">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
                  </svg>
                  <span>Financeiro</span>
                </div>
                <svg className="nav-group-chevron" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div className="nav-group-subitems">
                {/* 1. Visão Geral */}
                <a
                  href="#financial"
                  onClick={(e) => { e.preventDefault(); setActiveTab('financial'); }}
                  className={`nav-sub-item ${activeTab === 'financial' ? 'active' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
                  </svg>
                  <span>Visão geral</span>
                </a>

                {/* 2. Mensalidades */}
                <a
                  href="#financial-mensalidades"
                  onClick={(e) => { e.preventDefault(); setActiveTab('financial-mensalidades'); }}
                  className={`nav-sub-item ${activeTab === 'financial-mensalidades' ? 'active' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" />
                  </svg>
                  <span>Mensalidades</span>
                </a>

                {/* 3. Cantina da Casa (se autorizada) */}
                {cantinaEnabled && (
                  <a
                    href="#financial-cantina"
                    onClick={(e) => { e.preventDefault(); setActiveTab('financial-cantina'); }}
                    className={`nav-sub-item ${activeTab === 'financial-cantina' ? 'active' : ''}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 2v2" />
                      <path d="M14 2v2" />
                      <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h12Z" />
                      <path d="M6 2v2" />
                    </svg>
                    <span>Cantina</span>
                  </a>
                )}

                {/* 4. Configurações Pix */}
                <a
                  href="#financial-configs"
                  onClick={(e) => { e.preventDefault(); setActiveTab('financial-configs'); }}
                  className={`nav-sub-item ${activeTab === 'financial-configs' ? 'active' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                    <path d="M12 18h.01" />
                  </svg>
                  <span>Configurações Pix</span>
                </a>
              </div>
            </div>

            <a
              href="#gallery"
              onClick={(e) => { e.preventDefault(); setActiveTab('gallery'); }}
              className={`nav-item ${activeTab === 'gallery' ? 'active' : ''}`}
              title="Galeria"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              <span>Galeria</span>
            </a>

            <a
              href="#inventory"
              onClick={(e) => { e.preventDefault(); setActiveTab('inventory'); }}
              className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
              title="Almoxarifado"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
              </svg>
              <span>Almoxarifado</span>
            </a>

            <a
              href="#library"
              onClick={(e) => { e.preventDefault(); setActiveTab('library'); }}
              className={`nav-item ${activeTab === 'library' ? 'active' : ''}`}
              title="Biblioteca"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" /><path d="M6 6h10" /><path d="M6 10h10" />
              </svg>
              <span>Biblioteca</span>
            </a>

            <a
              href="#store"
              onClick={(e) => { e.preventDefault(); setActiveTab('store'); }}
              className={`nav-item ${activeTab === 'store' ? 'active' : ''}`}
              title="Loja da Casa"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span>Loja da Casa</span>
            </a>

            <a
              href="#radar"
              onClick={(e) => { e.preventDefault(); setActiveTab('radar'); }}
              className={`nav-item ${activeTab === 'radar' ? 'active' : ''}`}
              title="Radar AxéCloud"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 10c0 3.976-7 10-7 10s-7-6.024-7-10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span>Radar AxéCloud</span>
            </a>

            <div className="nav-section-title" style={{ marginTop: '14px' }}>CONTA & AJUDA</div>

            <a
              href="#subscription"
              onClick={(e) => { e.preventDefault(); setActiveTab('subscription'); }}
              className={`nav-item ${activeTab === 'subscription' ? 'active' : ''}`}
              title="Minha assinatura"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" />
              </svg>
              <span>Minha assinatura</span>
            </a>

            <a
              href="#settings"
              onClick={(e) => { e.preventDefault(); setActiveTab('settings'); }}
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              title="Configurações"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Configurações</span>
            </a>

            <a
              href="#suporte"
              onClick={(e) => { e.preventDefault(); setActiveTab('suporte'); }}
              className={`nav-item ${activeTab === 'suporte' ? 'active' : ''}`}
              title="Suporte"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
              </svg>
              <span>Suporte</span>
            </a>
          </nav>

          <div className="sidebar-footer">
            <button
              className="btn-logout"
              data-tooltip="Sair"
              title="Sair da conta"
              type="button"
              onClick={onLogout}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
              </svg>
              <span>Sair</span>
            </button>
          </div>
        </aside>

        {/* 3. MAIN BODY */}
        <main className="app-main">
          {children}
        </main>
      </div>

    </div>
  );
};

export default BerryAppShell;
