import test from 'node:test';
import assert from 'node:assert/strict';
import { friendlyPaymentStatus, subscriptionFromServer, subscriptionCheckoutPath } from '../design-systems/menu-local-20261029/subscription';

const tenant = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed';
const row = { id: tenant, plan: 'premium', expires_at: '2026-11-22T02:30:00Z', billing_cycle: 'monthly', status: 'active' };
const context = { tenantId: tenant, active: true, subscriptionStatus: 'active', billingCycle: 'monthly' };
const monthly = { amountCents: 600, pixAvailable: true, cardAvailable: false, sandbox: false };
const annual = { amountCents: 6000, pixAvailable: true, cardAvailable: false, sandbox: false };
const model = (changes = {}, ctx = {}, profile = {}) => subscriptionFromServer(tenant, { ...row, ...changes }, { ...context, ...ctx }, monthly, annual, profile);

test('uses official account-specific prices, server access and São Paulo expiry without demo invoices', () => {
  const state = model({}, { active: false }, { is_trial: true });
  assert.equal(state.pricing.monthly.cents, 600);
  assert.equal(state.pricing.annual.cents, 6000);
  assert.equal(state.until, '2026-11-21');
  assert.equal(state.active, false);
  assert.equal(state.trial, true);
  assert.deepEqual(state.records, []);
});
test('rejects a subscription or context belonging to another house', () => {
  assert.throws(() => model({ id: 'other-house' }), /não pertence/);
  assert.throws(() => model({}, { tenantId: 'other-house' }), /não pertence/);
});
test('rejects missing, zero, fractional and invalid prices instead of inventing a charge', () => {
  for (const value of [undefined, null, 0, -1, NaN, Infinity, 69.9, '600']) assert.throws(() => subscriptionFromServer(tenant, row, context, { ...monthly, amountCents: value }, annual));
});
test('monthly and annual renewal use the existing official route and tenant, without a client-supplied amount', () => {
  assert.equal(subscriptionCheckoutPath(model(), 'monthly'), `/assinatura/renovar?tenant=${tenant}&billing=monthly`);
  assert.equal(subscriptionCheckoutPath(model(), 'annual'), `/assinatura/renovar?tenant=${tenant}&billing=annual`);
});
test('permanent plans and unavailable payment methods cannot start renewal', () => {
  assert.throws(() => subscriptionCheckoutPath(model({ plan: 'cortesia' }), 'monthly'), /não exige/);
  const disabled = subscriptionFromServer(tenant, row, context, { ...monthly, pixAvailable: false }, annual);
  assert.throws(() => subscriptionCheckoutPath(disabled, 'monthly'), /indisponível/);
  assert.match(subscriptionCheckoutPath(disabled, 'annual'), /billing=annual$/);
});
test('an active subscription alone never implies that a new charge was paid', () => {
  const state = model({ efi_pix_txid: 'new-charge', efi_charge_id: 'pix:new-charge', last_activated_charge_id: 'pix:previous-charge', pending_billing_cycle: 'annual' });
  assert.equal(state.records.length, 2);
  assert.equal(state.records[0].confirmed, false);
  assert.equal(state.records[0].cycle, 'annual');
  assert.equal(state.records[1].confirmed, true);
  assert.equal(state.records[1].cycle, null);
  assert.ok(state.records.every(record => !('cents' in record)));
});
test('the same confirmed Pix is shown once and removes a stale trial flag', () => {
  const state = model({ efi_pix_txid: 'one-charge', efi_charge_id: 'pix:one-charge', last_activated_charge_id: 'one-charge' }, {}, { is_trial: true });
  assert.equal(state.records.length, 1);
  assert.equal(state.records[0].confirmed, true);
  assert.equal(state.trial, false);
});
test('provider sandbox is preserved explicitly instead of being presented as production payment', () => {
  const state = subscriptionFromServer(tenant, row, context, { ...monthly, sandbox: true }, annual);
  assert.equal(state.pricing.monthly.sandbox, true);
  assert.equal(state.pricing.annual.sandbox, false);
});
test('payment provider statuses are translated into clear labels for the manager', () => {
  assert.equal(friendlyPaymentStatus('CONCLUIDA'), 'pagamento confirmado');
  assert.equal(friendlyPaymentStatus('ATIVA'), 'aguardando pagamento');
  assert.equal(friendlyPaymentStatus('CANCELADA'), 'cobrança encerrada');
  assert.equal(friendlyPaymentStatus('unknown-provider-state'), 'em análise');
});
