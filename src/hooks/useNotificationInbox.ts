import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';
import { INBOX_STORAGE_PREFIX, NotificationInbox, type InboxRecord } from '../lib/notificationInbox';
import { loadNotifIdSet, notifReadStorageKey, notifDismissStorageKey } from '../lib/notificationPrefs';

const stores = new Map<string, NotificationInbox>();
const idle = new NotificationInbox('idle', async () => []);

export function useNotificationInbox(userId?: string | null, tenantId?: string | null) {
  const store = useMemo(() => {
    if (!userId || !tenantId) return idle;
    const key = `${INBOX_STORAGE_PREFIX}${userId}:${tenantId}`;
    if (!stores.has(key)) {
      let storage: Storage | undefined;
      try { storage = localStorage; } catch { /* Storage may be blocked. */ }
      const inbox = new NotificationInbox(key, async (ids, actions) => {
        const { data, error } = await supabase.rpc('sync_notification_inbox', {
          p_tenant_id: tenantId, p_ids: ids, p_actions: actions,
        });
        if (error) throw error;
        return (data || []) as InboxRecord[];
      }, storage);
      // Import only this account's keys; the old global mirror mixed different users.
      inbox.importLegacy(loadNotifIdSet(notifReadStorageKey(userId)), loadNotifIdSet(notifDismissStorageKey(userId)));
      stores.set(key, inbox);
    }
    return stores.get(key)!;
  }, [userId, tenantId]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => {
    if (store === idle) return;
    void store.sync();
    const interval = window.setInterval(() => void store.sync(), 60_000);
    const sync = () => { if (document.visibilityState === 'visible') void store.sync(); };
    window.addEventListener('focus', sync);
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', sync);
      window.removeEventListener('online', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [store]);

  return { store, snapshot };
}
