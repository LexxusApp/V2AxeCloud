import assert from 'node:assert/strict';
import test from 'node:test';
import { ritualPromotionMetrics } from '../cloudflare/ritual-promotion-metrics.js';

const request = (days = 30) => new Request(`https://admin.axecloud.com.br/api/admin-console/ritual-promotions?days=${days}`, { headers: { Authorization: 'Bearer admin-test-session' } });
const env = { API: { fetch: async () => Response.json({ user: { id: 'admin' } }) }, SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-only-test-key' };

test('métricas exigem sessão admin antes de consultar contagens', async () => {
  let queried = false;
  const database = async () => { queried = true; return new Response(); };
  const anonymous = await ritualPromotionMetrics(new Request(request().url), env, database);
  assert.equal(anonymous.status, 401);
  const forbidden = await ritualPromotionMetrics(request(), { ...env, API: { fetch: async () => new Response(null, { status: 403 }) } }, database);
  assert.equal(forbidden.status, 403);
  const unavailable = await ritualPromotionMetrics(request(), { ...env, API: { fetch: async () => new Response(null, { status: 500 }) } }, database);
  assert.equal(unavailable.status, 503);
  assert.equal(queried, false);
});

test('consulta contagens exatas por ritual e período, distinguindo visualizações do diretório', async () => {
  const calls: URL[] = [];
  const response = await ritualPromotionMetrics(request(7), env, async (input: URL, init: RequestInit) => {
    assert.equal(init.method, 'HEAD');
    const url = new URL(input);
    calls.push(url);
    const total = url.searchParams.get('cta_id') === 'eq.ritual_promotion_whatsapp' ? 3 : 12;
    return new Response(null, { headers: { 'Content-Range': `*/${total}` } });
  });
  const body = await response.json();
  assert.equal(body.days, 7);
  assert.equal(body.rows.length, 2);
  assert.equal(calls.length, 6);
  assert.ok(calls.every((url) => url.searchParams.has('created_at') && url.searchParams.has('metadata->>promotionId')));
  assert.ok(calls.filter((url) => url.searchParams.get('cta_id') === 'eq.ritual_promotion_view').every((url) => url.searchParams.get('metadata->>surface') === 'eq.directory'));
  assert.equal(body.rows[0].impressions, 12);
  assert.equal(body.rows[0].whatsappClicks, 3);
  assert.doesNotMatch(JSON.stringify(body), /server-only-test-key|visitor_id|admin-test-session/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('falha na contagem não aparece como resultado zero', async () => {
  const response = await ritualPromotionMetrics(request(), env, async () => new Response(null, { status: 500 }));
  assert.equal(response.status, 503);
  assert.ok((await response.json()).error);
});
