import { Suspense, lazy, useEffect, useRef } from 'react';
import { RouteLoadingFallback } from '../app/routeLoading';
import { usePathname } from '../hooks/usePathname';
import { isMarketingSitePath, ROUTES } from '../lib/routes';
import { purgeLegacyAppServiceWorker } from '../lib/purgeServiceWorker';
import { applyRouteSeo } from '../lib/seo';

const Register = lazy(() => import('../views/Register'));
const Checkout = lazy(() => import('../views/Checkout'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const ConsulentePortalPage = lazy(() => import('../views/ConsulentePortalPage'));
const EventRsvpPage = lazy(() => import('../views/EventRsvpPage'));

const HOME_FIX_KEY = 'axecloud_marketing_sw_fixup';

function AppNotFound({ path }: { path: string }) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current || typeof window === 'undefined') return;
    started.current = true;

    const target = isMarketingSitePath(path) ? path : ROUTES.home;

    if (sessionStorage.getItem(HOME_FIX_KEY) === target) {
      return;
    }
    sessionStorage.setItem(HOME_FIX_KEY, target);

    void purgeLegacyAppServiceWorker().finally(() => {
      const bust = `_swfix=${Date.now()}`;
      const join = target.includes('?') ? '&' : '?';
      window.location.replace(`${target}${join}${bust}`);
    });
  }, [path]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-950 text-neutral-400">
      <p className="text-sm">Abrindo o site…</p>
    </div>
  );
}

function RoutedPage({ path }: { path: string }) {
  if (path.startsWith('/consulente/') && path.length > '/consulente/'.length) {
    return <ConsulentePortalPage />;
  }

  if (path.startsWith('/convite/') && path.length > '/convite/'.length) {
    return <EventRsvpPage />;
  }

  switch (path) {
    case ROUTES.register:
      return <Register />;
    case ROUTES.checkout:
      return <Checkout />;
    case ROUTES.login:
      return <LoginPage />;
    case ROUTES.dashboard:
      return <DashboardPage />;
    default:
      return <AppNotFound path={path} />;
  }
}

/**
 * SPA do app (login, cadastro, painel) — marketing em site separado (landing-dist).
 */
export default function AppRouter() {
  const path = usePathname();

  useEffect(() => {
    applyRouteSeo(path);
  }, [path]);

  return (
    <Suspense fallback={<RouteLoadingFallback path={path} />}>
      <RoutedPage path={path} />
    </Suspense>
  );
}
