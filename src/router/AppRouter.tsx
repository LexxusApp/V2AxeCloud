import { useEffect } from 'react';
import Landing from '../views/Landing';
import Register from '../views/Register';
import Checkout from '../views/Checkout';
import LoginPage from '../pages/LoginPage';
import TermsPage from '../pages/TermsPage';
import PrivacyPage from '../pages/PrivacyPage';
import DashboardPage from '../pages/DashboardPage';
import { usePathname } from '../hooks/usePathname';
import { ROUTES } from '../lib/routes';
import { applyRouteSeo } from '../lib/seo';

/**
 * Roteador central (Vite SPA — equivalente a app/page, app/login, app/dashboard).
 */
export default function AppRouter() {
  const path = usePathname();

  useEffect(() => {
    applyRouteSeo(path);
  }, [path]);

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
    case ROUTES.dashboard:
      return <DashboardPage />;
    case ROUTES.home:
    default:
      return <Landing />;
  }
}
