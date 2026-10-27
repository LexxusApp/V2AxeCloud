export const FILHO_TOUR_PREF_PREFIX = 'axecloud:filho-tour-seen:v1:';
export const FILHO_TOUR_ACCOUNT_FIELD = 'filho_tour_seen_v1';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type Remote = { read: () => Promise<boolean>; markSeen: () => Promise<void> };

/** Local state survives logout; account state survives private windows and device changes. */
export function createFilhoTourPreference(userId: string, storage: StorageLike | undefined, remote: Remote) {
  const key = FILHO_TOUR_PREF_PREFIX + userId;
  let seen = false;
  let accountSaved = false;
  let pending: Promise<void> | null = null;
  try { seen = storage?.getItem(key) === '1'; } catch { /* Private/blocked storage. */ }
  const remember = () => {
    seen = true;
    try { storage?.setItem(key, '1'); } catch { /* Account remains the durable source. */ }
  };
  const sync = (): Promise<void> => {
    if (!seen || !userId || accountSaved) return Promise.resolve();
    if (pending) return pending.then(() => sync());
    pending = remote.markSeen().then(() => { accountSaved = true; }).catch(() => {
      // Keep the local marker and retry on focus/online; never reopen a seen guide.
    }).finally(() => { pending = null; });
    return pending;
  };
  return {
    markSeen() { remember(); void sync(); },
    async refresh(): Promise<boolean | null> {
      if (!userId) return null;
      if (seen) { void sync(); return true; }
      try {
        if (await remote.read()) { accountSaved = true; remember(); return true; }
        // A late remote response must not undo a manual open/skip in the meantime.
        return seen;
      } catch { return seen ? true : null; }
    },
    sync,
  };
}
