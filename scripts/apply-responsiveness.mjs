import fs from 'fs';
import path from 'path';

const cwd = process.cwd();
const basePath = cwd.endsWith('AxecloudV2') ? cwd : path.join(cwd, 'AxecloudV2');
const berryAppShellPath = path.join(basePath, 'src/components/dashboard-berry/BerryAppShell.tsx');
const berryCssPath = path.join(basePath, 'src/components/dashboard-berry/berry-dashboard.css');

// 1. Update BerryAppShell.tsx
let shellContent = fs.readFileSync(berryAppShellPath, 'utf8');

// Replace initial collapsed state logic
shellContent = shellContent.replace(
  `const [sidebarCollapsed, setSidebarCollapsed] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 820 : false));`,
  `const [sidebarCollapsed, setSidebarCollapsed] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 1024 : false));`
);

// Replace handleNav
shellContent = shellContent.replace(
  `if (typeof window !== 'undefined' && window.innerWidth <= 820) {`,
  `if (typeof window !== 'undefined' && window.innerWidth <= 1024) {`
);

// Replace brand link onClick
shellContent = shellContent.replace(
  `onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }}`,
  `onClick={(e) => { e.preventDefault(); handleNav('dashboard'); }}`
);

// Replace notification onClick
shellContent = shellContent.replace(
  `onClick={() => setActiveTab('mural')}`,
  `onClick={() => handleNav('mural')}`
);

// Replace popover navigation items
shellContent = shellContent.replace(
  `onClick={() => { setProfileDropdownOpen(false); setActiveTab('subscription'); }}`,
  `onClick={() => { setProfileDropdownOpen(false); handleNav('subscription'); }}`
);

shellContent = shellContent.replace(
  `onClick={() => { setProfileDropdownOpen(false); setActiveTab('settings'); }}`,
  `onClick={() => { setProfileDropdownOpen(false); handleNav('settings'); }}`
);

shellContent = shellContent.replace(
  `onClick={() => { setProfileDropdownOpen(false); setActiveTab('radar'); }}`,
  `onClick={() => { setProfileDropdownOpen(false); handleNav('radar'); }}`
);

shellContent = shellContent.replace(
  `onClick={() => { setProfileDropdownOpen(false); setActiveTab('suporte'); }}`,
  `onClick={() => { setProfileDropdownOpen(false); handleNav('suporte'); }}`
);

fs.writeFileSync(berryAppShellPath, shellContent, 'utf8');
console.log('Updated BerryAppShell.tsx successfully');

// 2. Update berry-dashboard.css
let cssContent = fs.readFileSync(berryCssPath, 'utf8');

const responsiveBlockMarker = 'RESPONSIVIDADE COMPLETA: MOBILE, TABLET & DESKTOP (BERRY + AXÉ)';

