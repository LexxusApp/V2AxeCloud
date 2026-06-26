import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

let vapidReady = false;

function ensureVapid(): boolean {
  if (vapidReady) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  try {
    webpush.setVapidDetails("mailto:contato@axecloud.com.br", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidReady = true;
    return true;
  } catch {
    return false;
  }
}

/** Push web para o zelador (user_id = perfil_lider.id). */
export async function sendPushToZelador(
  sb: SupabaseClient,
  tenantId: string,
  resolveLeaderId: (tenantId: string) => Promise<string>,
  payload: { title: string; body: string; url: string },
): Promise<{ sent: number }> {
  if (!ensureVapid()) return { sent: 0 };

  try {
    const leaderId = await resolveLeaderId(tenantId);
    const { data: subs, error } = await sb
      .from("push_subscriptions")
      .select("subscription_object")
      .eq("user_id", leaderId);

    if (error) throw error;
    if (!subs?.length) return { sent: 0 };

    let sent = 0;
    await Promise.all(
      subs.map((sub: { subscription_object: webpush.PushSubscription }) =>
        webpush
          .sendNotification(sub.subscription_object, JSON.stringify(payload))
          .then(() => {
            sent++;
          })
          .catch((err: { statusCode?: number; message?: string }) => {
            if (err?.statusCode === 410 || err?.statusCode === 404) return;
            console.warn("[PUSH-ZELADOR] falha ao enviar:", err?.message || err);
          }),
      ),
    );
    return { sent };
  } catch (err) {
    console.error("[PUSH-ZELADOR] erro:", err);
    return { sent: 0 };
  }
}
