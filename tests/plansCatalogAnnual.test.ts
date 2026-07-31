import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeBillingCycle,
  normalizePlansCatalog,
  premiumEntryToAnnualAmountCents,
} from '../api/lib/plansCatalog.js';

test('plano anual usa o preço explícito do catálogo', () => {
  const catalog = normalizePlansCatalog({
    premium: {
      name: 'Premium',
      price: 69.9,
      annual_price: 699,
      annual_price_cents: 69900,
      description: 'Completo',
    },
  });

  assert.equal(premiumEntryToAnnualAmountCents(catalog.premium), 69900);
});

test('plano anual equivale a dez mensalidades quando não há preço anual', () => {
  assert.equal(
    premiumEntryToAnnualAmountCents({
      name: 'Premium',
      price: 69.9,
      description: 'Completo',
    }),
    69900,
  );
});

test('ciclo desconhecido falha de forma segura para mensal', () => {
  assert.equal(normalizeBillingCycle('annual'), 'annual');
  assert.equal(normalizeBillingCycle('qualquer-coisa'), 'monthly');
});
