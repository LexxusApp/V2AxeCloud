import type { SupabaseClient } from "@supabase/supabase-js";
import { assertUserCanAccessTenant } from "./tenantAccess.js";

/** Valida posse do evento (tenant/lider) antes de mutações destrutivas. */
export async function userCanModifyCalendarEvent(
  supabaseAdmin: SupabaseClient,
  user: { id: string; email?: string | null },
  eventId: string
): Promise<{ allowed: boolean; notFound: boolean }> {
  const id = String(eventId || "").trim();
  if (!id) return { allowed: false, notFound: true };

  const { data: event, error } = await supabaseAdmin
    .from("calendario_axe")
    .select("id, tenant_id, lider_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!event) return { allowed: false, notFound: true };

  const scopeIds = new Set<string>();
  for (const raw of [event.tenant_id, event.lider_id]) {
    const s = String(raw || "").trim();
    if (s) scopeIds.add(s);
  }

  for (const tid of scopeIds) {
    if (await assertUserCanAccessTenant(supabaseAdmin, user, tid)) {
      return { allowed: true, notFound: false };
    }
  }
  return { allowed: false, notFound: false };
}
