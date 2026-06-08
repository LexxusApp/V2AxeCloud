import { Suspense, lazy, useEffect } from 'react';
import { RouteLoadingFallback } from '../app/routeLoading';
import { usePathname } from '../hooks/usePathname';
import { ROUTES } from '../lib/routes';
import { applyRouteSeo } from '../lib/seo';
const Register = lazy(() => import('../views/Register'));
const Checkout = lazy(() => import('../views/Checkout'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const ConsulentePortalPage = lazy(() => import('../views/ConsulentePortalPage'));
const EventRsvpPage = lazy(() => import('../views/EventRsvpPage'));

function AppNotFound() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.replace(ROUTES.home);
    }
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-950 text-neutral-400">
      <p className="text-sm">Redirecionando…</p>
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
      return <AppNotFound />;
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
