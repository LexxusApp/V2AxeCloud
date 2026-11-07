import { canUseLegacyDashboard, fetchDashboardCore } from './dashboardCoreClient';

export type ChildrenScope = { userId: string; tenantId: string };
export class ChildrenReadError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}
type Request = (url: string, init?: RequestInit) => Promise<Response>;
const snapshots = new Map<string, { rows: any[]; expiresAt: number }>();
const key = (scope: ChildrenScope) => JSON.stringify([scope.userId, scope.tenantId]);

/** Short-lived, in-memory only; raw rows include inactive/pending members. */
export function rememberChildren(scope: ChildrenScope, rows: any[]) {
  if (!scope.userId || !scope.tenantId) return;
  const id = key(scope);
  snapshots.delete(id);
  snapshots.set(id, { rows, expiresAt: Date.now() + 10_000 });
  if (snapshots.size > 20) snapshots.delete(snapshots.keys().next().value!);
}
export function recentChildren(scope: ChildrenScope) {
  const id = key(scope), entry = snapshots.get(id);
  if (entry && entry.expiresAt > Date.now()) return entry.rows;
  snapshots.delete(id);
  return undefined;
}
export function forgetChildren(scope: ChildrenScope) { snapshots.delete(key(scope)); }
export function childrenReadKey(scope?: ChildrenScope) {
  return scope?.userId && scope.tenantId ? ['children-list-v2', scope.userId, scope.tenantId] as const : null;
}

export async function loadChildren(scope: ChildrenScope, request: Request) {
  if (!scope.userId || !scope.tenantId) throw new ChildrenReadError('Conta indisponível para consulta.');
  try {
    const core = await fetchDashboardCore({ ...scope, userRole: 'manager' }, request);
    const children = core.resources.children;
    if (!children.data) throw new ChildrenReadError('Não foi possível carregar os membros. Tente novamente.');
    rememberChildren(scope, children.data);
    return children.data;
  } catch (error) {
    if (!canUseLegacyDashboard(error)) throw error;
  }
  const response = await request(`/api/children?userId=${encodeURIComponent(scope.userId)}&tenantId=${encodeURIComponent(scope.tenantId)}`, { cache: 'no-store' });
  if (!response.ok) throw new ChildrenReadError('Não foi possível carregar os membros. Tente novamente.', response.status);
  const result = await response.json();
  if (!Array.isArray(result?.data)) throw new ChildrenReadError('Resposta de membros inválida.');
  rememberChildren(scope, result.data);
  return result.data;
}

export async function loadPendingPayments(scope: ChildrenScope, request: Request) {
  const response = await request(`/api/v1/financial/mensalidades?tenantId=${encodeURIComponent(scope.tenantId)}&view=pendentes`, { cache: 'no-store' });
  if (!response.ok) throw new ChildrenReadError('Situação financeira indisponível.', response.status);
  const result = await response.json();
  if (!Array.isArray(result?.data)) throw new ChildrenReadError('Situação financeira inválida.');
  return result.data;
}
