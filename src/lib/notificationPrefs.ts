/**
 * Preferências do sino de notificações (lidas / descartadas).
 * Só existem no cliente — precisam sobreviver a localStorage.clear() no logout.
 */

export const NOTIF_READ_KEY = 'axecloud_notif_read_v2';
export const NOTIF_DISMISS_KEY = 'axecloud_notif_dismissed_v2';
export const OBRIGACOES_SEEN_PREFIX = 'axecloud_obrigacoes_seen_';

const SET_CAP = 400;

function scopedKey(base: string, userId?: string | null): string {
  const uid = String(userId || '').trim();
  return uid ? `${base}:${uid}` : base;
}

export function notifReadStorageKey(userId?: string | null): string {
  return scopedKey(NOTIF_READ_KEY, userId);
}

export function notifDismissStorageKey(userId?: string | null): string {
  return scopedKey(NOTIF_DISMISS_KEY, userId);
}

export function loadNotifIdSet(storageKey: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function saveNotifIdSet(storageKey: string, values: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify([...values].slice(-SET_CAP)));
  } catch {
    /* storage indisponível */
  }
}

/** Junta chave legada (global) com a chave por usuário na primeira carga. */
export function loadNotifIdSetForUser(
  baseKey: typeof NOTIF_READ_KEY | typeof NOTIF_DISMISS_KEY,
  userId?: string | null,
): Set<string> {
  const scoped = loadNotifIdSet(scopedKey(baseKey, userId));
  if (!userId) return scoped.size ? scoped : loadNotifIdSet(baseKey);

  const legacy = loadNotifIdSet(baseKey);
  if (!legacy.size) return scoped;
  if (!scoped.size) {
    const migrated = new Set(legacy);
    saveNotifIdSet(scopedKey(baseKey, userId), migrated);
    return migrated;
  }
  const merged = new Set([...scoped, ...legacy]);
  saveNotifIdSet(scopedKey(baseKey, userId), merged);
  return merged;
}

function isPreservedUiPrefKey(key: string): boolean {
  return (
    key === NOTIF_READ_KEY ||
    key === NOTIF_DISMISS_KEY ||
    key.startsWith(`${NOTIF_READ_KEY}:`) ||
    key.startsWith(`${NOTIF_DISMISS_KEY}:`) ||
    key.startsWith(OBRIGACOES_SEEN_PREFIX)
  );
}

/** Snapshot das prefs de UI que devem sobreviver a logout / session-expired. */
export function collectClientUiPrefsFromStorage(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !isPreservedUiPrefKey(key)) continue;
      const value = localStorage.getItem(key);
      if (value != null) out[key] = value;
    }
  } catch {
    /* storage bloqueado */
  }
  return out;
}

export function restoreClientUiPrefsToStorage(prefs: Record<string, string> | null | undefined): void {
  if (typeof window === 'undefined' || !prefs) return;
  try {
    for (const [key, value] of Object.entries(prefs)) {
      if (!isPreservedUiPrefKey(key)) continue;
      localStorage.setItem(key, value);
    }
  } catch {
    /* storage bloqueado */
  }
}
