import { canonicalPlanSlug, isLifetimePlan, PLAN_NAMES } from '../../src/constants/plans';
import { parseSubscriptionExpiryYmd } from '../../src/lib/subscriptionDue';

export type SubscriptionCycle = 'monthly' | 'annual';
export type SubscriptionPrice = { cents: number; available: boolean; pixAvailable: boolean; sandbox: boolean };
export type SubscriptionRecord = { id: string; confirmed: boolean; cycle: SubscriptionCycle | null; method: string };
export type LiveSubscription = {
  tenantId: string; plan: string; planName: string; cycle: SubscriptionCycle;
  until: string; active: boolean; trial: boolean; lifetime: boolean; status: string;
  updatedAt: string; recurring: boolean; pixTxid: string | null;
  pricing: Record<SubscriptionCycle, SubscriptionPrice>; records: SubscriptionRecord[];
};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export function friendlyPaymentStatus(value: unknown): string {
  const status = text(value).toLowerCase();
  if (/conclu|paid|approved|settled|confirm/.test(status)) return 'pagamento confirmado';
  if (/expir|cancel|remov|refund|devol/.test(status)) return 'cobrança encerrada';
  if (/wait|pend|active|ativa|open|new|nova/.test(status)) return 'aguardando pagamento';
  return 'em análise';
}
function price(config: Record<string, unknown>): SubscriptionPrice {
  if (!Number.isSafeInteger(config.amountCents) || Number(config.amountCents) <= 0) throw new Error('O serviço não confirmou o valor da assinatura. Atualize antes de continuar.');
  return { cents: Number(config.amountCents), available: config.pixAvailable === true || config.cardAvailable === true, pixAvailable: config.pixAvailable === true, sandbox: config.sandbox === true };
}
export function subscriptionFromServer(tenantId: string, row: Record<string, unknown>, context: Record<string, unknown>, monthly: Record<string, unknown>, annual: Record<string, unknown>, profile: Record<string, unknown> = {}): LiveSubscription {
  if (!tenantId || !row || !context || row.id !== tenantId || context.tenantId !== tenantId) throw new Error('A assinatura não pertence à casa desta sessão.');
  const plan = text(row.plan) || text(profile.plan) || 'premium';
  const cycle = context.billingCycle === 'annual' ? 'annual' : 'monthly';
  const confirmedId = text(row.last_activated_charge_id);
  const pixTxid = text(row.efi_pix_txid) || null;
  const currentId = text(row.efi_charge_id) || (pixTxid ? `pix:${pixTxid}` : '');
  const currentCycle = row.pending_billing_cycle === 'annual' ? 'annual' : row.pending_billing_cycle === 'monthly' ? 'monthly' : cycle;
  const normalize = (id: string) => id.replace(/^pix:/, '');
  const method = (id: string) => id.startsWith('pix:') || id === pixTxid ? 'Pix' : /card/.test(text(row.payment_provider)) ? 'Cartão' : 'Provedor de pagamento';
  const records: SubscriptionRecord[] = [];
  if (currentId) records.push({ id: currentId, confirmed: !!confirmedId && normalize(currentId) === normalize(confirmedId), cycle: currentCycle, method: method(currentId) });
  if (confirmedId && !records.some(record => normalize(record.id) === normalize(confirmedId))) records.push({ id: confirmedId, confirmed: true, cycle: null, method: method(confirmedId) });
  return {
    tenantId, plan, planName: PLAN_NAMES[canonicalPlanSlug(plan)] || plan,
    cycle, until: parseSubscriptionExpiryYmd(text(row.expires_at)) || '',
    active: context.active === true, trial: profile.is_trial === true && !confirmedId,
    lifetime: isLifetimePlan(plan), status: text(context.subscriptionStatus) || text(row.status),
    updatedAt: text(row.updated_at), recurring: !!text(row.efi_subscription_id), pixTxid,
    pricing: { monthly: price(monthly), annual: price(annual) }, records,
  };
}
export function subscriptionCheckoutPath(state: LiveSubscription, cycle: SubscriptionCycle): string {
  if (state.lifetime) throw new Error('Este plano não exige renovação.');
  if (cycle !== 'monthly' && cycle !== 'annual') throw new Error('Selecione um ciclo válido.');
  if (!state.pricing[cycle].available) throw new Error('O pagamento está indisponível no momento. Tente novamente mais tarde.');
  // The existing /assinatura/renovar document owns payment collection and confirmation.
  // Avoid importing the public route catalogue (and its marketing content) into the dashboard.
  return `/assinatura/renovar?${new URLSearchParams({ tenant: state.tenantId, billing: cycle })}`;
}
