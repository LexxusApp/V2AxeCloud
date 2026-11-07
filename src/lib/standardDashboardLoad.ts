import { canUseLegacyDashboard, fetchDashboardCore } from './dashboardCoreClient';
import type { DashboardScope } from './dashboardResources';

/** Missing routes permit rollback compatibility; denied/failed reads never become empty totals. */
export async function loadStandardDashboardCore(
  scope: DashboardScope,
  request: (url: string, init?: RequestInit) => Promise<Response>,
) {
  try {
    const result = await fetchDashboardCore(scope, request);
    for (const resource of Object.values(result.resources)) {
      if (resource.error) throw new Error('Não foi possível carregar os indicadores da dashboard.');
    }
    return result.resources;
  } catch (error) {
    if (canUseLegacyDashboard(error)) return null;
    throw error;
  }
}

/** Only supplementary fields may replace the main indicators, even when reads finish out of order. */
export function mergeStandardDashboard<T extends {
  historyData: any[]; pedidosData: any[]; pixConfig: unknown; profileSetup: unknown;
  radarSummary: unknown; attention: { lowStock: number; outOfStock: number; whatsappFailed: number };
}>(core: T, secondary?: T): T {
  if (!secondary) return core;
  return {
    ...core,
    historyData: [...core.historyData, ...secondary.historyData]
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 8),
    pedidosData: secondary.pedidosData,
    pixConfig: secondary.pixConfig,
    profileSetup: secondary.profileSetup,
    radarSummary: secondary.radarSummary,
    attention: { ...core.attention, lowStock: secondary.attention.lowStock,
      outOfStock: secondary.attention.outOfStock, whatsappFailed: secondary.attention.whatsappFailed },
  };
}
