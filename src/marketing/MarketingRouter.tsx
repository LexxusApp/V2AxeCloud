import { Suspense, lazy, startTransition, useEffect, useState } from 'react';
import { MatrizTopNav } from '../components/marketing/MatrizTopNav';
import { usePathname } from '../hooks/usePathname';
import { appHref, isAppSpaPath, redirectToAppDevOriginIfNeeded } from '../lib/appHref';
import {
  installMarketingClientNavigation,
  prefetchMarketingRoute,
} from '../lib/marketingNavigation';
import { ROUTES, isMarketingHostedAppPath, normalizePath } from '../lib/routes';
import { isValidDiretorioUf } from '../lib/diretorioSlug';
import { applyRouteSeo } from '../lib/seo';
import { trackGaPageView } from '../components/GoogleAnalytics';
import { trackPublicVisit } from '../lib/trackPublicVisit';
import { parseContentArticleSlug } from '../content/portalContent';
import { getFeaturePageBySlug, parseFeaturePageSlug } from '../constants/featurePagesContent';
import { getCommercialPageByPath } from '../constants/commercialPagesContent';
import { LITURGICAL_CALENDAR_PATH } from '../content/portalLiturgical';

const ContentHubPage = lazy(() => import('../views/ContentHubPage'));
const PortalArticlePage = lazy(() => import('../views/PortalArticlePage'));
const GlossaryPage = lazy(() => import('../views/GlossaryPage'));
const EspacoDoFielPage = lazy(() => import('../views/EspacoDoFielPage'));
const TermsPage = lazy(() => import('../pages/TermsPage'));
const PrivacyPage = lazy(() => import('../pages/PrivacyPage'));
const TerreirosDirectoryPage = lazy(() => import('../views/portal/TerreirosDirectoryPage'));
const DiretorioCityPage = lazy(() => import('../views/portal/DiretorioCityPage'));
const DiretorioTerreiroPage = lazy(() => import('../views/portal/DiretorioTerreiroPage'));
const EventosPublicPage = lazy(() => import('../views/portal/EventosPublicPage'));
const EventoPublicPage = lazy(() => import('../views/portal/EventoPublicPage'));
const LiturgicalCalendarPage = lazy(() => import('../views/portal/LiturgicalCalendarPage'));
const PorQueAxeCloudPage = lazy(() => import('../views/PorQueAxeCloudPage'));
const VsPlanilhasPage = lazy(() => import('../views/VsPlanilhasPage'));
const FeatureHubPage = lazy(() => import('../views/FeatureHubPage'));
const FeaturePage = lazy(() => import('../views/FeaturePage'));
const CommercialAcquisitionPage = lazy(() => import('../views/CommercialAcquisitionPage'));
const Register = lazy(() => import('../views/Register'));

function scheduleIdle(fn: () => void) {
  if (typeof window === 'undefined') return;
  const ric = window.requestIdleCallback?.bind(window);
  if (ric) {
    ric(() => fn(), { timeout: 1200 });
    return;
  }
  window.setTimeout(fn, 120);
}

function MarketingSectionFallback() {
  return (
    <div
      aria-hidden
      className="landing-v3 landing-mockup-theme min-h-dvh w-full bg-[#fdf8f0]"
    >
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-32 md:px-8 md:pt-36">
        <div className="h-3 w-28 animate-pulse rounded-full bg-[#e8dfd0]" />
        <div className="mt-6 h-10 w-3/4 max-w-xl animate-pulse rounded-2xl bg-[#e8dfd0]/80" />
        <div className="mt-4 h-4 w-full max-w-lg animate-pulse rounded-full bg-[#e8dfd0]/60" />
        <div className="mt-3 h-4 w-5/6 max-w-md animate-pulse rounded-full bg-[#e8dfd0]/50" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="h-40 animate-pulse rounded-[1.5rem] border border-[#e8dfd0] bg-white/70" />
          <div className="h-40 animate-pulse rounded-[1.5rem] border border-[#e8dfd0] bg-white/70" />
        </div>
      </div>
    </div>
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

function PublicDocumentRedirect({ to }: { to: string }) {
  useEffect(() => {
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current !== to) window.location.replace(to);
  }, [to]);

  return <div className="min-h-dvh w-full bg-[#f7f0e4]" aria-hidden />;
}

function RoutedMarketingPage({ path }: { path: string }) {
  const commercialPage = getCommercialPageByPath(path);
  if (commercialPage) return <CommercialAcquisitionPage page={commercialPage} />;

  const articleSlug = parseContentArticleSlug(path);
  if (articleSlug) {
    return <PortalArticlePage slug={articleSlug} />;
  }

  const featureSlug = parseFeaturePageSlug(path);
  if (featureSlug) {
    const page = getFeaturePageBySlug(featureSlug);
    if (page) return <FeaturePage page={page} />;
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
  if (terreiros && 'city' in terreiros) {
    return <PublicDocumentRedirect to={`${ROUTES.terreiros}?cidade=${encodeURIComponent(terreiros.city)}`} />;
  }
  if (terreiros && 'profile' in terreiros) {
    return <PublicDocumentRedirect to={`${ROUTES.diretorioTerreiro}/${encodeURIComponent(terreiros.profile)}`} />;
  }

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
    case ROUTES.whyVsPlanilhas:
      return <VsPlanilhasPage />;
    case ROUTES.recursos:
      return <FeatureHubPage />;
    case ROUTES.register:
      return <Register />;
    default:
      return <PublicDocumentRedirect to={ROUTES.home} />;
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
  /** Path de conteúdo em transição — nav e SEO usam `path` imediato. */
  const [displayPath, setDisplayPath] = useState(path);
  const hideTopNav = isMarketingHostedAppPath(path);

  useEffect(() => installMarketingClientNavigation(), []);

  useEffect(() => {
    startTransition(() => setDisplayPath(path));
  }, [path]);

  useEffect(() => {
    applyRouteSeo(path);
    scheduleIdle(() => {
      trackGaPageView(path);
      void trackPublicVisit(path);
    });
  }, [path]);

  useEffect(() => {
    scheduleIdle(() => {
      prefetchMarketingRoute(ROUTES.whyAxeCloud);
      prefetchMarketingRoute(ROUTES.recursos);
      prefetchMarketingRoute(ROUTES.contentHub);
      prefetchMarketingRoute(ROUTES.terreiros);
      prefetchMarketingRoute(ROUTES.systemForTerreiros);
    });
  }, []);

  if (import.meta.env.DEV && isAppSpaPath(path) && !isMarketingHostedAppPath(path)) {
    return <MarketingAppRouteRedirect path={path} />;
  }

  const pending = displayPath !== path;

  return (
    <>
      {!hideTopNav ? <MatrizTopNav /> : null}
      <div
        className={pending ? 'pointer-events-none opacity-[0.92] transition-opacity duration-150' : 'transition-opacity duration-150'}
      >
        <Suspense fallback={<MarketingSectionFallback />}>
          <RoutedMarketingPage path={displayPath} />
        </Suspense>
      </div>
    </>
  );
}
