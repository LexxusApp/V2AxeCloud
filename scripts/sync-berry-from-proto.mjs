import fs from 'fs';

const protoCss = fs.readFileSync('C:/Users/Lucas A/Desktop/Axecloud-Dashboard-Local/styles.css', 'utf8');

// The new berry-dashboard.css:
// 1. Starts with @import for Inter font
// 2. Maps 'body {' to '.axe-berry-mode, body.axe-berry-active {'
// 3. Forces Inter font on all elements in .axe-berry-mode so global index.css cannot pollute it
// 4. Contains the full protoCss
// 5. Appends the minor React shell helpers (.app-main.is-internal-view, etc.)

let content = `/* ==========================================================================
   AXÉ PRO DASHBOARD - DIRECT PROTOTYPE STYLES (PORT 5000 SYNC)
   Source: C:/Users/Lucas A/Desktop/Axecloud-Dashboard-Local/styles.css
   ========================================================================== */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

/* Force 100% Inter font across the whole Berry Dashboard, identical to localhost:5000 */
.axe-berry-mode,
.axe-berry-mode *,
.app-shell,
.app-shell *,
.dashboard-main-content,
.dashboard-main-content *,
.app-topbar,
.app-topbar *,
.app-sidebar,
.app-sidebar * {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
}

`;

// Replace `body {` with `.axe-berry-mode {` so it scopes properly
let adaptedProto = protoCss.replace(/^body\s*\{/m, '.axe-berry-mode, .app-shell {');

// Append adapted prototype
content += adaptedProto;

// Append internal view helper for tabs other than dashboard
content += `

/* ==========================================================================
   REACT APP SHELL INTEGRATION HELPERS
   ========================================================================== */
.app-main.is-dashboard {
  background: #0f1411;
}

.app-main.is-internal-view {
  background: #F7F3EA;
}

/* Ensure mobile sidebar toggle and backdrop works seamlessly */
.mobile-sidebar-backdrop {
  position: fixed;
  top: 72px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 995;
  animation: fadeInBackdrop 200ms ease;
}

@keyframes fadeInBackdrop {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;

fs.writeFileSync('c:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/src/components/dashboard-berry/berry-dashboard.css', content, 'utf8');
console.log('Successfully synced berry-dashboard.css from prototype! Length:', content.length);
