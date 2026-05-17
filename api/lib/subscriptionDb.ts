import type { SupabaseClient } from "@supabase/supabase-js";

export function isMissingColumnErr(error: unknown, columnName: string): boolean {
  const message = String((error as { message?: string })?.message || "");
  const code = String((error as { code?: string })?.code || "");
  return (
    message.includes(`column "${columnName}" does not exist`) ||
    message.includes(`'${columnName}' column`) ||
    code === "PGRST204"
  );
}

/** Remove colunas ausentes no schema (cache Supabase desatualizado ou migration pendente). */
export async function upsertSubscriptionResilient(
  supabaseAdmin: SupabaseClient,
  row: Record<string, unknown>
): Promise<{ error: Error | null }> {
  let payload = { ...row };
  for (let attempt = 0; attempt < 12; attempt++) {
    const { error } = await supabaseAdmin.from("subscriptions").upsert(payload, { onConflict: "id" });
    if (!error) return { error: null };

    const msg = String(error.message || "");
    const match =
      msg.match(/Could not find the '([^']+)' column/i) ||
      msg.match(/column "([^"]+)" does not exist/i);
    const col = match?.[1];
    if (col && col in payload) {
      const next = { ...payload };
      delete next[col];
      payload = next;
      continue;
    }
    return { error: error as Error };
  }
  return { error: new Error("upsert subscriptions: muitas colunas ausentes no schema") };
}

export async function updateSubscriptionResilient(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  patch: Record<string, unknown>
): Promise<{ error: Error | null }> {
  let payload = { ...patch };
  for (let attempt = 0; attempt < 12; attempt++) {
    const { error } = await supabaseAdmin.from("subscriptions").update(payload).eq("id", tenantId);
    if (!error) return { error: null };

    const msg = String(error.message || "");
    const match =
      msg.match(/Could not find the '([^']+)' column/i) ||
      msg.match(/column "([^"]+)" does not exist/i);
    const col = match?.[1];
    if (col && col in payload) {
      const next = { ...payload };
      delete next[col];
      payload = next;
      continue;
    }
    return { error: error as Error };
  }
  return { error: new Error("update subscriptions: muitas colunas ausentes no schema") };
}

/** Garante linha `pending` para onboarding/checkout (nunca força `active`). */
export async function ensurePendingSubscriptionRow(
  supabaseAdmin: SupabaseClient,
  tenantId: string
): Promise<void> {
  const tid = String(tenantId || "").trim();
  if (!tid) return;

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status")
    .eq("id", tid)
    .maybeSingle();

  if (sub?.status === "active") return;

  if (sub?.id) {
    if (sub.status === "pending") return;
    await updateSubscriptionResilient(supabaseAdmin, tid, {
      status: "pending",
      updated_at: new Date().toISOString(),
    });
    return;
  }

  const now = new Date().toISOString();
  const { error } = await upsertSubscriptionResilient(supabaseAdmin, {
    id: tid,
    tenant_id: tid,
    plan: "premium",
    status: "pending",
    expires_at: null,
    pending_since: now,
    updated_at: now,
  });
  if (error) {
    console.error("[subscriptions] ensurePending:", error.message);
  }
}
