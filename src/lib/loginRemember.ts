const REMEMBER_EMAIL_KEY = 'axecloud_remember_login_email';

export function readRememberedLoginEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = String(localStorage.getItem(REMEMBER_EMAIL_KEY) || '').trim();
    return value.includes('@') ? value : null;
  } catch {
    return null;
  }
}

export function writeRememberedLoginEmail(email: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  try {
    const value = String(email || '').trim();
    if (value.includes('@')) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, value);
      return;
    }
    localStorage.removeItem(REMEMBER_EMAIL_KEY);
  } catch {
    /* modo privado / storage bloqueado */
  }
}

export function clearRememberedLoginEmail(): void {
  writeRememberedLoginEmail(null);
}

/** Preserva o e-mail “lembrar de mim” durante logout que faz localStorage.clear(). */
export function collectRememberedLoginEmailFromStorage(): string | null {
  return readRememberedLoginEmail();
}

export function restoreRememberedLoginEmailToStorage(email: string | null | undefined): void {
  if (!email) return;
  writeRememberedLoginEmail(email);
}
