import type { SupabaseClient } from "@supabase/supabase-js";

type SettingsRow = { data?: unknown; value?: unknown };

/** Lê payload JSON de global_settings (coluna `data` ou legado `value`). */
export async function loadGlobalSettingPayload(
  supabaseAdmin: SupabaseClient,
  id: string
): Promise<unknown | null> {
  const { data: row, error } = await supabaseAdmin
    .from("global_settings")
    .select("data, value")
    .eq("id", id)
    .maybeSingle();

  if (!error) {
    return pickSettingsPayload(row as SettingsRow | null);
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

  if (/column ["']?value["']?/i.test(msg) || /Could not find the 'value' column/i.test(msg)) {
    const modern = await supabaseAdmin.from("global_settings").select("data").eq("id", id).maybeSingle();
    if (modern.error) {
      console.warn(`[global_settings] load ${id}:`, modern.error.message);
      return null;
    }
    return pickSettingsPayload(modern.data as SettingsRow | null);
  }

  console.warn(`[global_settings] load ${id}:`, msg);
  return null;
}

function pickSettingsPayload(row: SettingsRow | null): unknown | null {
  if (!row) return null;
  const fromData = row.data;
  const fromValue = row.value;
  const hasData =
    fromData !== undefined && fromData !== null && typeof fromData === "object" && Object.keys(fromData as object).length > 0;
  const hasValue =
    fromValue !== undefined && fromValue !== null && typeof fromValue === "object" && Object.keys(fromValue as object).length > 0;
  if (hasData && hasValue) {
    return { ...(fromValue as Record<string, unknown>), ...(fromData as Record<string, unknown>) };
  }
  if (fromData !== undefined && fromData !== null) return fromData;
  if (fromValue !== undefined && fromValue !== null) return fromValue;
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
