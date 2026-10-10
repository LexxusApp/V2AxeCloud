import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHECKOUT_TEST_EMAILS,
  CHECKOUT_TEST_MONTHLY_CENTS,
  checkoutTestOverrideCents,
} from '../api/lib/premiumPricing.js';

test('somente as contas de teste usam R$ 6 no ciclo mensal', () => {
  const testEmail = [...CHECKOUT_TEST_EMAILS][0];
  assert.equal(
    checkoutTestOverrideCents({ billingCycle: 'monthly', email: testEmail }),
    CHECKOUT_TEST_MONTHLY_CENTS,
  );
  assert.equal(CHECKOUT_TEST_MONTHLY_CENTS, 600);
});

test('demais e-mails e o ciclo anual continuam no catálogo', () => {
  assert.equal(
    checkoutTestOverrideCents({ billingCycle: 'monthly', email: 'cliente@terreiro.com' }),
    null,
  );
  assert.equal(
    checkoutTestOverrideCents({ billingCycle: 'annual', email: [...CHECKOUT_TEST_EMAILS][0] }),
    null,
  );
});
