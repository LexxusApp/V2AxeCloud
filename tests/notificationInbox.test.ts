import assert from 'node:assert/strict';
import test from 'node:test';
import { collectClientUiPrefsFromStorage, restoreClientUiPrefsToStorage } from '../src/lib/notificationPrefs.ts';
import {
  NotificationInbox, canonicalNotificationId, notificationDisplayDate, notificationInstant,
  notificationDay, formatNotificationDate, sortNotificationDates, mergeInboxRecord,
  type InboxRecord, type InboxTransport,
} from '../src/lib/notificationInbox.ts';

const instant = '2026-10-25T22:34:00.000Z';
const later = '2026-10-25T23:34:00.000Z';
const now = () => instant;
class MemoryStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}
function server() {
  const rows = new Map<string, InboxRecord>();
  const transport: InboxTransport = async (ids, actions) => {
    for (const id of [...ids, ...actions.map(action => action.id)]) {
      if (!rows.has(id)) rows.set(id, { notification_id: id, first_seen_at: instant, read_at: null, dismissed_at: null });
    }
    for (const action of actions) {
      const row = rows.get(action.id)!;
      row.read_at ||= instant;
      if (action.action === 'dismiss') row.dismissed_at ||= instant;
    }
    return [...rows.values()].map(row => ({ ...row }));
  };
  return { rows, transport };
}

