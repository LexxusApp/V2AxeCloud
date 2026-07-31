import { useEffect, useState } from 'react';
import { authFetch } from '../lib/authenticatedFetch';

export type SubscriptionBillingCycle = 'monthly' | 'annual';

export function useSubscriptionBillingCycle(
  tenantId?: string | null,
  initialValue?: unknown,
): SubscriptionBillingCycle {
  const [billingCycle, setBillingCycle] = useState<SubscriptionBillingCycle>(
    initialValue === 'annual' ? 'annual' : 'monthly',
  );

  useEffect(() => {
    const id = String(tenantId || '').trim();
    if (!id) return;
    let cancelled = false;

    void authFetch(
      `/api/v1/checkout/efi/context?tenantId=${encodeURIComponent(id)}`,
      { cache: 'no-store' },
    )
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ billingCycle?: unknown }>;
      })
      .then((body) => {
        if (!cancelled && body) {
          setBillingCycle(body.billingCycle === 'annual' ? 'annual' : 'monthly');
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return billingCycle;
}
