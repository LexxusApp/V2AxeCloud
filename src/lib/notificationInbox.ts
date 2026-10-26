export const INBOX_STORAGE_PREFIX = 'axecloud:notification-inbox:v1:';

export type InboxRecord = {
  notification_id: string;
  first_seen_at: string;
  read_at: string | null;
  dismissed_at: string | null;
};
export type InboxAction = { id: string; action: 'read' | 'dismiss' };
export type InboxSnapshot = {
  records: Record<string, InboxRecord>;
  pending: Record<string, InboxAction['action']>;
  syncing: boolean;
  ready: boolean;
  error: boolean;
  lastSynced: string | null;
};
export type InboxTransport = (ids: string[], actions: InboxAction[]) => Promise<InboxRecord[]>;

export function canonicalNotificationId(id: string): string {
  return id.replace(/^(gira_[0-9a-f-]{36})_.+$/i, '$1');
}

// A date alone is an agenda day, not the instant a notification was created.
// Legacy timestamps without an offset use the house's Brazilian time zone.
export function notificationInstant(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(raw)) return null;
  const zoned = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(raw) ? raw : `${raw}-03:00`;
  const timestamp = Date.parse(zoned);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function notificationDisplayDate(createdAt: unknown, firstSeen: string, now = Date.now()): string {
  const created = notificationInstant(createdAt);
  return created && Date.parse(created) <= now ? created : firstSeen;
}

export function formatNotificationDate(instant: string): string {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}

export function notificationDay(daysFromNow = 0, now = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(now + daysFromNow * 86_400_000));
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function sortNotificationDates<T extends { id: string; created_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id));
}

function earlier(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) <= Date.parse(b) ? a : b;
}

/** Monotonic state: another tab/device can never undo read or dismissed. */
export function mergeInboxRecord(a: InboxRecord | undefined, b: InboxRecord): InboxRecord {
  return {
    ...b,
    first_seen_at: earlier(a?.first_seen_at ?? null, b.first_seen_at)!,
    read_at: earlier(a?.read_at ?? null, b.read_at),
    dismissed_at: earlier(a?.dismissed_at ?? null, b.dismissed_at),
  };
}

export class NotificationInbox {
  private snapshot: InboxSnapshot;
  private listeners = new Set<() => void>();
  private ids: string[] = [];
  private running: Promise<void> | null = null;
  private rerun = false;

  constructor(
    readonly storageKey: string,
    private transport: InboxTransport,
    private storage?: Pick<Storage, 'getItem' | 'setItem'>,
    private now = () => new Date().toISOString(),
  ) {
    this.snapshot = { records: {}, pending: {}, syncing: false, ready: false, error: false, lastSynced: null };
    try {
      const saved = JSON.parse(storage?.getItem(storageKey) || '{}');
      for (const value of Object.values(saved.records || {}) as InboxRecord[]) {
        if (!value || typeof value.notification_id !== 'string' || !notificationInstant(value.first_seen_at)) continue;
        const id = canonicalNotificationId(value.notification_id);
        this.snapshot.records[id] = { notification_id: id, first_seen_at: value.first_seen_at,
          read_at: notificationInstant(value.read_at), dismissed_at: notificationInstant(value.dismissed_at) };
      }
      for (const [id, action] of Object.entries(saved.pending || {})) {
        if (action === 'read' || action === 'dismiss') this.snapshot.pending[canonicalNotificationId(id)] = action;
      }
    } catch { /* A corrupt cache must not break the inbox. */ }
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private publish(update: Partial<InboxSnapshot>) {
    this.snapshot = { ...this.snapshot, ...update };
    try { this.storage?.setItem(this.storageKey, JSON.stringify({ records: this.snapshot.records, pending: this.snapshot.pending })); }
    catch { /* Account persistence still works when browser storage is unavailable. */ }
    for (const listener of this.listeners) listener();
  }

  setItems(ids: string[]) {
    this.ids = [...new Set(ids.map(canonicalNotificationId))].slice(0, 100);
    const records = { ...this.snapshot.records };
    for (const id of this.ids) {
      records[id] ??= { notification_id: id, first_seen_at: this.now(), read_at: null, dismissed_at: null };
    }
    this.publish({ records });
  }

  importLegacy(read: Iterable<string>, dismissed: Iterable<string>) {
    this.apply([
      ...[...read].map(id => ({ id, action: 'read' as const })),
      ...[...dismissed].map(id => ({ id, action: 'dismiss' as const })),
    ], false);
  }

  private apply(actions: InboxAction[], synchronize: boolean) {
    const records = { ...this.snapshot.records };
    const pending = { ...this.snapshot.pending };
    let changed = false;
    for (const action of actions) {
      const id = canonicalNotificationId(action.id);
      const old = records[id] || { notification_id: id, first_seen_at: this.now(), read_at: null, dismissed_at: null };
      if (action.action === 'dismiss' ? old.dismissed_at : old.read_at) continue;
      const timestamp = this.now();
      records[id] = { ...old, read_at: old.read_at || timestamp,
        dismissed_at: action.action === 'dismiss' ? timestamp : old.dismissed_at };
      pending[id] = action.action === 'dismiss' || pending[id] === 'dismiss' ? 'dismiss' : 'read';
      changed = true;
    }
    if (changed) {
      this.publish({ records, pending });
      if (synchronize) void this.sync();
    }
  }

  markRead(ids: string[]) { this.apply(ids.map(id => ({ id, action: 'read' })), true); }
  dismiss(id: string) { this.apply([{ id, action: 'dismiss' }], true); }

  sync = (): Promise<void> => {
    if (this.running) { this.rerun = true; return this.running; }
    this.running = this.performSync().finally(() => {
      this.running = null;
      if (this.rerun) { this.rerun = false; void this.sync(); }
    });
    return this.running;
  };

  private async performSync() {
    const sent = { ...this.snapshot.pending };
    this.publish({ syncing: true });
    try {
      const remote = await this.transport(this.ids, Object.entries(sent).map(([id, action]) => ({ id, action })));
      const records = { ...this.snapshot.records };
      for (const row of remote) {
        const id = canonicalNotificationId(row.notification_id);
        const merged = mergeInboxRecord(records[id], { ...row, notification_id: id });
        // The server owns the discovery time, so different devices display the same fallback.
        records[id] = { ...merged, first_seen_at: row.first_seen_at };
      }
      const pending = { ...this.snapshot.pending };
      for (const [id, action] of Object.entries(sent)) {
        const acknowledged = remote.find(row => canonicalNotificationId(row.notification_id) === id);
        if (pending[id] === action && (action === 'dismiss' ? acknowledged?.dismissed_at : acknowledged?.read_at)) delete pending[id];
      }
      this.publish({ records, pending, syncing: false, ready: true, error: false, lastSynced: this.now() });
    } catch {
      this.publish({ syncing: false, ready: true, error: true });
    }
  }
}
