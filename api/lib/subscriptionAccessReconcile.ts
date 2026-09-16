import type { SupabaseClient } from "@supabase/supabase-js";
import { isSubscriptionAccessActive, isSubscriptionExpired } from "./subscriptionAccess.js";

type SubscriptionRow = {
  id: string;
  status?: string | null;
  expires_at?: string | null;
};

type LeaderRow = {
  id: string;
  is_blocked?: boolean | null;
  access_block_reason?: string | null;
  access_blocked_at?: string | null;
};

/**
 * Mantém o bloqueio de acesso coerente com a assinatura.
 *
 * Bloqueios manuais são preservados. Somente contas bloqueadas por vencimento
 * são reativadas automaticamente após a confirmação de um novo pagamento.
 */
export async function reconcileExpiredTenantAccess(sb: SupabaseClient) {
  const [profilesRes, subscriptionsRes] = await Promise.all([
    sb
      .from("perfil_lider")
      .select("id, is_blocked, access_block_reason, access_blocked_at")
      .is("deleted_at", null),
    sb.from("subscriptions").select("id, status, expires_at"),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (subscriptionsRes.error) throw subscriptionsRes.error;

  const subscriptions = new Map<string, SubscriptionRow>(
    ((subscriptionsRes.data || []) as SubscriptionRow[]).map((sub) => [String(sub.id), sub])
  );
  const now = new Date().toISOString();
  let blocked = 0;
  let unblocked = 0;
  let preservedManualBlocks = 0;

  for (const profile of (profilesRes.data || []) as LeaderRow[]) {
    const subscription = subscriptions.get(String(profile.id));

    if (isSubscriptionExpired(subscription)) {
      const reason = String(profile.access_block_reason || "").trim();
      if (profile.is_blocked && reason && reason !== "subscription_expired") {
        preservedManualBlocks += 1;
        continue;
      }

      if (!profile.is_blocked || reason !== "subscription_expired") {
        const { error } = await sb
          .from("perfil_lider")
          .update({
            is_blocked: true,
            access_block_reason: "subscription_expired",
            access_blocked_at: profile.access_blocked_at || now,
            updated_at: now,
          })
          .eq("id", profile.id);
        if (error) throw error;
        blocked += 1;
      }
      continue;
    }

    if (
      profile.is_blocked &&
      profile.access_block_reason === "subscription_expired" &&
      isSubscriptionAccessActive(subscription)
    ) {
      const { error } = await sb
        .from("perfil_lider")
        .update({
          is_blocked: false,
          access_block_reason: null,
          access_blocked_at: null,
          updated_at: now,
        })
        .eq("id", profile.id);
      if (error) throw error;
      unblocked += 1;
    }
  }

  return {
    scanned: (profilesRes.data || []).length,
    blocked,
    unblocked,
    preservedManualBlocks,
  };
}