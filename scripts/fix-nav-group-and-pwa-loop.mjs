import fs from 'fs';

// -------------------------------------------------------------
// 1. FIX NAV-GROUP-HEADER in berry-dashboard.css
// -------------------------------------------------------------
const berryCssPath = 'src/components/dashboard-berry/berry-dashboard.css';
let berryCss = fs.readFileSync(berryCssPath, 'utf-8');

// Replace .nav-group-header
const correctNavGroupHeader = `.nav-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 14px;
  border-radius: var(--radius-inner);
  color: #a4aba0;
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.33;
  letter-spacing: normal;
  background: transparent;
  border: 0;
  cursor: pointer;
  transition: all 180ms ease;
  white-space: nowrap;
  text-align: left;
}`;

berryCss = berryCss.replace(/\.nav-group-header\s*\{[^}]*\}/s, correctNavGroupHeader);

const correctNavGroupTitle = `.nav-group-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  font-size: 14px;
  font-weight: 400;
}`;

berryCss = berryCss.replace(/\.nav-group-title\s*\{[^}]*\}/s, correctNavGroupTitle);

fs.writeFileSync(berryCssPath, berryCss, 'utf-8');
console.log('✓ 1. berry-dashboard.css: .nav-group-header e .nav-group-title corrigidos!');

// -------------------------------------------------------------
// 2. STOP PWA UPDATE BANNER AND POLLING ON LOCALHOST
// -------------------------------------------------------------
// In PwaUpdateBanner.tsx:
const pwaBannerPath = 'src/components/PwaUpdateBanner.tsx';
let pwaBannerCode = fs.readFileSync(pwaBannerPath, 'utf-8');

const localhostCheckFn = `function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.includes('localhost');
}`;

if (!pwaBannerCode.includes('function isLocalhost()')) {
  pwaBannerCode = localhostCheckFn + '\n\n' + pwaBannerCode;
}

pwaBannerCode = pwaBannerCode.replace(
  /function shouldShowBanner\(\): boolean \{[^}]*\}/s,
  `function shouldShowBanner(): boolean {
  if (isLocalhost()) return false;
  const remote = getPendingRemoteBuildId();
  return (
    !shouldSuppressPwaUpdatePrompt(remote) &&
    isPwaUpdateAvailable() &&
    !isDismissedRecently()
  );
}`
);

// Also guard the useEffects inside PwaUpdateBanner
pwaBannerCode = pwaBannerCode.replace(
  /void checkRemoteBuildVersion\(\)\.then\(\(found\) => \{/g,
  `if (isLocalhost()) return;\n    void checkRemoteBuildVersion().then((found) => {`
);

fs.writeFileSync(pwaBannerPath, pwaBannerCode, 'utf-8');
console.log('✓ 2. PwaUpdateBanner.tsx: suprimido em localhost!');

// In buildVersionPoll.ts:
const pollPath = 'src/lib/buildVersionPoll.ts';
let pollCode = fs.readFileSync(pollPath, 'utf-8');

if (!pollCode.includes('function isLocalhost()')) {
  pollCode = localhostCheckFn + '\n\n' + pollCode;
}

pollCode = pollCode.replace(
  /export function startBuildVersionPolling\(\): void \{[^}]*\}/s,
  `export function startBuildVersionPolling(): void {
  if (import.meta.env.DEV || isLocalhost()) return;

  const probe = () => void signalAppUpdateIfNeeded();

  void probe();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void probe();
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) void probe();
  });

  window.addEventListener('focus', () => void probe());

  window.setInterval(() => {
    if (document.visibilityState === 'visible') void probe();
  }, 25_000);
}`
);

fs.writeFileSync(pollPath, pollCode, 'utf-8');
console.log('✓ 3. buildVersionPoll.ts: polling desativado em localhost!');

// In main.tsx:
const mainPath = 'src/main.tsx';
let mainCode = fs.readFileSync(mainPath, 'utf-8');

mainCode = mainCode.replace(
  /function bootstrapApp\(\) \{[\s\S]*?const rootEl = document\.getElementById\('root'\);/,
  `function bootstrapApp() {
  const isLocal = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0' ||
    window.location.hostname.includes('localhost')
  );

  if (import.meta.env.PROD && isCanonicalAppOrigin() && !isLocal) {
    reconcileStaleAppliedBuild();
    initPwaInstallController();
    registerProductionServiceWorker();
  } else if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        void registration.unregister();
      }
    });
  }

  const rootEl = document.getElementById('root');`
);

// Also in main.tsx where startBuildVersionPolling is called:
mainCode = mainCode.replace(
  /if \(import\.meta\.env\.PROD && isCanonicalAppOrigin\(\)\) \{\s*startBuildVersionPolling\(\);\s*\}/,
  `if (import.meta.env.PROD && isCanonicalAppOrigin() && !isLocal) {
    startBuildVersionPolling();
  }`
);

fs.writeFileSync(mainPath, mainCode, 'utf-8');
console.log('✓ 4. main.tsx: service worker e polling local desativados!');
