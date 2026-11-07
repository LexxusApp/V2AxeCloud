import type { SupabaseClient } from '@supabase/supabase-js';
import { isConsoleGlobalAdmin } from './consoleAdmin.js';
import { isValidUuid, resolveLeaderId, resolveFilhoHouseRefs } from './tenantAccess.js';
import { DASHBOARD_CORE_SCHEMA, type DashboardCoreResponse, type DashboardCoreResult } from '../../lib/dashboardCoreContract.js';

type DashboardUser = { id: string; email?: string | null };
type AccessDependencies = {
  childRefs: typeof resolveFilhoHouseRefs;
  globalAdmin: (sb: SupabaseClient, user: DashboardUser) => Promise<boolean>;
  leader: (sb: SupabaseClient, id: string) => Promise<string>;
};
const accessDependencies: AccessDependencies = {
  childRefs: resolveFilhoHouseRefs,
  globalAdmin: isConsoleGlobalAdmin,
  leader: resolveLeaderId,
};

/** A dashboard is a manager read. Reuse existing identity/alias rules once,
 * without changing guards or caches used by any other endpoint. */
export async function resolveDashboardReadScope(
  sb: SupabaseClient,
  user: DashboardUser,
  tenantId: string,
  deps: AccessDependencies = accessDependencies,
): Promise<{ tenantId: string; leaderId: string } | null> {
  if (!isValidUuid(tenantId)) return null;
  const [child, global, profile] = await Promise.all([
    deps.childRefs(sb, user),
    deps.globalAdmin(sb, user),
    sb.from('perfil_lider').select('id,tenant_id').eq('id', user.id).maybeSingle(),
  ]);
  // A real member binding wins over a stale/phantom leader profile. Global
  // console administrators are independently verified and remain exempt.
  if (child && !global) return null;
  if (!global && !profile.data) return null;
  const owned = String(profile.data?.tenant_id || profile.data?.id || '').trim();
  const childIds = [child?.lider_id, child?.tenant_id].map((id) => String(id || '').trim()).filter(Boolean);
  const ids = [...new Set([tenantId, ...(!global ? [owned, ...childIds] : [])].filter(Boolean))];
  const leaders = new Map(await Promise.all(ids.map(async (id) => [id, await deps.leader(sb, id)] as const)));
  const leaderId = leaders.get(tenantId)!;
  if (!global) {
    // Same intersection as assertUserCanAccessTenant + assertZeladorOrGlobalAdmin:
    // membership alone does not grant a manager read; a shadow profile does not
    // override the child's actual house. Keep the legacy self-ID behavior.
    if (leaderId !== leaders.get(owned)) return null;
  }
  return { tenantId, leaderId };
}

export async function readDashboardCore(
  sb: SupabaseClient,
  scope: { tenantId: string; leaderId: string },
): Promise<DashboardCoreResponse> {
  const { tenantId, leaderId } = scope;
  if (!isValidUuid(tenantId) || !isValidUuid(leaderId)) throw new Error('Escopo inválido.');
  const ids = [...new Set([tenantId, leaderId])];
  const eventFilter = ids.flatMap((id) => [`tenant_id.eq.${id}`, `lider_id.eq.${id}`]).join(',');
  async function read(query: PromiseLike<{ data: any[] | null; error: unknown }>, financial = false): Promise<DashboardCoreResult> {
    try {
      const result = await query;
      if (result.error || !Array.isArray(result.data)) return { error: 'Dados temporariamente indisponíveis.' };
      return { data: financial ? result.data.filter((row) => String(row?.status || '').toLowerCase() !== 'excluido') : result.data };
    } catch {
      return { error: 'Dados temporariamente indisponíveis.' };
    }
  }
  // Keep the existing filters, limits and ordering. No writes or integrations.
  const [children, transactions, events, notices] = await Promise.all([
    read(sb.from('filhos_de_santo').select('*').or(`tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`).order('nome', { ascending: true })),
    read(sb.from('financeiro').select('*').or(`tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`).order('data', { ascending: false }).limit(400), true),
    read(sb.from('calendario_axe').select('*').or(eventFilter).neq('tipo', 'Obrigação').order('data', { ascending: true })),
    read(sb.from('mural_avisos').select('*').or(ids.map((id) => `tenant_id.eq.${id}`).join(',')).order('data_publicacao', { ascending: false })),
  ]);
  return { schemaVersion: DASHBOARD_CORE_SCHEMA, resources: { children, transactions, events, notices } };
}
