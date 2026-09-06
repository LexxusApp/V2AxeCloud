import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGlobalSettingPayload } from '../api/lib/globalSettings';

function queryResult(result: { data: unknown; error: unknown }) {
  const calls: string[] = [];
  return {
    calls,
    select: (columns: string) => {
      calls.push(columns);
      return { eq: () => ({ maybeSingle: async () => result }) };
    },
  };
}

test('globalSettings não consulta a coluna legada quando a linha moderna não existe', async () => {
  const table = queryResult({ data: null, error: null });
  let fromCalls = 0;
  const client = { from: () => { fromCalls += 1; return table; } } as any;

  assert.equal(await loadGlobalSettingPayload(client, 'welcome_message'), null);
  assert.equal(fromCalls, 1);
  assert.deepEqual(table.calls, ['data']);
});

test('globalSettings retorna o payload salvo na coluna data', async () => {
  const payload = { enabled: true, signature: 'Equipe AxéCloud' };
  const table = queryResult({ data: { data: payload }, error: null });
  const client = { from: () => table } as any;

  assert.deepEqual(await loadGlobalSettingPayload(client, 'welcome_message'), payload);
});
