import type { SupabaseClient } from "@supabase/supabase-js";
import { isSubscriptionAccessActive } from "./subscriptionAccess.js";

type LeaderProfile = {
  id?: string | null;
  tenant_id?: string | null;
  is_blocked?: boolean | null;
  deleted_at?: string | null;
};

type Subscription = {
  id?: string | null;
  status?: string | null;
  expires_at?: string | null;
};

/** IDs aceitos para casas ativas: id do líder e tenant_id legado. */
export async function loadActiveTenantScopeIds(sb: SupabaseClient): Promise<Set<string>> {
  const [profilesResult, subscriptionsResult] = await Promise.all([
    sb
      .from("perfil_lider")
      .select("id, tenant_id, is_blocked, deleted_at")
      .is("deleted_at", null),
    sb.from("subscriptions").select("id, status, expires_at"),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (subscriptionsResult.error) throw subscriptionsResult.error;

  const subscriptions = new Map<string, Subscription>();
  for (const row of (subscriptionsResult.data || []) as Subscription[]) {
    const id = String(row.id || "").trim();
    if (id) subscriptions.set(id, row);
  }

  const activeIds = new Set<string>();
  for (const profile of (profilesResult.data || []) as LeaderProfile[]) {
    const leaderId = String(profile.id || "").trim();
    const tenantId = String(profile.tenant_id || "").trim();
    if (!leaderId || profile.deleted_at || profile.is_blocked) continue;

    const subscription = subscriptions.get(leaderId) || (tenantId ? subscriptions.get(tenantId) : undefined);
    if (!isSubscriptionAccessActive(subscription)) continue;

    activeIds.add(leaderId);
    if (tenantId) activeIds.add(tenantId);
  }

  return activeIds;
}

export async function filterActiveTenantIds(
  sb: SupabaseClient,
  tenantIds: Iterable<string>,
): Promise<string[]> {
  const activeIds = await loadActiveTenantScopeIds(sb);
  return [...new Set([...tenantIds].map((id) => String(id || "").trim()).filter(Boolean))].filter((id) =>
    activeIds.has(id),
  );
}
