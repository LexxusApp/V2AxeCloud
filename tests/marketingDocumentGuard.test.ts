import assert from 'node:assert/strict';
import test from 'node:test';

import { isMarketingDocumentPath } from '../src/lib/marketingDocumentGuard';

test('cadastro hospedado pelo app não é tratado como documento externo de marketing', () => {
  assert.equal(isMarketingDocumentPath('/register'), false);
  assert.equal(isMarketingDocumentPath('/register/'), false);
  assert.equal(isMarketingDocumentPath('/terreiros'), true);
  assert.equal(isMarketingDocumentPath('/dashboard'), false);
});
