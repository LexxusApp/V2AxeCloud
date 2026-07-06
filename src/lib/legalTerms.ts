import { CURRENT_LEGAL_TERMS_VERSION } from '../config/legal';

export const LEGAL_ACCEPTANCE_STORAGE_PREFIX = 'axecloud_legal_accepted_';

const STORAGE_PREFIX = LEGAL_ACCEPTANCE_STORAGE_PREFIX;

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function readLocalLegalAcceptance(userId: string | null | undefined): string | null {
  if (!userId) return null;
  try {
    const v = localStorage.getItem(storageKey(userId));
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function writeLocalLegalAcceptance(userId: string, version: string = CURRENT_LEGAL_TERMS_VERSION) {
  try {
    localStorage.setItem(storageKey(userId), version);
  } catch {
    // no-op
  }
}

export function hasAcceptedLegalTerms(
  userId: string | null | undefined,
  serverVersion?: string | null
): boolean {
  if (!userId) return false;
  const v = String(serverVersion || '').trim();
  if (v === CURRENT_LEGAL_TERMS_VERSION) return true;
  return readLocalLegalAcceptance(userId) === CURRENT_LEGAL_TERMS_VERSION;
}

/** Preserva aceites de termos ao limpar storage no logout (performFastLogout). */
export function collectLegalAcceptanceFromStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof window === 'undefined') return out;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(LEGAL_ACCEPTANCE_STORAGE_PREFIX)) continue;
      const value = localStorage.getItem(key);
      if (value) out[key] = value;
    }
  } catch {
    // no-op
  }
  return out;
}

export function restoreLegalAcceptanceToStorage(saved: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    for (const [key, value] of Object.entries(saved)) {
      localStorage.setItem(key, value);
    }
  } catch {
    // no-op
  }
}
