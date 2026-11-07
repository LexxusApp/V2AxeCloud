import { supabase } from '../../../src/lib/supabase';
import { request, scoped, previewSession } from './session';
import { registerLoader, publishValue, readValue } from './runtime';
import { subscriptionFromServer, type LiveSubscription } from '../subscription';

registerLoader('subscription', async () => {
  const session = previewSession();
  const [result, context, monthly, annual] = await Promise.all([
    supabase.from('subscriptions').select('*').eq('id', session.tenantId).single(),
    request(scoped('/api/v1/checkout/efi/context')),
    request(scoped('/api/v1/checkout/efi/config?billingCycle=monthly')),
    request(scoped('/api/v1/checkout/efi/config?billingCycle=annual')),
  ]);
  if (result.error) throw result.error;
  publishValue('subscription', subscriptionFromServer(session.tenantId, result.data, context, monthly, annual, session.profile));
});

export async function checkSubscriptionPix(): Promise<{ paid: boolean; status: string }> {
  const subscription = readValue<LiveSubscription>('subscription');
  if (!subscription?.pixTxid || subscription.tenantId !== previewSession().tenantId) throw new Error('Não há cobrança Pix desta casa para consultar.');
  const result = await request(scoped(`/api/v1/checkout/efi/pix/${encodeURIComponent(subscription.pixTxid)}/status`));
  if (typeof result.paid !== 'boolean' || typeof result.status !== 'string') throw new Error('O provedor não confirmou a situação do pagamento. Tente consultar novamente.');
  return { paid: result.paid, status: result.status };
}
