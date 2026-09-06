import assert from 'node:assert/strict';
import test from 'node:test';

import { hasPlanAccess } from '../src/constants/plans.ts';

test('biblioteca permanece disponível independentemente do plano', () => {
  assert.equal(hasPlanAccess(undefined, 'library'), true);
  assert.equal(hasPlanAccess('premium', 'library'), true);
  assert.equal(hasPlanAccess('free', 'library'), true);
  assert.equal(hasPlanAccess('plano-legado', 'library'), true);
});
