import type { EventoConfirmadoResumo } from './giraOperations';

export type DashboardScope = { tenantId: string; userId: string; userRole: string };
export type DashboardEvent = {
  id: string;
  titulo?: string | null;
  descricao?: string | null;
  data?: string | null;
  hora?: string | null;
  local?: string | null;
  tipo?: string | null;
};

export type DashboardResources = {
  children: any[];
  transactions: any[];
  events: DashboardEvent[];
  notices: any[];
  pixConfig: any | null;
  profile: any | null;
  radar: any | null;
  whatsappLogs: any[];
  whatsappConnected: boolean;
  confirmations: Record<string, EventoConfirmadoResumo[]>;
};
export type DashboardResource = keyof DashboardResources;
export type DashboardLoaders = {
  [K in DashboardResource]: (scope: DashboardScope) => Promise<DashboardResources[K]>;
};

type Dependencies = {
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  profile: (scope: DashboardScope) => PromiseLike<{ data: any; error: unknown }>;
  confirmations: (tenantId: string) => Promise<Record<string, EventoConfirmadoResumo[]>>;
  whatsappStatus: (userId: string) => Promise<boolean>;
};

export const normalizeDashboardChildren = (rows: any[]) => rows.filter((child) => {
  const status = String(child?.status ?? 'Ativo').trim().toLowerCase();
  return status === 'ativo' || status === 'active' || status === '';
});
export const normalizeDashboardTransactions = (rows: any[]) => rows.map((transaction) => ({
  ...transaction, valor: Number(transaction?.valor) || 0,
}));

// Keep the existing routes and financial scope. A failed request must not become
// a successful empty list: each card owns its loading/error state.
export function createDashboardLoaders(deps: Dependencies): DashboardLoaders {
  async function json(url: string, init?: RequestInit) {
    const response = await deps.authFetch(url, init);
    if (!response.ok) throw new Error(`Não foi possível carregar os dados (${response.status}).`);
    return response.json();
  }
  async function list(url: string, field = 'data', init?: RequestInit): Promise<any[]> {
    const payload = await json(url, init);
    if (!Array.isArray(payload?.[field])) throw new Error('Resposta de dados inválida.');
    return payload[field];
  }
  const query = ({ tenantId, userId, userRole }: DashboardScope) =>
    `tenantId=${encodeURIComponent(tenantId)}&userId=${encodeURIComponent(userId)}&userRole=${encodeURIComponent(userRole)}`;

  return {
    children: async (scope) => normalizeDashboardChildren(await list(`/api/children?${query(scope)}`)),
    transactions: async (scope) => normalizeDashboardTransactions(await list(`/api/transactions?${query(scope)}&limit=400`)),
    events: (scope) => list(`/api/events?tenantId=${encodeURIComponent(scope.tenantId)}&scope=calendar`),
    notices: (scope) => list(`/api/notices?tenantId=${encodeURIComponent(scope.tenantId)}`),
    pixConfig: async (scope) => {
      const payload = await json(`/api/v1/financial/pix-config?tenantId=${encodeURIComponent(scope.tenantId)}`);
      return payload?.data || payload || null;
    },
    radar: () => json('/api/v1/settings/directory-profile', { cache: 'no-store' }),
    whatsappLogs: () => list('/api/whatsapp/logs?limit=200', 'logs', { cache: 'no-store' }),
    profile: async (scope) => {
      const result = await deps.profile(scope);
      if (result.error) throw result.error;
      return result.data;
    },
    confirmations: (scope) => deps.confirmations(scope.tenantId),
    whatsappConnected: (scope) => deps.whatsappStatus(scope.userId),
  };
}

export function dashboardResourceKey(resource: DashboardResource, scope?: DashboardScope) {
  return scope?.tenantId && scope.userId
    ? ['berry-dashboard-resource-v1', resource, scope.tenantId, scope.userId, scope.userRole] as const
    : null;
}

export const dashboardSWRConfig = {
  revalidateOnFocus: false,
  dedupingInterval: 15_000,
  keepPreviousData: false,
  errorRetryCount: 1,
  errorRetryInterval: 5_000,
} as const;
