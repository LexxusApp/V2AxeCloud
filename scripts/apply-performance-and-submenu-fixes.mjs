import fs from "fs";

// 1. PATCH src/App.tsx
console.log("Patching src/App.tsx...");
let appContent = fs.readFileSync("src/App.tsx", "utf-8");

// Remove startViewTransition in navigateToTab
appContent = appContent.replace(
  /const navigateToTab = \(tab: string\) => \{[\s\S]*?setActiveTab\(nextTab\);\s*\};/,
  `const navigateToTab = (tab: string) => {
    const requestedTab = tab === 'atendimentos' ? 'consulentes' : tab;
    const nextTab = userRole === 'filho' ? normalizeFilhoTab(requestedTab) : requestedTab;
    if (nextTab === activeTab) return;
    setActiveTab(nextTab);
  };`
);

// Remove transition-[padding] duration-200
appContent = appContent.replace(
  /transition-\[padding\] duration-200 min-\[880px\]:pl-\[var\(--app-sidebar-width,15rem\)\]/,
  `min-[880px]:pl-[var(--app-sidebar-width,15rem)]`
);

fs.writeFileSync("src/App.tsx", appContent, "utf-8");
console.log("src/App.tsx patched successfully!");

// 2. PATCH src/components/app/AppTopNav.tsx
console.log("Patching src/components/app/AppTopNav.tsx...");
let topNavContent = fs.readFileSync("src/components/app/AppTopNav.tsx", "utf-8");

// Pass activeTab instead of navActiveTab to NavGroupMobileSection
topNavContent = topNavContent.replace(
  /items=\{entry\.items\}\s*activeTab=\{navActiveTab\}/,
  `items={entry.items}\n        activeTab={activeTab}`
);

// In NavGroupMobileSection, make isGroupActive check prefix and item active check direct
topNavContent = topNavContent.replace(
  /const isGroupActive = items\.some\(\(i\) => i\.id === activeTab\);/,
  `const isGroupActive = items.some((i) => i.id === activeTab || (i.id === 'financial' && activeTab.startsWith('financial')));`
);

topNavContent = topNavContent.replace(
  /isActive=\{activeTab === item\.id\}/,
  `isActive={activeTab === item.id || (item.id === 'financial' && activeTab === 'financial')}`
);

fs.writeFileSync("src/components/app/AppTopNav.tsx", topNavContent, "utf-8");
console.log("src/components/app/AppTopNav.tsx patched successfully!");

// 3. PATCH src/index.css
console.log("Patching src/index.css...");
let indexCssContent = fs.readFileSync("src/index.css", "utf-8");

// Make sidebar transition instant (transition: none)
indexCssContent = indexCssContent.replace(
  /transition: width 200ms cubic-bezier\(0\.2, 0, 0, 1\);/,
  `transition: none !important;`
);

// Disable app-view-continuity animation & blur
indexCssContent = indexCssContent.replace(
  /\.app-v5-identity \.app-view-transition \{[\s\S]*?animation: app-view-continuity 280ms cubic-bezier\(0\.22, 1, 0\.36, 1\) backwards;\s*\}/,
  `.app-v5-identity .app-view-transition {
  min-height: 100%;
  animation: none !important;
  filter: none !important;
  transform: none !important;
}`
);

// Disable ::view-transition-old and ::view-transition-new animations
indexCssContent = indexCssContent.replace(
  /::view-transition-old\(root\) \{[\s\S]*?::view-transition-new\(root\) \{[\s\S]*?\}/,
  `::view-transition-old(root),
::view-transition-new(root) {
  animation: none !important;
}`
);

// Add high-performance optimization block to kill continuous CPU/GPU animation loops in app
const perfBlock = `
/* ==========================================================================
   PERFORMANCE: Elimina travamentos, lag e animações contínuas na aplicação
   ========================================================================== */
.app-v5-identity .app-view-transition,
.app-v5-identity .app-view-continuity {
  animation: none !important;
  filter: none !important;
  transform: none !important;
}

.app-v5-identity .dashboard-v5-hero__foliage,
.app-v5-identity .dashboard-v5-hero__foliage--canopy,
.app-v5-identity .dashboard-v5-hero__foliage--edge,
.app-v5-identity .dashboard-v5-hero__light,
.app-v5-identity .dashboard-v5-hero__embers,
.app-v5-identity .dashboard-v5-hero__energy-glow,
.app-v5-identity .dashboard-v5-hero__energy-line,
.app-v5-identity .dashboard-v5-hero [class*='foliage'],
.app-v5-identity .dashboard-v5-hero [class*='embers'],
.app-v5-identity .dashboard-v5-hero [class*='energy'] {
  animation: none !important;
  will-change: auto !important;
}

.app-v5-identity [class*='whatsapp-pulse'],
.app-v5-identity [class*='whatsapp-card-alive'],
.app-v5-identity [class*='whatsapp-icon-alive'],
.app-v5-identity [class*='whatsapp-dot-alive'],
.app-v5-identity .command-pulse__title svg,
.app-v5-identity .preceito-brasa__arc,
.app-v5-identity .preceito-brasa__core,
.app-v5-identity .preceito-brasa__signal,
.app-v5-identity .preceito-brasa__ember {
  animation: none !important;
  will-change: auto !important;
}
`;

if (!indexCssContent.includes("PERFORMANCE: Elimina travamentos")) {
  indexCssContent += perfBlock;
}

fs.writeFileSync("src/index.css", indexCssContent, "utf-8");
console.log("src/index.css patched successfully!");