test('data futura da agenda nunca aparece como data de criação', () => {
  assert.equal(notificationDisplayDate('2026-10-31T20:00:00-03:00', instant, Date.parse(instant)), instant);
  assert.equal(notificationDisplayDate('2026-10-31', instant), instant);
  assert.equal(notificationDisplayDate('inválida', instant), instant);
});
test('timestamps com UTC e sem fuso são interpretados explicitamente', () => {
  assert.equal(notificationInstant('2026-10-25T19:34:00'), instant);
  assert.equal(notificationInstant('2026-10-25T22:34:00Z'), instant);
  assert.equal(notificationInstant('2026-10-25'), null);
});
test('data e hora são exibidas em Brasília, independente do fuso do aparelho', () => {
  assert.match(formatNotificationDate(instant), /25\/10\/2026.*19:34/);
  assert.equal(notificationDay(0, Date.parse('2026-10-26T01:00:00Z')), '2026-10-25');
  assert.equal(notificationDay(1, Date.parse('2026-10-26T01:00:00Z')), '2026-10-26');
});
test('ordem é cronológica, estável e não muda ao ler', () => {
  const items = [{ id: 'z', created_at: instant, read: false }, { id: 'b', created_at: later, read: true }, { id: 'a', created_at: later, read: false }];
  assert.deepEqual(sortNotificationDates(items).map(item => item.id), ['a', 'b', 'z']);
  assert.deepEqual(sortNotificationDates(items.map(item => ({ ...item, read: !item.read }))).map(item => item.id), ['a', 'b', 'z']);
});
test('a primeira visualização permanece estável depois de recarregar', () => {
  const storage = new MemoryStorage();
  const first = new NotificationInbox('user:house', async () => [], storage, now);
  first.setItems(['trial']);
  const second = new NotificationInbox('user:house', async () => [], storage, () => later);
  second.setItems(['trial']);
  assert.equal(second.getSnapshot().records.trial.first_seen_at, instant);
  assert.equal(second.getSnapshot().records.trial.read_at, null);
});
test('remover no celular permanece removido no computador e após novo login', async () => {
  const remote = server();
  const phone = new NotificationInbox('phone', remote.transport, new MemoryStorage(), now);
  phone.setItems(['gira']);
  phone.dismiss('gira');
  await phone.sync();
  const desktop = new NotificationInbox('desktop', remote.transport, new MemoryStorage(), () => later);
  desktop.setItems(['gira']);
  await desktop.sync();
  assert.equal(desktop.getSnapshot().records.gira.dismissed_at, instant);
  assert.equal(desktop.getSnapshot().records.gira.first_seen_at, instant);
  assert.deepEqual(phone.getSnapshot().pending, {});
});
test('ler em outro aparelho sincroniza sem remover o aviso', async () => {
  const remote = server();
  const phone = new NotificationInbox('phone', remote.transport, undefined, now);
  phone.setItems(['payment']); phone.markRead(['payment']); await phone.sync();
  const desktop = new NotificationInbox('desktop', remote.transport, undefined, now);
  await desktop.sync();
  assert.equal(desktop.getSnapshot().records.payment.read_at, instant);
  assert.equal(desktop.getSnapshot().records.payment.dismissed_at, null);
});
test('offline preserva alterações e reenvia ao reconectar', async () => {
  const remote = server(); let online = false;
  const storage = new MemoryStorage();
  const inbox = new NotificationInbox('scope', async (...args) => { if (!online) throw new Error('offline'); return remote.transport(...args); }, storage, now);
  inbox.setItems(['a']); inbox.dismiss('a'); await inbox.sync();
  assert.equal(inbox.getSnapshot().error, true);
  assert.equal(inbox.getSnapshot().pending.a, 'dismiss');
  online = true; await inbox.sync();
  assert.equal(inbox.getSnapshot().error, false);
  assert.deepEqual(inbox.getSnapshot().pending, {});
  const reloaded = new NotificationInbox('scope', remote.transport, storage, now);
  assert.equal(reloaded.getSnapshot().records.a.dismissed_at, instant);
});
test('resposta antiga de sincronização não desfaz leitura ou remoção local', async () => {
  let resolve!: (rows: InboxRecord[]) => void;
  let calls = 0;
  const remote = server();
  const inbox = new NotificationInbox('scope', async (ids, actions) => {
    if (++calls === 1) return new Promise(done => { resolve = done; });
    return remote.transport(ids, actions);
  }, undefined, now);
  inbox.setItems(['a']); const request = inbox.sync(); inbox.dismiss('a');
  resolve([{ notification_id: 'a', first_seen_at: instant, read_at: null, dismissed_at: null }]);
  await request; await inbox.sync();
  assert.equal(inbox.getSnapshot().records.a.dismissed_at, instant);
});
test('marcar todas afeta só os IDs recebidos e mantém removidas removidas', async () => {
  const remote = server(); const inbox = new NotificationInbox('scope', remote.transport, undefined, now);
  inbox.setItems(['a', 'b', 'c']); inbox.dismiss('b'); inbox.markRead(['a', 'c']); await inbox.sync();
  assert.ok(Object.values(inbox.getSnapshot().records).every(row => row.read_at));
  assert.equal(inbox.getSnapshot().records.b.dismissed_at, instant);
});
test('cache separado por conta e terreiro, sem importar chave global de outro usuário', () => {
  const storage = new MemoryStorage();
  const a = new NotificationInbox('user-a:house-a', async () => [], storage, now);
  a.importLegacy(['x'], ['y']);
  const b = new NotificationInbox('user-b:house-a', async () => [], storage, now);
  const c = new NotificationInbox('user-a:house-b', async () => [], storage, now);
  assert.deepEqual(b.getSnapshot().records, {}); assert.deepEqual(c.getSnapshot().records, {});
});
test('IDs antigos de gira convergem e não recriam o mesmo aviso', () => {
  const id = 'gira_12345678-1234-1234-1234-123456789012';
  assert.equal(canonicalNotificationId(`${id}_2026-10-31`), id);
  const inbox = new NotificationInbox('scope', async () => [], undefined, now);
  inbox.importLegacy([], [`${id}_2026-10-31`]); inbox.setItems([id]);
  assert.ok(inbox.getSnapshot().records[id].dismissed_at);
  assert.equal(Object.keys(inbox.getSnapshot().records).length, 1);
});
test('estados lidos/removidos são monotônicos ao mesclar aparelhos', () => {
  const old = { notification_id: 'a', first_seen_at: instant, read_at: instant, dismissed_at: instant };
  const incoming = { ...old, first_seen_at: later, read_at: null, dismissed_at: null };
  assert.deepEqual(mergeInboxRecord(old, incoming), old);
});
test('cache inválido e storage indisponível não impedem salvar na conta', async () => {
  const remote = server();
  const inbox = new NotificationInbox('scope', remote.transport, { getItem: () => '{', setItem: () => { throw new Error('blocked'); } }, now);
  inbox.setItems(['a']); inbox.markRead(['a']); await inbox.sync();
  assert.equal(inbox.getSnapshot().error, false);
  assert.ok(remote.rows.get('a')?.read_at);
});

test('logout preserva a fila de notificações sem preservar tokens de sessão', () => {
  const descriptors = [Object.getOwnPropertyDescriptor(globalThis, 'window'), Object.getOwnPropertyDescriptor(globalThis, 'localStorage')];
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    const key = 'axecloud:notification-inbox:v1:user:house';
    storage.setItem(key, '{"pending":{"a":"dismiss"}}');
    storage.setItem('sb-session', 'private-session');
    const preferences = collectClientUiPrefsFromStorage();
    storage.data.clear(); restoreClientUiPrefsToStorage(preferences);
    assert.equal(storage.getItem(key), '{"pending":{"a":"dismiss"}}');
    assert.equal(storage.getItem('sb-session'), null);
  } finally {
    ['window', 'localStorage'].forEach((key, index) => {
      if (descriptors[index]) Object.defineProperty(globalThis, key, descriptors[index]!);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
});
