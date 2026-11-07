import test from 'node:test';
import assert from 'node:assert/strict';
import { modernInterfaceEnabled } from '../src/lib/modernInterface.js';
import { beginAppOperation, pendingAppOperations, subscribeAppOperations } from '../src/lib/appOperations.js';

test('a prévia moderna não pode ser ativada em produção apenas por parâmetro', () => {
  assert.equal(modernInterfaceEnabled({ development: false, search: '?interface=modern' }), false);
  assert.equal(modernInterfaceEnabled({ development: true, search: '?interface=modern' }), true);
  assert.equal(modernInterfaceEnabled({ development: true, search: '' }), false);
  assert.equal(modernInterfaceEnabled({ development: false, released: 'true' }), true);
});
test('progresso acompanha solicitações concorrentes e finalização idempotente, sem animação de polling', () => {
  let changes = 0;
  const unsubscribe = subscribeAppOperations(() => changes++);
  const polling = beginAppOperation('GET', '/api/transactions');
  assert.equal(pendingAppOperations(), 0);
  polling();
  const first = beginAppOperation('POST', '/api/transactions');
  const second = beginAppOperation('DELETE', '/api/transactions/1');
  assert.equal(pendingAppOperations(), 2);
  first(); first();
  assert.equal(pendingAppOperations(), 1);
  second();
  assert.equal(pendingAppOperations(), 0);
  assert.equal(changes, 4);
  unsubscribe();
});
test('atualizar o próprio piloto não abre um segundo indicador de progresso', () => {
  const refresh = beginAppOperation('POST', '/api/pilot/refresh');
  assert.equal(pendingAppOperations(), 0);
  refresh();
  assert.equal(pendingAppOperations(), 0);
});
