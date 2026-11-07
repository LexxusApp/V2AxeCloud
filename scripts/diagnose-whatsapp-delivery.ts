import { createClient } from "@supabase/supabase-js";

async function main() {
  const template = String(process.argv[2] || "").trim();
  const phoneTail = String(process.argv[3] || "").replace(/\D/g, "");
  if (!template || phoneTail.length < 4) throw new Error("Uso: template e final do telefone.");
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase administrativo não configurado.");
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: deliveries, error } = await sb
    .from("whatsapp_deliveries")
    .select("id,recipient_phone,recipient_name,template_name,template_language,source,source_id,status,external_id,error_code,error_message,queued_at,sending_at,accepted_at,sent_at,delivered_at,read_at,failed_at,last_webhook_at,created_at,updated_at,response_payload,metadata")
    .eq("template_name", template)
    .ilike("recipient_phone", `%${phoneTail}`)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;

  const output = [];
  for (const row of deliveries || []) {
    const { data: events, error: eventError } = await sb
      .from("whatsapp_delivery_events")
      .select("status,event_type,event_key,payload,created_at")
      .eq("delivery_id", row.id)
      .order("created_at", { ascending: true });
    if (eventError) throw eventError;
    output.push({
      ...row,
      recipient_phone: `••••${String(row.recipient_phone || "").slice(-4)}`,
      events: events || [],
    });
  }
  const latestCreatedAt = String(deliveries?.[0]?.created_at || "");
  let peers: Array<Record<string, unknown>> = [];
  if (latestCreatedAt) {
    const center = new Date(latestCreatedAt).getTime();
    const from = new Date(center - 10 * 60_000).toISOString();
    const to = new Date(center + 10 * 60_000).toISOString();
    const { data: peerRows, error: peerError } = await sb
      .from("whatsapp_deliveries")
      .select("id,recipient_phone,template_name,status,external_id,error_code,error_message,last_webhook_at,created_at")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: true });
    if (peerError) throw peerError;
    peers = (peerRows || []).map((row) => ({
      ...row,
      recipient_phone: `••••${String(row.recipient_phone || "").slice(-4)}`,
    }));
  }
  const { data: recentWebhooks, error: recentWebhookError } = await sb
    .from("whatsapp_delivery_events")
    .select("delivery_id,status,event_type,created_at")
    .eq("event_type", "meta_webhook")
    .order("created_at", { ascending: false })
    .limit(12);
  if (recentWebhookError) throw recentWebhookError;
  console.log(JSON.stringify({ target: output, peers, recentWebhooks: recentWebhooks || [] }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
