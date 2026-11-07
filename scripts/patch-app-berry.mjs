import fs from 'node:fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
const importTarget = "const Dashboard = lazy(() => import('./views/Dashboard'));";
const newImports = "import { isBerryDashboardBeta } from './lib/featureFlags';\nconst BerryAppShell = lazy(() => import('./components/dashboard-berry/BerryAppShell'));\nconst DashboardBerry = lazy(() => import('./components/dashboard-berry/DashboardBerry'));\n" + importTarget;

if (!content.includes(importTarget)) {
  console.error('Target import not found');
  process.exit(1);
}
content = content.replace(importTarget, newImports);

// 2. Add Beta return branch
const normalized = content.replace(/\r\n/g, '\n');
const searchNorm = `  return (
    <>
    <HouseToastHost />
    <div className="app-v3 app-v4-experiment app-v5-identity`;

if (!normalized.includes(searchNorm)) {
  console.error('Search return target not found');
  process.exit(1);
}

const betaSnippet = `  const isBerryBetaUser = isBerryDashboardBeta(session?.user?.email, effectiveTenantId);

  if (isBerryBetaUser) {
    return (
      <>
        <HouseToastHost />
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#0f1411]"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>}>
          <BerryAppShell
            activeTab={activeTab}
            setActiveTab={navigateToTab}
            userRole={userRole || 'Zelador'}
            isAdmin={isAdminGlobal}
            terreiroNome={tenantData?.nome_terreiro || 'Terreiro Teste'}
            zeladorNome={tenantData?.zelador || 'Zelador'}
            onLogout={() => performFastLogout()}
          >
            <Suspense
              fallback={
                <div className="flex min-h-[60vh] items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                </div>
              }
            >
              {activeTab === 'dashboard' ? (
                <DashboardBerry
                  onNavigate={navigateToTab}
                  terreiroNome={tenantData?.nome_terreiro || 'Terreiro Teste'}
                  zeladorNome={tenantData?.zelador || 'Zelador'}
                  tenantId={effectiveTenantId}
                />
              ) : (
                <div key={\`\${activeTab}:\${selectedChildId || ''}\`} className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
                  {renderView()}
                </div>
              )}
            </Suspense>
          </BerryAppShell>
        </Suspense>
        <AppRuntimeOverlays
          showLegalTermsModal={showLegalTermsModal}
          onAcceptLegalTerms={handleAcceptLegalTerms}
          legalTermsAccepting={legalTermsAccepting}
          userRole={userRole}
          session={session}
          activeTab={activeTab}
          onNavigate={navigateToTab}
          effectiveTenantId={effectiveTenantId}
          blockingSpinnerActive={blockingSpinnerActive}
          tenantData={tenantData}
        />
      </>
    );
  }

  return (
    <>
    <HouseToastHost />
    <div className="app-v3 app-v4-experiment app-v5-identity`;

const updated = normalized.replace(searchNorm, betaSnippet);
fs.writeFileSync(filePath, updated, 'utf8');
console.log('Successfully patched src/App.tsx with Berry Beta!');
