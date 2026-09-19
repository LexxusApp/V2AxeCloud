import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetaTemplateComponent } from "../../src/services/evolution.service.js";
import { sendMetaCloudTemplate, sendMetaCloudText } from "./metaCloudSend.js";
import { markStaleWhatsAppDeliveries } from "./whatsappDeliveryTracking.js";

const TABLE = "whatsapp_deliveries";
const EVENTS = "whatsapp_delivery_events";
const VALID_STATUSES = new Set([
  "queued", "sending", "accepted", "sent", "delivered", "read", "failed", "unknown",
]);

function cleanSearch(value: unknown): string {
  return String(value || "").trim().replace(/[,()%_*]/g, "").slice(0, 80);
}

function maskPhone(value: unknown): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 8) return digits;
  return `+${digits.slice(0, 2)} ${digits.slice(2, -4).replace(/\d/g, "•")}${digits.slice(-4)}`;
}

function presentRow(row: Record<string, unknown>) {
  const { recipient_phone: phone, request_payload: requestPayload, ...safe } = row;
  const request = requestPayload && typeof requestPayload === "object"
    ? (requestPayload as Record<string, unknown>)
    : {};
  return {
    ...safe,
    phoneMasked: maskPhone(phone),
    messagePreview:
      typeof request.text === "string"
        ? request.text.slice(0, 180)
        : row.template_name
          ? `Template: ${row.template_name}`
          : "Mensagem WhatsApp",
  };
}

export async function listWhatsAppDeliveries(
  sb: SupabaseClient,
  input: { status?: string; source?: string; q?: string; limit?: number; offset?: number },
) {
  await markStaleWhatsAppDeliveries(sb);
  const limit = Math.min(200, Math.max(1, Number(input.limit || 80)));
  const offset = Math.max(0, Number(input.offset || 0));
  const status = String(input.status || "").trim().toLowerCase();
  const source = String(input.source || "").trim();
  const search = cleanSearch(input.q);

  let query = sb
    .from(TABLE)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (status && VALID_STATUSES.has(status)) query = query.eq("status", status);
  if (source) query = query.eq("source", source);
  if (search) {
    const digits = search.replace(/\D/g, "");
    const filters = [`recipient_name.ilike.%${search}%`, `template_name.ilike.%${search}%`];
    if (digits.length >= 4) filters.push(`recipient_phone.ilike.%${digits}%`);
    query = query.or(filters.join(","));
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data || []).map((row) => presentRow(row as Record<string, unknown>)), count: count || 0 };
}

export async function getWhatsAppDelivery(sb: SupabaseClient, id: string) {
  const { data: row, error } = await sb.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!row) throw Object.assign(new Error("Mensagem não encontrada."), { status: 404 });
  const { data: events, error: eventError } = await sb
    .from(EVENTS)
    .select("id, status, event_type, payload, created_at")
    .eq("delivery_id", id)
    .order("created_at", { ascending: true });
  if (eventError) throw eventError;
  return { row: presentRow(row as Record<string, unknown>), events: events || [] };
}

export async function summarizeWhatsAppDeliveries(sb: SupabaseClient) {
  await markStaleWhatsAppDeliveries(sb);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const { data, error } = await sb
    .from(TABLE)
    .select("status, created_at")
    .gte("created_at", since)
    .limit(10000);
  if (error) throw error;

  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const counts: Record<string, number> = {
    total30d: 0, today: 0, queued: 0, accepted: 0, sent: 0,
    delivered: 0, read: 0, failed: 0, unknown: 0,
  };
  for (const row of data || []) {
    const status = String(row.status || "");
    counts.total30d += 1;
    if (status in counts) counts[status] += 1;
    const rowDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(row.created_at));
    if (rowDay === todayKey) counts.today += 1;
  }
  const terminal = counts.delivered + counts.read + counts.failed;
  return {
    ...counts,
    attention: counts.failed + counts.unknown + counts.queued,
    deliveryRate: terminal > 0 ? Math.round(((counts.delivered + counts.read) / terminal) * 1000) / 10 : null,
  };
}

export async function retryWhatsAppDelivery(
  sb: SupabaseClient,
  id: string,
  requestedBy?: string | null,
) {
  const { data: row, error } = await sb.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!row) throw Object.assign(new Error("Mensagem não encontrada."), { status: 404 });
  if (!["failed", "unknown"].includes(String(row.status))) {
    throw Object.assign(new Error("Somente mensagens com falha ou sem confirmação podem ser reenviadas."), { status: 409 });
  }

  const request = (row.request_payload || {}) as Record<string, unknown>;
  const context = {
    tenantId: row.tenant_id || null,
    recipientName: row.recipient_name || null,
    source: "manual_retry",
    sourceId: String(row.id),
    requestedBy: requestedBy || null,
    retryOfId: String(row.id),
    attemptNumber: Number(row.attempt_number || 1) + 1,
    metadata: { originalSource: row.source, originalSourceId: row.source_id },
  };

  if (row.message_kind === "template") {
    const templateName = String(request.templateName || row.template_name || "").trim();
    const language = String(request.language || row.template_language || "pt_BR").trim();
    const components = Array.isArray(request.components)
      ? request.components as MetaTemplateComponent[]
      : [];
    if (!templateName) throw Object.assign(new Error("Template original não disponível para reenvio."), { status: 422 });
    return sendMetaCloudTemplate(row.recipient_phone, templateName, language, components, context);
  }

  const text = String(request.text || "").trim();
  if (!text) throw Object.assign(new Error("Texto original não disponível para reenvio."), { status: 422 });
  return sendMetaCloudText(row.recipient_phone, text, context);
}