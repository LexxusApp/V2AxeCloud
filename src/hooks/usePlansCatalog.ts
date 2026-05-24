import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchPlansCatalog,
  premiumDisplayFromCatalog,
  type PlansCatalogClient,
  type PremiumDisplayPrice,
} from '../lib/plansDisplay';

type Options = {
  /** Adia fetch de /api/plans para depois do idle — melhora FCP/LCP na landing. */
  defer?: boolean;
};

export function usePlansCatalog(options?: Options) {
  const defer = options?.defer ?? false;
  const [plans, setPlans] = useState<PlansCatalogClient>({});
  const [loading, setLoading] = useState(!defer);

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
    if (!defer) {
      void refresh();
      return;
    }

    let cancelled = false;
    const run = () => {
      if (!cancelled) void refresh();
    };

    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(run, { timeout: 4000 });
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }

    const timer = window.setTimeout(run, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [defer, refresh]);

  const premium = useMemo(() => premiumDisplayFromCatalog(plans), [plans]);

  return { plans, loading, refresh, premium };
}

export type { PlansCatalogClient, PremiumDisplayPrice };
