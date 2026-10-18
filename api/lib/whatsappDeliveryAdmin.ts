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

const MARKETING_KEYWORDS = ["prospec", "resgate", "campanha", "botoes", "teste_encerrando", "retomada", "cortesia", "convite", "mkt"];
const RATE_MARKETING_BRL = 0.38;
const RATE_UTILITY_BRL = 0.20;

function isMarketingTemplate(templateName?: string | null): boolean {
  if (!templateName) return false;
  const name = templateName.toLowerCase();
  return MARKETING_KEYWORDS.some((kw) => name.includes(kw));
}

export async function summarizeWhatsAppDeliveries(sb: SupabaseClient) {
  await markStaleWhatsAppDeliveries(sb);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  
  const now = new Date();
  const spFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayKey = spFormatter.format(now);
  const [yearStr, monthStr, dayStr] = todayKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0)).toISOString();
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const monthName = `${monthNames[month - 1]}/${year}`;

  const deliveriesRes = await sb
    .from(TABLE)
    .select("status, created_at, template_name")
    .gte("created_at", since30d)
    .limit(10000);

  let prospectingEvents: Array<{ created_at: string; metadata?: Record<string, unknown> }> = [];
  try {
    const { data: pData } = await sb
      .from("prospecting_events")
      .select("created_at, metadata")
      .eq("event_type", "whatsapp_message_sent")
      .gte("created_at", startOfMonth)
      .limit(10000);
    if (pData) {
      prospectingEvents = pData as Array<{ created_at: string; metadata?: Record<string, unknown> }>;
    }
  } catch (err) {
    console.warn("[whatsapp-delivery] falha ao buscar eventos de prospecção:", err);
  }

  const data = deliveriesRes.data || [];

  const counts: Record<string, number> = {
    total30d: 0, today: 0, queued: 0, accepted: 0, sent: 0,
    delivered: 0, read: 0, failed: 0, unknown: 0,
  };

  let currentMonthEstimatedBrl = 0;
  let todayCostBrl = 0;
  let marketingCountMonth = 0;
  let utilityCountMonth = 0;
  let transactionalCountMonth = 0;

  for (const row of data) {
    const status = String(row.status || "");
    counts.total30d += 1;
    if (status in counts) counts[status] += 1;
    const rowDay = spFormatter.format(new Date(row.created_at));
    if (rowDay === todayKey) counts.today += 1;

    // Custos do mês corrente para mensagens que não falharam
    if (row.created_at >= startOfMonth && status !== "failed") {
      transactionalCountMonth += 1;
      const isMkt = isMarketingTemplate(row.template_name);
      const unitCost = isMkt ? RATE_MARKETING_BRL : RATE_UTILITY_BRL;
      currentMonthEstimatedBrl += unitCost;
      if (isMkt) marketingCountMonth += 1;
      else utilityCountMonth += 1;
      if (rowDay === todayKey) todayCostBrl += unitCost;
    }
  }

  // Adiciona os disparos do robô de prospecção autônoma (cobrados na mesma conta Meta)
  let prospectingCountMonth = 0;
  for (const p of prospectingEvents) {
    prospectingCountMonth += 1;
    const tplName = String(p.metadata?.template || "axecloud_prospeccao_imagem_v1");
    const isMkt = isMarketingTemplate(tplName);
    const unitCost = isMkt ? RATE_MARKETING_BRL : RATE_UTILITY_BRL;
    currentMonthEstimatedBrl += unitCost;
    if (isMkt) marketingCountMonth += 1;
    else utilityCountMonth += 1;
    const pDay = spFormatter.format(new Date(p.created_at));
    if (pDay === todayKey) todayCostBrl += unitCost;
  }

  const daysElapsed = Math.max(1, day);
  const dailyAverageBrl = currentMonthEstimatedBrl / daysElapsed;
  const projectedMonthEndBrl = dailyAverageBrl * totalDaysInMonth;

  const terminal = counts.delivered + counts.read + counts.failed;
  return {
    ...counts,
    attention: counts.failed + counts.unknown + counts.queued,
    deliveryRate: terminal > 0 ? Math.round(((counts.delivered + counts.read) / terminal) * 1000) / 10 : null,
    cost: {
      currentMonthEstimatedBrl: Math.round(currentMonthEstimatedBrl * 100) / 100,
      projectedMonthEndBrl: Math.round(projectedMonthEndBrl * 100) / 100,
      todayCostBrl: Math.round(todayCostBrl * 100) / 100,
      dailyAverageBrl: Math.round(dailyAverageBrl * 100) / 100,
      marketingCountMonth,
      utilityCountMonth,
      prospectingCountMonth,
      transactionalCountMonth,
      totalMessagesMonth: marketingCountMonth + utilityCountMonth,
      monthName,
      daysElapsed,
      totalDaysInMonth,
      rateMarketingBrl: RATE_MARKETING_BRL,
      rateUtilityBrl: RATE_UTILITY_BRL,
    },
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