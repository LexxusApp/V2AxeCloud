import { Suspense, lazy, useEffect } from 'react';
import { usePathname } from '../hooks/usePathname';
import { isAppSpaPath, redirectToAppDevOriginIfNeeded } from '../lib/appHref';
import { ROUTES, normalizePath } from '../lib/routes';
import { applyRouteSeo } from '../lib/seo';
import { trackPublicVisit } from '../lib/trackPublicVisit';
import { parseContentArticleSlug } from '../content/portalContent';
import { LITURGICAL_CALENDAR_PATH } from '../content/portalLiturgical';

const Landing = lazy(() => import('../views/Landing'));
const FounderProgramPage = lazy(() => import('../views/FounderProgramPage'));
const ContentHubPage = lazy(() => import('../views/ContentHubPage'));
const PortalArticlePage = lazy(() => import('../views/PortalArticlePage'));
const GlossaryPage = lazy(() => import('../views/GlossaryPage'));
const EspacoDoFielPage = lazy(() => import('../views/EspacoDoFielPage'));
const TermsPage = lazy(() => import('../pages/TermsPage'));
const PrivacyPage = lazy(() => import('../pages/PrivacyPage'));
const TerreirosDirectoryPage = lazy(() => import('../views/portal/TerreirosDirectoryPage'));
const TerreiroProfilePage = lazy(() => import('../views/portal/TerreiroProfilePage'));
const TerreirosCityPage = lazy(() => import('../views/portal/TerreirosCityPage'));
const EventosPublicPage = lazy(() => import('../views/portal/EventosPublicPage'));
const LiturgicalCalendarPage = lazy(() => import('../views/portal/LiturgicalCalendarPage'));

function MarketingSectionFallback() {
  return <div aria-hidden className="min-h-[12rem] w-full" />;
}

function parseTerreirosPath(path: string): 'directory' | { city: string } | { profile: string } | null {
  const p = normalizePath(path);
  if (p === ROUTES.terreiros) return 'directory';
  if (p.startsWith('/terreiros/cidade/')) {
    const city = p.slice('/terreiros/cidade/'.length);
    if (city) return { city: decodeURIComponent(city) };
  }
  if (p.startsWith('/terreiros/')) {
    const slug = p.slice('/terreiros/'.length);
    if (slug && slug !== 'cidade') return { profile: decodeURIComponent(slug) };
  }
  return null;
}

function RoutedMarketingPage({ path }: { path: string }) {
  const articleSlug = parseContentArticleSlug(path);
  if (articleSlug) {
    return <PortalArticlePage slug={articleSlug} />;
  }

  if (normalizePath(path) === LITURGICAL_CALENDAR_PATH) {
    return <LiturgicalCalendarPage />;
  }

  const terreiros = parseTerreirosPath(path);
  if (terreiros === 'directory') return <TerreirosDirectoryPage />;
  if (terreiros && 'city' in terreiros) return <TerreirosCityPage />;
  if (terreiros && 'profile' in terreiros) return <TerreiroProfilePage />;

  switch (normalizePath(path)) {
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
    case ROUTES.eventosPublicos:
      return <EventosPublicPage />;
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

  useEffect(() => {
    void trackPublicVisit(path);
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
