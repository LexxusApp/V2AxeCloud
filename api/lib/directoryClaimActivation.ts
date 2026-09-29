import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyApprovedTerreiroClaim } from "./diretorioClaimNotify.js";

export type ClaimActivationEventType =
  | "approved"
  | "notification_sent"
  | "activation_opened"
  | "activation_started"
  | "activation_completed"
  | "reminder_24h_sent"
  | "reminder_72h_sent";

function isActivationTableUnavailable(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || "");
  return /terreiro_claim_activation_events|schema cache|does not exist/i.test(message);
}

export async function recordClaimActivationEvent(
  sb: SupabaseClient,
  claimId: string,
  eventType: ClaimActivationEventType,
  options: { deliveryId?: string | null; metadata?: Record<string, unknown> } = {},
): Promise<boolean> {
  const { error } = await sb.from("terreiro_claim_activation_events").upsert(
    {
      claim_id: claimId,
      event_type: eventType,
      delivery_id: options.deliveryId || null,
      metadata: options.metadata || {},
    },
    { onConflict: "claim_id,event_type", ignoreDuplicates: true },
  );
  if (!error) return true;
  if (!isActivationTableUnavailable(error)) {
    console.warn("[directory-claim/activation-event]", error.message);
  }
  return false;
}

type ClaimReminderResult = {
  eligible: number;
  sent24h: number;
  sent72h: number;
  skipped: number;
  errors: number;
};

export async function runDirectoryClaimActivationReminders(
  sb: SupabaseClient,
  now = new Date(),
): Promise<ClaimReminderResult> {
  const result: ClaimReminderResult = { eligible: 0, sent24h: 0, sent72h: 0, skipped: 0, errors: 0 };
  try {
    const { ensureDirectoryClaimTemplates } = await import("./directoryClaimMetaTemplates.js");
    const templates = await ensureDirectoryClaimTemplates();
    if (templates.length) console.log("[directory-claim/templates]", templates);
  } catch (error) {
    console.warn("[directory-claim/templates] sync:", error instanceof Error ? error.message : error);
  }
  const threshold24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: claims, error: claimsError } = await sb
    .from("terreiro_claim_requests")
    .select("id, requester_name, requester_phone, terreiro_id, reviewed_at, claimed_tenant_id")
    .eq("status", "approved")
    .is("claimed_tenant_id", null)
    .not("reviewed_at", "is", null)
    .lte("reviewed_at", threshold24h)
    .order("reviewed_at", { ascending: true })
    .limit(150);
  if (claimsError) throw claimsError;
  if (!claims?.length) return result;

  result.eligible = claims.length;
  const claimIds = claims.map((claim) => String(claim.id));
  const terreiroIds = [...new Set(claims.map((claim) => String(claim.terreiro_id || "")).filter(Boolean))];
  const [{ data: events, error: eventsError }, { data: terreiros, error: terreirosError }] = await Promise.all([
    sb.from("terreiro_claim_activation_events").select("claim_id, event_type").in("claim_id", claimIds),
    terreiroIds.length
      ? sb.from("terreiros_diretorio").select("id, nome, claimed_by_tenant_id").in("id", terreiroIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (eventsError) {
    if (isActivationTableUnavailable(eventsError)) return { ...result, skipped: result.eligible };
    throw eventsError;
  }
  if (terreirosError) throw terreirosError;

  const eventsByClaim = new Map<string, Set<string>>();
  for (const event of events || []) {
    const id = String(event.claim_id || "");
    if (!eventsByClaim.has(id)) eventsByClaim.set(id, new Set());
    eventsByClaim.get(id)?.add(String(event.event_type || ""));
  }
  const terreiroById = new Map((terreiros || []).map((row) => [String(row.id), row]));

  for (const claim of claims) {
    const claimId = String(claim.id);
    const stageEvents = eventsByClaim.get(claimId) || new Set<string>();
    const terreiro = terreiroById.get(String(claim.terreiro_id || ""));
    if (stageEvents.has("activation_completed") || terreiro?.claimed_by_tenant_id) {
      result.skipped += 1;
      continue;
    }
    const reviewedAt = new Date(String(claim.reviewed_at || ""));
    const ageHours = (now.getTime() - reviewedAt.getTime()) / 3_600_000;
    const is72h = ageHours >= 72;
    const eventType: ClaimActivationEventType = is72h ? "reminder_72h_sent" : "reminder_24h_sent";
    if (stageEvents.has(eventType)) {
      result.skipped += 1;
      continue;
    }

    try {
      const notification = await notifyApprovedTerreiroClaim(sb, {
        claimId,
        requesterName: String(claim.requester_name || ""),
        requesterPhone: String(claim.requester_phone || ""),
        terreiroNome: String(terreiro?.nome || "Terreiro"),
        linkedTenantId: null,
        notificationKind: is72h ? "reminder_72h" : "reminder_24h",
      });
      if (!notification.sent) {
        result.errors += 1;
        continue;
      }
      await recordClaimActivationEvent(sb, claimId, eventType, {
        deliveryId: notification.deliveryId,
        metadata: { template: notification.template, automatic: true },
      });
      if (is72h) result.sent72h += 1;
      else result.sent24h += 1;
    } catch (error) {
      result.errors += 1;
      console.warn("[directory-claim/reminder]", claimId, error instanceof Error ? error.message : error);
    }
  }

  return result;
}
