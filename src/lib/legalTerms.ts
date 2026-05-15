import { CURRENT_LEGAL_TERMS_VERSION } from '../config/legal';

const STORAGE_PREFIX = 'axecloud_legal_accepted_';

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
