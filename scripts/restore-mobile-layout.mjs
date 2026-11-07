import fs from 'fs';
import path from 'path';

const cwd = process.cwd();
const basePath = cwd.endsWith('AxecloudV2') ? cwd : path.join(cwd, 'AxecloudV2');
const appTsxPath = path.join(basePath, 'src/App.tsx');
const berryCssPath = path.join(basePath, 'src/components/dashboard-berry/berry-dashboard.css');

// 1. Update App.tsx
let appContent = fs.readFileSync(appTsxPath, 'utf8');

const targetApp = `  const isBerryBetaUser = isBerryDashboardBeta(session?.user?.email, effectiveTenantId);`;

const replacementApp = `  const [isDesktopScreen, setIsDesktopScreen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 880 : true));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(min-width: 880px)');
    const handleMedia = (e) => {
      setIsDesktopScreen(e.matches);
    };
    handleMedia(mql);
    mql.addEventListener('change', handleMedia);
    return () => mql.removeEventListener('change', handleMedia);
  }, []);

  const isBerryBetaUser = isDesktopScreen && isBerryDashboardBeta(session?.user?.email, effectiveTenantId);`;

if (appContent.includes(targetApp)) {
  appContent = appContent.replace(targetApp, replacementApp);
  fs.writeFileSync(appTsxPath, appContent, 'utf8');
  console.log('App.tsx updated to use native mobile layout on screens < 880px!');
} else {
  console.log('Target not found in App.tsx');
}

// 2. Fix berry-dashboard.css: remove html, body from overflow: hidden
let cssContent = fs.readFileSync(berryCssPath, 'utf8');
if (cssContent.includes('html, body, #root, .app-shell {')) {
  cssContent = cssContent.replace(
    'html, body, #root, .app-shell {',
    '.axe-berry-mode.app-shell {'
  );
  fs.writeFileSync(berryCssPath, cssContent, 'utf8');
  console.log('berry-dashboard.css updated: removed global html/body overflow:hidden!');
}
