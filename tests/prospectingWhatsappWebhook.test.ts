import test from 'node:test';
import assert from 'node:assert/strict';
import { extractStatusesFromMetaPayload } from '../cloudflare/prospect-worker/src/whatsapp/webhookHandler.js';
import { CrmService } from '../cloudflare/prospect-worker/src/services/crm/crmService.js';

test('webhook Meta extrai status e detalhe de falha', () => {
  const statuses = extractStatusesFromMetaPayload({
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          statuses: [{
            id: 'wamid.teste',
            status: 'failed',
            errors: [{
              code: 131026,
              title: 'Message undeliverable',
              error_data: { details: 'Phone number unavailable' },
            }],
          }],
        },
      }],
    }],
  });

  assert.deepEqual(statuses, [{
    externalId: 'wamid.teste',
    status: 'failed',
    errorCode: '131026',
    errorMessage: '#131026 — Message undeliverable — Phone number unavailable',
  }]);
});

test('CrmService propaga webhook para inbox, logs, entrega e linha do tempo', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; body: any }> = [];

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = String(init.method || 'GET');
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, method, body });

    if (url.includes('/whatsapp_deliveries?') && method === 'GET') {
      return new Response(JSON.stringify([{ id: 'delivery-1', status: 'accepted' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(null, { status: method === 'POST' ? 201 : 204 });
  };

  try {
    const crm = new CrmService({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    } as any);
    await crm.applyMessageStatusUpdate('wamid.teste', 'delivered');
  } finally {
    globalThis.fetch = originalFetch;
  }

  const inbox = calls.find((call) => call.url.includes('/admin_whatsapp_messages?'));
  const legacyLog = calls.find((call) => call.url.includes('/whatsapp_logs?'));
  const deliveryUpdate = calls.find((call) => call.url.includes('/whatsapp_deliveries?id='));
  const event = calls.find((call) => call.url.endsWith('/whatsapp_delivery_events'));

  assert.equal(inbox?.body.status, 'delivered');
  assert.equal(legacyLog?.body.status, 'delivered');
  assert.equal(deliveryUpdate?.body.status, 'delivered');
  assert.ok(deliveryUpdate?.body.delivered_at);
  assert.ok(deliveryUpdate?.body.last_webhook_at);
  assert.equal(event?.body.event_type, 'meta_webhook');
  assert.equal(event?.body.event_key, 'webhook:wamid.teste:delivered');
});

test('CrmService não regride uma entrega lida para enviada', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; body: any }> = [];

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = String(init.method || 'GET');
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, method, body });
    if (url.includes('/whatsapp_deliveries?') && method === 'GET') {
      return new Response(JSON.stringify([{ id: 'delivery-2', status: 'read' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(null, { status: method === 'POST' ? 201 : 204 });
  };

  try {
    const crm = new CrmService({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    } as any);
    await crm.applyMessageStatusUpdate('wamid.lido', 'sent');
  } finally {
    globalThis.fetch = originalFetch;
  }

  const deliveryUpdate = calls.find((call) => call.url.includes('/whatsapp_deliveries?id='));
  assert.equal(deliveryUpdate?.body.status, undefined);
  assert.ok(deliveryUpdate?.body.last_webhook_at);
});
