import { premiumDisplayFromCatalog } from '../lib/plansDisplay';

/** Fallback estático só até /api/plans responder — preferir usePlansCatalog() ou fetchPlansCatalog(). */
export const LANDING_PRICE = premiumDisplayFromCatalog({});
