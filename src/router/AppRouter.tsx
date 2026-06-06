import { Suspense, lazy, useEffect } from 'react';
import { usePathname } from '../hooks/usePathname';
import { ROUTES } from '../lib/routes';
import { applyRouteSeo } from '../lib/seo';
import Loading from '../app/loading';

const Landing = lazy(() => import('../views/Landing'));
const Register = lazy(() => import('../views/Register'));
const Checkout = lazy(() => import('../views/Checkout'));
const FounderProgramPage = lazy(() => import('../views/FounderProgramPage'));
const ContentHubPage = lazy(() => import('../views/ContentHubPage'));
const PortalArticlePage = lazy(() => import('../views/PortalArticlePage'));
const GlossaryPage = lazy(() => import('../views/GlossaryPage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const TermsPage = lazy(() => import('../pages/TermsPage'));
const PrivacyPage = lazy(() => import('../pages/PrivacyPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const ConsulentePortalPage = lazy(() => import('../views/ConsulentePortalPage'));

function RoutedPage({ path }: { path: string }) {
  if (path.startsWith('/consulente/') && path.length > '/consulente/'.length) {
    return <ConsulentePortalPage />;
  }

  switch (path) {
    case ROUTES.register:
      return <Register />;
    case ROUTES.checkout:
      return <Checkout />;
    case ROUTES.login:
      return <LoginPage />;
    case ROUTES.terms:
      return <TermsPage />;
    case ROUTES.privacy:
      return <PrivacyPage />;
    case ROUTES.founderProgram:
      return <FounderProgramPage />;
    case ROUTES.contentHub:
      return <ContentHubPage />;
    case ROUTES.contentArticle:
      return <PortalArticlePage />;
    case ROUTES.glossary:
      return <GlossaryPage />;
    case ROUTES.dashboard:
      return <DashboardPage />;
    case ROUTES.home:
    default:
      return <Landing />;
  }
}

/**
 * Roteador central (Vite SPA — equivalente a app/page, app/login, app/dashboard).
 * `Suspense` + `src/app/loading.tsx` evitam flash de HTML sem estilo entre rotas.
 */
export default function AppRouter() {
  const path = usePathname();

  useEffect(() => {
    applyRouteSeo(path);
  }, [path]);

  return (
    <Suspense fallback={<Loading />}>
      <RoutedPage path={path} />
    </Suspense>
  );
}
