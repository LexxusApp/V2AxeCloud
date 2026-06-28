import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { RouteLoadingFallback } from '../app/routeLoading';
import { usePathname } from '../hooks/usePathname';
import { redirectToMarketingDevOriginIfNeeded } from '../lib/appHref';
import {
  MARKETING_REDIRECT_ATTEMPTS_KEY,
  escapeAppBundleOnMarketingUrl,
} from '../lib/marketingDocumentGuard';
import { isMarketingSitePath, ROUTES } from '../lib/routes';
import { purgeLegacyAppServiceWorker } from '../lib/purgeServiceWorker';
import { cleanBrowserUrl } from '../lib/urlHygiene';
import { applyRouteSeo } from '../lib/seo';
import { trackPublicVisit } from '../lib/trackPublicVisit';
import LoginPage from '../pages/LoginPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';

const Register = lazy(() => import('../views/Register'));
const Checkout = lazy(() => import('../views/Checkout'));
const SubscriptionRenewCheckout = lazy(() => import('../views/SubscriptionRenewCheckout'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const ConsulentePortalPage = lazy(() => import('../views/ConsulentePortalPage'));
const EventRsvpPage = lazy(() => import('../views/EventRsvpPage'));
const GiraCheckInPage = lazy(() => import('../views/GiraCheckInPage'));
const GiraSenhasPublicPage = lazy(() => import('../views/GiraSenhasPublicPage'));
const PortalWidgetPage = lazy(() => import('../views/portal/PortalWidgetPage'));

function AppNotFound({ path }: { path: string }) {
  const started = useRef(false);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (started.current || typeof window === 'undefined') return;
    started.current = true;

    if (import.meta.env.DEV && redirectToMarketingDevOriginIfNeeded(path)) {
      return;
    }

    const target = isMarketingSitePath(path) ? path : ROUTES.home;
    const attempts = parseInt(sessionStorage.getItem(MARKETING_REDIRECT_ATTEMPTS_KEY) || '0', 10);

    if (attempts >= 3) {
      setStuck(true);
      return;
    }

    void (async () => {
      const escaped = await escapeAppBundleOnMarketingUrl();
      if (escaped) return;

      await purgeLegacyAppServiceWorker();
      cleanBrowserUrl();
      window.location.replace(target);
    })();
  }, [path]);

  if (stuck) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-center text-neutral-400">
        <p className="text-sm">Não foi possível abrir a página automaticamente.</p>
        <a
          href={ROUTES.home}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-black hover:opacity-90"
        >
          Ir para o início
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-950 text-neutral-400">
      <p className="text-sm">Abrindo o site…</p>
    </div>
  );
}

function RoutedPage({ path }: { path: string }) {
  if (path.startsWith('/widget/') && path.length > '/widget/'.length) {
    return <PortalWidgetPage />;
  }

  if (path.startsWith('/consulente/') && path.length > '/consulente/'.length) {
    return <ConsulentePortalPage />;
  }

  if (path.startsWith('/convite/') && path.length > '/convite/'.length) {
    return <EventRsvpPage />;
  }

  if (path.startsWith('/checkin/') && path.length > '/checkin/'.length) {
    return <GiraCheckInPage />;
  }

  if (path.startsWith('/senhas/') && path.length > '/senhas/'.length) {
    return <GiraSenhasPublicPage />;
  }

  switch (path) {
    case ROUTES.register:
      return <Register />;
    case ROUTES.checkout:
      return <Checkout />;
    case ROUTES.renewSubscription:
      return <SubscriptionRenewCheckout />;
    case ROUTES.login:
    case ROUTES.loginLegacy:
      return <LoginPage />;
    case ROUTES.resetPassword:
      return <ResetPasswordPage />;
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
    if (path === ROUTES.loginLegacy) {
      const qs = typeof window !== 'undefined' ? window.location.search : '';
      window.history.replaceState({}, document.title, `${ROUTES.login}${qs}`);
    }
  }, [path]);

  useEffect(() => {
    applyRouteSeo(path === ROUTES.loginLegacy ? ROUTES.login : path);
  }, [path]);

  useEffect(() => {
    void trackPublicVisit(path);
  }, [path]);

  return (
    <Suspense fallback={<RouteLoadingFallback path={path} />}>
      <RoutedPage path={path} />
    </Suspense>
  );
}
