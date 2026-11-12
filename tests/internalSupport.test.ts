import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { registerAdminSupportRoutes, registerSupportRoutes } from '../api/lib/supportRoutes.js';

test('internal support preserves the thread, sends one reply alert and isolates owners', async () => {
  const owner = randomUUID(), other = randomUUID(), admin = randomUUID(), child = randomUUID();
  const users = [owner, other, admin, child].map(id => ({ id, email: id + '@example.invalid' }));
  const rows: Record<string, Record<string, any>[]> = {
    perfil_lider: [owner, other].map(id => ({ id, tenant_id: id, deleted_at: null, nome_terreiro: 'Casa QA' })),
    filhos_de_santo: [{ id: randomUUID(), user_id: child, tenant_id: owner, lider_id: owner }],
    support_tickets: [],
    support_messages: [],
  };
  function from(table: string) {
    const source = rows[table] || [];
    let matches = (_row: any) => true;
    let single = false, start = 0, end = Infinity;
    const filter = (predicate: (row: any) => boolean) => {
      const previous = matches;
      matches = row => previous(row) && predicate(row);
      return query;
    };
    const query = {
      select: () => query,
      eq: (field: string, value: unknown) => filter(row => row[field] === value),
      is: (field: string, value: unknown) => filter(row => row[field] === value),
      order: () => query,
      range: (first: number, last: number) => { start = first; end = last + 1; return query; },
      limit: (n: number) => { end = n; return query; },
      maybeSingle: () => { single = true; return query; },
      upsert: async (value: any) => {
        const now = new Date().toISOString();
        if (!source.some(row => row.id === value.id)) source.push({ status: 'open', created_at: now, updated_at: now, ...value });
        return { error: null };
      },
      then(resolve: (result: unknown) => unknown) {
        const items = (table === 'support_messages' ? source.map(row => {
          const ticket = rows.support_tickets.find(ticket => ticket.id === row.ticket_id);
          return { ...row, 'support_tickets.owner_id': ticket?.owner_id, support_tickets: { subject: ticket?.subject } };
        }) : source).filter(matches).slice(start, end);
        return Promise.resolve({ data: single ? items[0] || null : items, error: null }).then(resolve);
      },
    };
    return query;
  }
  const db = { from, auth: { getUser: async (token: string) => ({ data: { user: users.find(user => user.id === token) } }) } } as unknown as SupabaseClient;
  const app = express();
  app.use(express.json());
  registerSupportRoutes(app, { supabaseAdmin: db });
  registerAdminSupportRoutes(app, db, async (req, res) => {
    if (req.headers.authorization === 'Bearer ' + admin) return { user: users[2] as any };
    res.status(403).json({ error: 'Acesso negado' });
    return null;
  });
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const origin = 'http://localhost:' + (server.address() as AddressInfo).port;
  const support = '/api/v1/support', consolePath = '/api/admin-console/support';
  async function call(path: string, who?: string, payload?: object) {
    const response = await fetch(origin + path, {
      method: payload ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(who && { Authorization: 'Bearer ' + who }) },
      body: payload && JSON.stringify(payload),
    });
    return { status: response.status, ...await response.json() };
  }
  try {
    const ticket = { id: randomUUID(), subject: 'Acesso ao financeiro', description: 'Preciso de ajuda no financeiro.' };
    assert.equal((await call(support)).status, 401);
    assert.equal((await call(support, child, ticket)).status, 403);
    assert.equal((await call(support, owner, ticket)).status, 201);
    assert.equal((await call(support, owner, ticket)).status, 201);
    assert.equal((await call(support, owner)).tickets.length, 1);
    assert.equal((await call(support, other)).tickets.length, 0);
    assert.equal((await call(support + '/' + ticket.id, other)).status, 404);
    assert.equal((await call(consolePath, owner)).status, 403);
    assert.equal((await call(consolePath, admin)).tickets.length, 1);

    const reply = { id: randomUUID(), body: 'Confira a nova aba de comprovantes.' };
    const adminThread = consolePath + '/' + ticket.id + '/messages';
    assert.equal((await call(adminThread, admin, reply)).status, 201);
    assert.equal((await call(adminThread, admin, reply)).status, 201);
    const thread = await call(support + '/' + ticket.id, owner);
    assert.equal(thread.ticket.description, ticket.description);
    assert.equal(thread.messages.length, 1);
    assert.equal(thread.messages[0].body, reply.body);
    const alerts = (await call(support + '/notifications', owner)).data;
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].ticketId, ticket.id);
    assert.equal((await call(support + '/notifications', other)).data.length, 0);

    const continuation = await call(support + '/' + ticket.id + '/messages', owner, { id: randomUUID(), body: 'Encontrei. Obrigado!' });
    assert.equal(continuation.message.author_role, 'owner');
    assert.equal((await call(support + '/notifications', owner)).data.length, 1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