if (!cssContent.includes(responsiveBlockMarker)) {
  const responsiveStyles = `

/* ==========================================================================
   RESPONSIVIDADE COMPLETA: MOBILE, TABLET & DESKTOP (BERRY + AXÉ)
   ========================================================================== */

/* 1. DISPOSITIVOS MÓVEIS (SMARTPHONES <= 768px) */
@media (max-width: 768px) {
  /* Previne qualquer overflow horizontal global */
  html, body, #root, .app-shell {
    max-width: 100vw !important;
    overflow-x: hidden !important;
  }

  /* Topbar enxuto e alinhado */
  .app-topbar {
    padding: 0 12px !important;
    height: 64px !important;
    gap: 8px !important;
  }

  .topbar-left {
    gap: 8px !important;
    flex: 1 1 auto !important;
    min-width: 0 !important;
  }

  .topbar-brand-link {
    width: auto !important;
    gap: 8px !important;
    flex-shrink: 0 !important;
  }

  .topbar-brand-icon {
    width: 26px !important;
    height: 32px !important;
  }

  .topbar-brand-name {
    font-size: 16px !important;
  }

  /* Oculta subtítulo da marca no mobile para economizar espaço precioso */
  .topbar-brand-tag {
    display: none !important;
  }

  .topbar-menu-toggle {
    width: 36px !important;
    height: 36px !important;
  }

  /* Campo de busca do topbar fica oculto em smartphones para que o perfil do zelador e avisos fiquem 100% visíveis */
  .berry-search-box {
    display: none !important;
  }

  .topbar-right {
    gap: 8px !important;
    flex-shrink: 0 !important;
  }

  .topbar-btn.notification {
    width: 36px !important;
    height: 36px !important;
  }

  .berry-profile-chip {
    padding: 3px 6px 3px 3px !important;
    gap: 6px !important;
  }

  .profile-avatar-wrap {
    width: 32px !important;
    height: 32px !important;
  }

  .profile-gear-icon {
    width: 16px !important;
    height: 16px !important;
  }

  /* Popover do perfil contido perfeitamente na tela mobile */
  .berry-profile-dropdown {
    width: calc(100vw - 24px) !important;
    max-width: 340px !important;
    right: 0 !important;
    top: calc(100% + 8px) !important;
    padding: 14px !important;
  }

  /* Sidebar no mobile: gaveta flutuante (overlay) quando aberta, e 100% oculta quando recolhida */
  .app-shell.sidebar-collapsed .app-sidebar {
    display: none !important;
    width: 0 !important;
    min-width: 0 !important;
  }

  .app-sidebar {
    position: fixed !important;
    top: 64px !important;
    left: 0 !important;
    bottom: 0 !important;
    width: 280px !important;
    max-width: 82vw !important;
    height: calc(100vh - 64px) !important;
    z-index: 1000 !important;
    box-shadow: 6px 0 28px rgba(0, 0, 0, 0.7) !important;
    background: #0f1411 !important;
  }

  .mobile-sidebar-backdrop {
    top: 64px !important;
    z-index: 999 !important;
    display: block !important;
  }

  /* Workspace e Conteúdo Principal ocupam 100% da tela */
  .app-workspace {
    width: 100% !important;
    max-width: 100vw !important;
    min-height: calc(100vh - 64px) !important;
    margin-left: 0 !important;
  }

  .app-main {
    width: 100% !important;
    max-width: 100vw !important;
    overflow-x: hidden !important;
  }

  .dashboard-main-content {
    margin-right: 0 !important;
    border-radius: 0 !important;
    padding: 14px 12px 32px !important;
    width: 100% !important;
    max-width: 100vw !important;
  }

  /* Ajustes finos dos Cards da Dashboard no Smartphone */
  .hero-cinematic-grid {
    grid-template-columns: 1fr !important;
    gap: 16px !important;
    margin-bottom: 16px !important;
  }

  .cinematic-gira-card {
    min-height: 250px !important;
  }

  .cinematic-gira-content {
    max-width: 100% !important;
  }

  .cinematic-actions-row {
    flex-wrap: wrap !important;
    gap: 8px !important;
  }

  .btn-cinematic-notify,
  .btn-cinematic-open {
    flex: 1 1 100% !important;
    justify-content: center !important;
    text-align: center !important;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 10px !important;
    margin-bottom: 18px !important;
  }

  .metric-card {
    padding: 14px 12px !important;
  }

  .metric-number {
    font-size: 20px !important;
  }

  .metric-label {
    font-size: 11px !important;
  }

  .shortcuts-row {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 8px !important;
  }

  .featured-widgets-grid,
  .bottom-sections-grid {
    grid-template-columns: 1fr !important;
    gap: 16px !important;
  }

  /* Container de páginas internas com espaçamento mobile consistente */
  .axe-berry-mode .app-main.is-internal-view > div {
    padding-left: 12px !important;
    padding-right: 12px !important;
  }
}

/* 2. TABLETS (769px a 1024px) */
@media (min-width: 769px) and (max-width: 1024px) {
  .app-topbar {
    padding: 0 16px !important;
  }

  .topbar-brand-link {
    width: auto !important;
  }

  .berry-search-box {
    max-width: 190px !important;
  }

  .dashboard-main-content {
    margin-right: 12px !important;
  }

  .hero-cinematic-grid {
    grid-template-columns: 1fr !important;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }

  .mobile-sidebar-backdrop {
    display: none !important;
  }
}

/* 3. DESKTOPS E TELAS ULTRA-WIDE (> 1024px) */
@media (min-width: 1025px) {
  .dashboard-main-content {
    margin-right: 20px;
  }

  .mobile-sidebar-backdrop {
    display: none !important;
  }
}
`;

  fs.appendFileSync(berryCssPath, responsiveStyles, 'utf8');
  console.log('Appended responsive styles to berry-dashboard.css successfully');
} else {
  console.log('Responsive styles already present in berry-dashboard.css');
}
