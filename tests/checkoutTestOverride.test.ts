import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHECKOUT_TEST_EMAIL,
  CHECKOUT_TEST_MONTHLY_CENTS,
  checkoutTestOverrideCents,
} from '../api/lib/premiumPricing.js';

test('somente o e-mail de teste cobra R$ 15 no ciclo mensal', () => {
  assert.equal(
    checkoutTestOverrideCents({ billingCycle: 'monthly', email: CHECKOUT_TEST_EMAIL }),
    CHECKOUT_TEST_MONTHLY_CENTS,
  );
  assert.equal(CHECKOUT_TEST_MONTHLY_CENTS, 1500);
});

test('demais e-mails e o ciclo anual continuam no catálogo', () => {
  assert.equal(
    checkoutTestOverrideCents({ billingCycle: 'monthly', email: 'cliente@terreiro.com' }),
    null,
  );
  assert.equal(
    checkoutTestOverrideCents({ billingCycle: 'annual', email: CHECKOUT_TEST_EMAIL }),
    null,
  );
});
