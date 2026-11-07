import { isDashboardCoreResponse, type DashboardCoreResponse } from '../../lib/dashboardCoreContract';
import type { DashboardScope } from './dashboardResources';

export class DashboardCoreError extends Error {
  constructor(readonly status: number) { super(`Dashboard indisponível (${status}).`); }
}

export const canUseLegacyDashboard = (error: unknown) => error instanceof DashboardCoreError
  && [404, 405, 501].includes(error.status);

export async function fetchDashboardCore(
  scope: DashboardScope,
  authFetch: (url: string, init?: RequestInit) => Promise<Response>,
): Promise<DashboardCoreResponse> {
  const response = await authFetch(`/api/v1/dashboard/core?tenantId=${encodeURIComponent(scope.tenantId)}`);
  if (!response.ok) throw new DashboardCoreError(response.status);
  const data = await response.json();
  if (!isDashboardCoreResponse(data)) throw new Error('Resposta da dashboard inválida.');
  return data;
}
