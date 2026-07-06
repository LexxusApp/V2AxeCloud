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

export function goToResetPassword(): void {
  navigateTo(ROUTES.resetPassword, true);
}

export function goToForgotPassword(email?: string): void {
  const trimmed = String(email || '').trim();
  const path = trimmed
    ? `${ROUTES.forgotPassword}?email=${encodeURIComponent(trimmed)}`
    : ROUTES.forgotPassword;
  navigateTo(path, false);
}

export function goToDashboard(): void {
  navigateTo(ROUTES.dashboard, true);
}

export function goToHome(): void {
  navigateTo(ROUTES.home, true);
}
