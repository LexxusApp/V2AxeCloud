import { Suspense, lazy, useEffect } from 'react';
import { usePathname } from '../hooks/usePathname';
import { isAppSpaPath, redirectToAppDevOriginIfNeeded } from '../lib/appHref';
import { ROUTES } from '../lib/routes';
import { applyRouteSeo } from '../lib/seo';
import { parseContentArticleSlug } from '../content/portalContent';

const Landing = lazy(() => import('../views/Landing'));
const FounderProgramPage = lazy(() => import('../views/FounderProgramPage'));
const ContentHubPage = lazy(() => import('../views/ContentHubPage'));
const PortalArticlePage = lazy(() => import('../views/PortalArticlePage'));
const GlossaryPage = lazy(() => import('../views/GlossaryPage'));
const EspacoDoFielPage = lazy(() => import('../views/EspacoDoFielPage'));
const TermsPage = lazy(() => import('../pages/TermsPage'));
const PrivacyPage = lazy(() => import('../pages/PrivacyPage'));

function MarketingSectionFallback() {
  return <div aria-hidden className="min-h-[12rem] w-full" />;
}

function RoutedMarketingPage({ path }: { path: string }) {
  const articleSlug = parseContentArticleSlug(path);
  if (articleSlug) {
    return <PortalArticlePage slug={articleSlug} />;
  }

  switch (path) {
    case ROUTES.founderProgram:
      return <FounderProgramPage />;
    case ROUTES.terms:
      return <TermsPage />;
    case ROUTES.privacy:
      return <PrivacyPage />;
    case ROUTES.contentHub:
      return <ContentHubPage />;
    case ROUTES.glossary:
      return <GlossaryPage />;
    case ROUTES.espacoDoFiel:
      return <EspacoDoFielPage />;
    case ROUTES.home:
    default:
      return <Landing />;
  }
}

function MarketingAppRouteRedirect({ path }: { path: string }) {
  useEffect(() => {
    redirectToAppDevOriginIfNeeded(path);
  }, [path]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#080A0D] text-[#94A3B8]">
      <p className="text-sm">Abrindo o painel…</p>
    </div>
  );
}

/** SPA leve — só páginas de marketing (sem login, dashboard, API client pesado). */
export default function MarketingRouter() {
  const path = usePathname();

  useEffect(() => {
    applyRouteSeo(path);
  }, [path]);

  if (import.meta.env.DEV && isAppSpaPath(path)) {
    return <MarketingAppRouteRedirect path={path} />;
  }

  return (
    <Suspense fallback={<MarketingSectionFallback />}>
      <RoutedMarketingPage path={path} />
    </Suspense>
  );
}
