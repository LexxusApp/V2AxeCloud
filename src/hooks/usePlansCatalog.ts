import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchPlansCatalog,
  premiumDisplayFromCatalog,
  type PlansCatalogClient,
  type PremiumDisplayPrice,
} from '../lib/plansDisplay';

export function usePlansCatalog() {
  const [plans, setPlans] = useState<PlansCatalogClient>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const catalog = await fetchPlansCatalog();
      setPlans(catalog);
    } catch {
      setPlans({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const premium = useMemo(() => premiumDisplayFromCatalog(plans), [plans]);

  return { plans, loading, refresh, premium };
}

export type { PlansCatalogClient, PremiumDisplayPrice };
