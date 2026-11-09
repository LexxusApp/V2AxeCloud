export const REMEMBER_EMAIL_KEY = 'axecloud_remember_login_email';
export const REMEMBER_EMAIL_ENABLED_KEY = 'axecloud_remember_login_email_enabled';
export const REMEMBER_MEMBER_KEY = 'axecloud_remember_login_member_id';

export function readRememberLoginPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(REMEMBER_EMAIL_ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function writeRememberLoginPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REMEMBER_EMAIL_ENABLED_KEY, String(enabled));
    if (!enabled) {
      clearRememberedLoginEmail();
      clearRememberedMemberLogin();
    }
  } catch {
    /* armazenamento indisponível */
  }
}

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

export function readRememberedMemberLogin(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = String(localStorage.getItem(REMEMBER_MEMBER_KEY) || '').trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeRememberedMemberLogin(id: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  try {
    const value = String(id || '').trim();
    if (value.length > 0) {
      localStorage.setItem(REMEMBER_MEMBER_KEY, value);
      return;
    }
    localStorage.removeItem(REMEMBER_MEMBER_KEY);
  } catch {
    /* modo privado / storage bloqueado */
  }
}

export function clearRememberedMemberLogin(): void {
  writeRememberedMemberLogin(null);
}

/** Preserva o e-mail “lembrar de mim” durante logout que faz localStorage.clear(). */
export function collectRememberedLoginEmailFromStorage(): string | null {
  return readRememberedLoginEmail();
}

export function restoreRememberedLoginEmailToStorage(email: string | null | undefined): void {
  if (!email) return;
  writeRememberedLoginEmail(email);
}

export function collectRememberedMemberLoginFromStorage(): string | null {
  return readRememberedMemberLogin();
}

export function restoreRememberedMemberLoginToStorage(id: string | null | undefined): void {
  if (!id) return;
  writeRememberedMemberLogin(id);
}
