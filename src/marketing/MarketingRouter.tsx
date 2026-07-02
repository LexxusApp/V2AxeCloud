import { Suspense, lazy, useEffect } from 'react';
import { LandingTopNav } from '../components/marketing/MarketingTopNav';
import { usePathname } from '../hooks/usePathname';
import { appHref, isAppSpaPath, redirectToAppDevOriginIfNeeded } from '../lib/appHref';
import { installMarketingClientNavigation } from '../lib/marketingNavigation';
import { ROUTES, normalizePath } from '../lib/routes';
import { isValidDiretorioUf } from '../lib/diretorioSlug';
import { applyRouteSeo } from '../lib/seo';
import { trackPublicVisit } from '../lib/trackPublicVisit';
import { parseContentArticleSlug } from '../content/portalContent';
import { LITURGICAL_CALENDAR_PATH } from '../content/portalLiturgical';

const Landing = lazy(() => import('../views/Landing'));
const ContentHubPage = lazy(() => import('../views/ContentHubPage'));
const PortalArticlePage = lazy(() => import('../views/PortalArticlePage'));
const GlossaryPage = lazy(() => import('../views/GlossaryPage'));
const EspacoDoFielPage = lazy(() => import('../views/EspacoDoFielPage'));
const TermsPage = lazy(() => import('../pages/TermsPage'));
const PrivacyPage = lazy(() => import('../pages/PrivacyPage'));
const TerreirosDirectoryPage = lazy(() => import('../views/portal/TerreirosDirectoryPage'));
const TerreiroProfilePage = lazy(() => import('../views/portal/TerreiroProfilePage'));
const TerreirosCityPage = lazy(() => import('../views/portal/TerreirosCityPage'));
const DiretorioCityPage = lazy(() => import('../views/portal/DiretorioCityPage'));
const DiretorioTerreiroPage = lazy(() => import('../views/portal/DiretorioTerreiroPage'));
const EventosPublicPage = lazy(() => import('../views/portal/EventosPublicPage'));
const EventoPublicPage = lazy(() => import('../views/portal/EventoPublicPage'));
const LiturgicalCalendarPage = lazy(() => import('../views/portal/LiturgicalCalendarPage'));
const PorQueAxeCloudPage = lazy(() => import('../views/PorQueAxeCloudPage'));

function MarketingSectionFallback() {
  return (
    <div
      aria-hidden
      className="landing-v3 landing-mockup-theme min-h-[50vh] w-full bg-[#fdf8f0]"
    />
  );
}

function parseDiretorioTerreiroPath(path: string): string | null {
  const p = normalizePath(path);
  if (!p.startsWith(`${ROUTES.diretorioTerreiro}/`)) return null;
  const slug = p.slice(`${ROUTES.diretorioTerreiro}/`.length);
  return slug ? decodeURIComponent(slug) : null;
}

function parseDiretorioCityPath(path: string): { estado: string; cidade: string } | null {
  const p = normalizePath(path);
  if (!p.startsWith(`${ROUTES.terreiros}/`)) return null;
  const rest = p.slice(`${ROUTES.terreiros}/`.length);
  if (rest.startsWith('cidade/')) return null;
  const parts = rest.split('/').filter(Boolean);
  if (parts.length === 2 && /^[a-z]{2}$/i.test(parts[0]) && isValidDiretorioUf(parts[0])) {
    return { estado: parts[0].toLowerCase(), cidade: decodeURIComponent(parts[1]) };
  }
  return null;
}

function parseEventoPublicPath(path: string): string | null {
  const p = normalizePath(path);
  if (!p.startsWith(`${ROUTES.eventoPublico}/`)) return null;
  const token = p.slice(`${ROUTES.eventoPublico}/`.length);
  return token ? decodeURIComponent(token) : null;
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

function ProgramaFundadorRedirect() {
  useEffect(() => {
    window.location.replace(appHref(ROUTES.register));
  }, []);
  return (
    <div className="landing-v3 landing-mockup-theme min-h-[50vh] w-full bg-[#fdf8f0]" aria-hidden />
  );
}

function RoutedMarketingPage({ path }: { path: string }) {
  const articleSlug = parseContentArticleSlug(path);
  if (articleSlug) {
    return <PortalArticlePage slug={articleSlug} />;
  }

  if (normalizePath(path) === LITURGICAL_CALENDAR_PATH) {
    return <LiturgicalCalendarPage />;
  }

  const diretorioSlug = parseDiretorioTerreiroPath(path);
  if (diretorioSlug) return <DiretorioTerreiroPage />;

  const diretorioCity = parseDiretorioCityPath(path);
  if (diretorioCity) return <DiretorioCityPage />;

  const eventoToken = parseEventoPublicPath(path);
  if (eventoToken) return <EventoPublicPage />;

  const terreiros = parseTerreirosPath(path);
  if (terreiros === 'directory') return <TerreirosDirectoryPage />;
  if (terreiros && 'city' in terreiros) return <TerreirosCityPage />;
  if (terreiros && 'profile' in terreiros) return <TerreiroProfilePage />;

  switch (normalizePath(path)) {
    case ROUTES.founderProgram:
      return <ProgramaFundadorRedirect />;
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
    case ROUTES.whyAxeCloud:
      return <PorQueAxeCloudPage />;
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

  useEffect(() => installMarketingClientNavigation(), []);

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
    <>
      <LandingTopNav />
      <Suspense fallback={<MarketingSectionFallback />}>
        <RoutedMarketingPage path={path} />
      </Suspense>
    </>
  );
}
