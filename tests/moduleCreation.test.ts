import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consumeModuleCreation, requestModuleCreation } from '../src/lib/moduleCreation';
const scope = { userId: 'gestor-a', tenantId: 'casa-a' };
test('atalho abre somente o formulário escolhido, uma vez, na mesma conta e casa', () => {
  requestModuleCreation(scope, 'financial', 1000);
  assert.equal(consumeModuleCreation(scope, 'calendar', 1001), false);
  assert.equal(consumeModuleCreation(scope, 'financial', 1002), true);
  assert.equal(consumeModuleCreation(scope, 'financial', 1003), false);
  requestModuleCreation(scope, 'calendar', 1000);
  assert.equal(consumeModuleCreation({ ...scope, tenantId: 'outra-casa' }, 'calendar', 1001), false);
  assert.equal(consumeModuleCreation(scope, 'calendar', 1002), false);
});
test('pedido expirado ou de outra conta não reaparece em uma navegação posterior', () => {
  requestModuleCreation(scope, 'financial', 1000);
  assert.equal(consumeModuleCreation(scope, 'financial', 61000), false);
  requestModuleCreation(scope, 'calendar', 1000);
  assert.equal(consumeModuleCreation({ ...scope, userId: 'outro-gestor' }, 'calendar', 1001), false);
  assert.equal(consumeModuleCreation(scope, 'calendar', 1002), false);
});
