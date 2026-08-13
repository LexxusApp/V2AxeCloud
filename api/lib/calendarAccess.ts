import type { SupabaseClient } from "@supabase/supabase-js";
import { assertUserCanAccessTenant } from "./tenantAccess.js";

/**
 * Intervalo de lembrete WhatsApp por gira (1–7 dias).
 * null / vazio / 0 / false = desligado.
 */
export function parseWaReminderIntervalDays(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "" || raw === false) return null;
  if (raw === true) return 2;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > 7) return 7;
  return n;
}

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
