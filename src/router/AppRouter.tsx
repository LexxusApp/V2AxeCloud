import Landing from '../views/Landing';
import Register from '../views/Register';
import Checkout from '../views/Checkout';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import { ROUTES, normalizePath } from '../lib/routes';

/**
 * Roteador central (Vite SPA — equivalente a app/page, app/login, app/dashboard).
 */
export default function AppRouter() {
  const path = normalizePath(window.location.pathname);

  switch (path) {
    case ROUTES.register:
      return <Register />;
    case ROUTES.checkout:
      return <Checkout />;
    case ROUTES.login:
      return <LoginPage />;
    case ROUTES.dashboard:
      return <DashboardPage />;
    case ROUTES.home:
    default:
      return <Landing />;
  }
}
