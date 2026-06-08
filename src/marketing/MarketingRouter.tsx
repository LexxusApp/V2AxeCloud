import { Suspense, lazy, useEffect } from 'react';
import { usePathname } from '../hooks/usePathname';
import { ROUTES } from '../lib/routes';
import { applyRouteSeo } from '../lib/seo';

const Landing = lazy(() => import('../views/Landing'));
const FounderProgramPage = lazy(() => import('../views/FounderProgramPage'));
const ContentHubPage = lazy(() => import('../views/ContentHubPage'));
const PortalArticlePage = lazy(() => import('../views/PortalArticlePage'));
const GlossaryPage = lazy(() => import('../views/GlossaryPage'));
const TermsPage = lazy(() => import('../pages/TermsPage'));
const PrivacyPage = lazy(() => import('../pages/PrivacyPage'));

function MarketingSectionFallback() {
  return <div aria-hidden className="min-h-[12rem] w-full" />;
}

function RoutedMarketingPage({ path }: { path: string }) {
  switch (path) {
    case ROUTES.founderProgram:
      return <FounderProgramPage />;
    case ROUTES.terms:
      return <TermsPage />;
    case ROUTES.privacy:
      return <PrivacyPage />;
    case ROUTES.contentHub:
      return <ContentHubPage />;
    case ROUTES.contentArticle:
      return <PortalArticlePage />;
    case ROUTES.glossary:
      return <GlossaryPage />;
    case ROUTES.home:
    default:
      return <Landing />;
  }
}

/** SPA leve — só páginas de marketing (sem login, dashboard, API client pesado). */
export default function MarketingRouter() {
  const path = usePathname();

  useEffect(() => {
    applyRouteSeo(path);
  }, [path]);

  return (
    <Suspense fallback={<MarketingSectionFallback />}>
      <RoutedMarketingPage path={path} />
    </Suspense>
  );
}
