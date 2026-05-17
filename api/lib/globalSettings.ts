import type { SupabaseClient } from "@supabase/supabase-js";

type SettingsRow = { data?: unknown; value?: unknown };

/** Lê payload JSON de global_settings (coluna `data` ou legado `value`). */
export async function loadGlobalSettingPayload(
  supabaseAdmin: SupabaseClient,
  id: string
): Promise<unknown | null> {
  const { data: row, error } = await supabaseAdmin
    .from("global_settings")
    .select("data")
    .eq("id", id)
    .maybeSingle();

  if (!error) {
    const payload = (row as SettingsRow | null)?.data;
    if (payload !== undefined && payload !== null) return payload;
    return null;
  }

  const msg = String(error.message || "");
  if (/column ["']?data["']?/i.test(msg) || /Could not find the 'data' column/i.test(msg)) {
    const legacy = await supabaseAdmin.from("global_settings").select("value").eq("id", id).maybeSingle();
    if (legacy.error) {
      console.warn(`[global_settings] load ${id}:`, legacy.error.message);
      return null;
    }
    return (legacy.data as SettingsRow | null)?.value ?? null;
  }

  console.warn(`[global_settings] load ${id}:`, msg);
  return null;
}

/** Grava payload (tenta `data`, fallback `value` em schemas legados). */
export async function saveGlobalSettingPayload(
  supabaseAdmin: SupabaseClient,
  id: string,
  payload: unknown
): Promise<void> {
  const now = new Date().toISOString();
  let { error } = await supabaseAdmin
    .from("global_settings")
    .upsert({ id, data: payload, updated_at: now }, { onConflict: "id" });

  if (!error) return;

  const msg = String(error.message || "");
  if (/column ["']?data["']?/i.test(msg) || /Could not find the 'data' column/i.test(msg)) {
    ({ error } = await supabaseAdmin
      .from("global_settings")
      .upsert({ id, value: payload, updated_at: now }, { onConflict: "id" }));
  }
  if (error) throw error;
}
