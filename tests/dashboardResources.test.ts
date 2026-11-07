import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDashboardLoaders, dashboardResourceKey, dashboardSWRConfig,
  type DashboardScope,
} from '../src/lib/dashboardResources.ts';

const scope: DashboardScope = { tenantId: 'tenant-a', userId: 'user-a', userRole: 'admin' };
const response = (body: unknown, status = 200) => Response.json(body, { status });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
function loaders(authFetch: (url: string, init?: RequestInit) => Promise<Response>, extra = {}) {
  return createDashboardLoaders({
    authFetch,
    profile: async () => ({ data: null, error: null }),
    confirmations: async () => ({}),
    whatsappStatus: async () => true,
    ...extra,
  });
}

test('agenda e financeiro são entregues com Radar e WhatsApp ainda pendentes', async () => {
  const radar = deferred<Response>();
  const whatsapp = deferred<boolean>();
  let radarReady = false;
  let whatsappReady = false;
  const load = loaders(async (url) => url.includes('directory-profile') ? radar.promise
    : response({ data: url.includes('transactions') ? [{ id: 'tx', valor: '120.50' }] : [{ id: 'gira' }] }),
  { whatsappStatus: () => whatsapp.promise });
  const radarResult = load.radar(scope).then((value) => { radarReady = true; return value; });
  const whatsappResult = load.whatsappConnected(scope).then((value) => { whatsappReady = true; return value; });
  assert.deepEqual(await load.events(scope), [{ id: 'gira' }]);
  assert.equal((await load.transactions(scope))[0].valor, 120.5);
  assert.equal(radarReady, false);
  assert.equal(whatsappReady, false);
  radar.resolve(response({ claimed: false }));
  whatsapp.resolve(false);
  await Promise.all([radarResult, whatsappResult]);
});

test('falhas não são convertidas em lista vazia ou em total financeiro zero', async () => {
  const load = loaders(async () => response({ error: 'Falha' }, 503));
  await assert.rejects(load.children(scope), /503/);
  await assert.rejects(load.transactions(scope), /503/);
  const empty = loaders(async () => response({ data: [] }));
  assert.deepEqual(await empty.children(scope), []);
  const malformed = loaders(async () => response({ unexpected: true }));
  await assert.rejects(malformed.transactions(scope), /inválida/);
});

test('falha do perfil é isolada e conserva a diferença de perfil ausente', async () => {
  const load = loaders(async () => response({ data: [{ id: 'member' }] }), {
    profile: async () => ({ data: null, error: new Error('perfil indisponível') }),
  });
  await assert.rejects(load.profile(scope), /perfil indisponível/);
  assert.equal((await load.children(scope)).length, 1);
  assert.equal(await loaders(async () => response({})).profile(scope), null);
});

test('cache separa recurso, tenant, usuário e papel; não preserva dados da chave anterior', () => {
  const key = dashboardResourceKey('children', scope);
  assert.notDeepEqual(key, dashboardResourceKey('events', scope));
  assert.notDeepEqual(key, dashboardResourceKey('children', { ...scope, tenantId: 'tenant-b' }));
  assert.notDeepEqual(key, dashboardResourceKey('children', { ...scope, userId: 'user-b' }));
  assert.notDeepEqual(key, dashboardResourceKey('children', { ...scope, userRole: 'filho' }));
  assert.equal(dashboardResourceKey('children'), null);
  assert.equal(dashboardResourceKey('children', { ...scope, tenantId: '' }), null);
  assert.equal(dashboardSWRConfig.keepPreviousData, false);
});

test('endpoints conservam escopo, limite financeiro e filtragem de membros ativos', async () => {
  const requests: URL[] = [];
  const load = loaders(async (url) => {
    requests.push(new URL(url, 'https://example.test'));
    return response({ data: [{ status: 'Ativo' }, { status: 'active' }, { status: 'Inativo' }, { status: null }] });
  });
  const encodedScope = { ...scope, tenantId: 'tenant&other=x', userId: 'user?other=x' };
  assert.equal((await load.children(encodedScope)).length, 3);
  await load.transactions(encodedScope);
  assert.equal(requests[0].searchParams.get('tenantId'), encodedScope.tenantId);
  assert.equal(requests[0].searchParams.get('userId'), encodedScope.userId);
  assert.equal(requests[0].searchParams.has('other'), false);
  assert.equal(requests[1].searchParams.get('limit'), '400');
});
