import { supabase } from "./supabase";

/** Regista no admin (access_logs → access.insight.dismissed) quando o zelador clica Entendi. */
export async function trackInsightDismissed(opts: {
  insightKey: string;
  insightTitle?: string;
  tenantId?: string | null;
}): Promise<void> {
  try {
    const key = String(opts.insightKey || "").trim();
    if (!key) return;

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    await fetch("/api/metrics/insight-ack", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        insightKey: key,
        insightTitle: opts.insightTitle || "",
        tenantId: opts.tenantId || null,
      }),
    });
  } catch {
    /* métricas não bloqueiam o UI */
  }
}
