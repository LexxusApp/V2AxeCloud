import fs from 'fs';

// 1. Update berry-dashboard.css
const berryCssPath = 'src/components/dashboard-berry/berry-dashboard.css';
let berryCss = fs.readFileSync(berryCssPath, 'utf-8');

// Replace .nav-section-title
berryCss = berryCss.replace(
  /\.nav-section-title\s*\{[^}]*\}/s,
  `.nav-section-title {
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.05em;
  color: #697063;
  padding: 14px 12px 6px;
  text-transform: uppercase;
  white-space: nowrap;
  transition: opacity 0.2s ease, max-height 0.25s ease, padding 0.2s ease;
  overflow: hidden;
  max-height: 40px;
}`
);

// Replace .nav-item
berryCss = berryCss.replace(
  /\.nav-item\s*\{[^}]*\}/s,
  `.nav-item {
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-inner);
  color: #a4aba0;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.33;
  letter-spacing: normal;
  text-decoration: none;
  transition: all 180ms ease;
  margin-bottom: 3px;
  position: relative;
  white-space: nowrap;
}`
);

// Replace .nav-item.active
berryCss = berryCss.replace(
  /\.nav-item\.active\s*\{[^}]*\}/s,
  `.nav-item.active {
  background: #e5ae12;
  color: #0b1a13;
  font-weight: 500;
}`
);

// Replace .nav-sub-item
berryCss = berryCss.replace(
  /\.nav-sub-item\s*\{[^}]*\}/s,
  `.nav-sub-item {
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  color: #949a8f;
  font-size: 13.5px;
  font-weight: 400;
  line-height: 1.33;
  letter-spacing: normal;
  text-decoration: none;
  transition: all 150ms ease;
  white-space: nowrap;
}`
);

// Replace .nav-sub-item.active
berryCss = berryCss.replace(
  /\.nav-sub-item\.active\s*\{[^}]*\}/s,
  `.nav-sub-item.active {
  background: rgba(229, 174, 18, 0.15);
  color: #e5ae12;
  font-weight: 500;
  border: 1px solid rgba(229, 174, 18, 0.35);
}`
);

// Ensure .nav-group-header has Roboto
if (!berryCss.includes('.nav-group-header {')) {
  berryCss += `\n.nav-group-header {
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.33;
  letter-spacing: normal;
}\n`;
} else {
  berryCss = berryCss.replace(
    /\.nav-group-header\s*\{[^}]*\}/s,
    `.nav-group-header {
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.33;
  letter-spacing: normal;
}`
  );
}

// Replace .nav-group.is-expanded .nav-group-header
berryCss = berryCss.replace(
  /\.nav-group\.is-expanded \.nav-group-header\s*\{[^}]*\}/s,
  `.nav-group.is-expanded .nav-group-header {
  color: #e5ae12;
  font-weight: 500;
}`
);

fs.writeFileSync(berryCssPath, berryCss, 'utf-8');
console.log('✓ berry-dashboard.css atualizado com a tipografia do Berry (Roboto)!');

// 2. Update src/index.css
const indexCssPath = 'src/index.css';
let indexCss = fs.readFileSync(indexCssPath, 'utf-8');

// Prepend Google font import for Roboto at the top if not present
if (!indexCss.includes("family=Roboto")) {
  indexCss = `@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');\n` + indexCss;
}

// Add menu typography rules to index.css
const menuRules = `
/* ==========================================================================
   BERRY MENU TYPOGRAPHY UNIFIED (ROBOTO, FONT-WEIGHT 400/500, FONT-SIZE 14PX)
   ========================================================================== */
.app-sidebar,
.app-sidebar *,
.sidebar-nav,
.sidebar-nav *,
.app-v5-sidebar,
.app-v5-sidebar *,
.app-v5-mobile-drawer,
.app-v5-mobile-drawer *,
.app-v5-primary-nav,
.app-v5-primary-nav * {
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
}

.app-sidebar .nav-item,
.app-v5-sidebar [role="tab"],
.app-v5-mobile-drawer [role="tab"] {
  font-family: 'Roboto', sans-serif !important;
  font-size: 14px !important;
  font-weight: 400 !important;
  letter-spacing: normal !important;
  line-height: 1.33 !important;
}

.app-sidebar .nav-item.active,
.app-v5-sidebar [role="tab"][aria-selected="true"],
.app-v5-mobile-drawer [role="tab"][aria-selected="true"] {
  font-weight: 500 !important;
}

.app-sidebar .nav-section-title,
.app-v5-sidebar .nav-section-title,
.app-v5-sidebar p.font-black,
.app-v5-mobile-drawer p.font-black {
  font-family: 'Roboto', sans-serif !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  letter-spacing: 0.05em !important;
}
`;

if (!indexCss.includes('BERRY MENU TYPOGRAPHY UNIFIED')) {
  indexCss += '\n' + menuRules;
}

fs.writeFileSync(indexCssPath, indexCss, 'utf-8');
console.log('✓ src/index.css atualizado com regras globais do menu Berry!');
