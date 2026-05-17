import { ROUTES } from './routes';

export function navigateTo(path: string, replace = false): void {
  if (typeof window === 'undefined') return;
  if (replace) {
    window.location.replace(path);
  } else {
    window.location.href = path;
  }
}

export function goToLogin(): void {
  navigateTo(ROUTES.login, true);
}

export function goToDashboard(): void {
  navigateTo(ROUTES.dashboard, true);
}

export function goToHome(): void {
  navigateTo(ROUTES.home, true);
}
