import type { SupabaseClient } from "@supabase/supabase-js";

export type WhatsAppDeliveryStatus =
  | "queued"
  | "sending"
  | "accepted"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "unknown";

export type WhatsAppDeliveryContext = {
  tenantId?: string | null;
  recipientName?: string | null;
  source?: string;
  sourceId?: string | null;
  requestedBy?: string | null;
  idempotencyKey?: string | null;
  retryOfId?: string | null;
  attemptNumber?: number;
  metadata?: Record<string, unknown>;
};

type BeginInput = WhatsAppDeliveryContext & {
  recipientPhone: string;
  channel?: "meta_cloud" | "evolution" | "baileys";
  startImmediately?: boolean;
  messageKind: "template" | "text";
  templateName?: string | null;
  templateLanguage?: string | null;
  requestPayload?: Record<string, unknown>;
};

export type TrackedDelivery = {
  id: string;
  duplicate: boolean;
  status: WhatsAppDeliveryStatus;
  externalId?: string | null;
};

let trackingClient: SupabaseClient | null = null;
let watchdogStarted = false;

const TABLE = "whatsapp_deliveries";
const EVENTS_TABLE = "whatsapp_delivery_events";

function now(): string {
  return new Date().toISOString();
}

function safeText(value: unknown, max = 500): string | null {
  const text = String(value || "").trim();
  return text ? text.slice(0, max) : null;
}

function errorDetails(error: unknown): { code: string | null; message: string } {
  const object = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const code = safeText(object.metaCode ?? object.code, 80);
  const message = safeText(error instanceof Error ? error.message : error, 1000) || "Falha desconhecida";
  return { code, message };
}

function isTableUnavailable(error: unknown): boolean {
  const message = String((error as { message?: string } | null)?.message || error || "");
  return /whatsapp_deliveries|schema cache|does not exist|PGRST205/i.test(message);
}

async function appendEvent(
  sb: SupabaseClient,
  deliveryId: string,
  status: WhatsAppDeliveryStatus,
  eventType: string,
  payload: Record<string, unknown> = {},
  eventKey?: string | null,
): Promise<void> {
  const { error } = await sb.from(EVENTS_TABLE).insert({
    delivery_id: deliveryId,
    status,
    event_type: eventType,
    event_key: eventKey || null,
    payload,
  });
  if (error && String((error as { code?: string }).code || "") !== "23505") {
    console.warn("[whatsapp-delivery] evento nao gravado:", error.message);
  }
}

export function configureWhatsAppDeliveryTracking(sb: SupabaseClient): void {
  trackingClient = sb;
}

export function getWhatsAppDeliveryTrackingClient(): SupabaseClient | null {
  return trackingClient;
}

export async function beginWhatsAppDelivery(input: BeginInput): Promise<TrackedDelivery | null> {
  const sb = trackingClient;
  if (!sb) return null;

  const phone = String(input.recipientPhone || "").replace(/\D/g, "");
  if (!phone) return null;

  const payload = {
    tenant_id: input.tenantId || null,
    recipient_phone: phone,
    recipient_name: safeText(input.recipientName, 180),
    channel: input.channel || "meta_cloud",
    message_kind: input.messageKind,
    template_name: safeText(input.templateName, 180),
    template_language: safeText(input.templateLanguage, 32),
    source: safeText(input.source, 100) || "system",
    source_id: safeText(input.sourceId, 180),
    status: "queued",
    idempotency_key: safeText(input.idempotencyKey, 240),
    retry_of_id: input.retryOfId || null,
    requested_by: input.requestedBy || null,
    attempt_number: Math.max(1, Number(input.attemptNumber || 1)),
    request_payload: input.requestPayload || {},
    metadata: input.metadata || {},
    queued_at: now(),
    updated_at: now(),
  };

  const { data, error } = await sb.from(TABLE).insert(payload).select("id, status, external_id").single();
  if (error) {
    if (String((error as { code?: string }).code || "") === "23505" && input.idempotencyKey) {
      const { data: existing } = await sb
        .from(TABLE)
        .select("id, status, external_id")
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();
      if (existing?.id) {
        return {
          id: String(existing.id),
          duplicate: true,
          status: String(existing.status || "queued") as WhatsAppDeliveryStatus,
          externalId: existing.external_id ? String(existing.external_id) : null,
        };
      }
    }
    if (!isTableUnavailable(error)) {
      console.error("[whatsapp-delivery] fila nao gravada:", error.message);
    }
    return null;
  }

  const id = String(data.id);
  await appendEvent(sb, id, "queued", "queued", {
    source: payload.source,
    sourceId: payload.source_id,
    template: payload.template_name,
  }, "queued");

  if (input.startImmediately === false) {
    return { id, duplicate: false, status: "queued", externalId: null };
  }

  await markWhatsAppDeliverySending(id);
  return { id, duplicate: false, status: "sending", externalId: null };
}

export async function markWhatsAppDeliverySending(
  deliveryId: string | null | undefined,
): Promise<void> {
  const sb = trackingClient;
  if (!sb || !deliveryId) return;
  const timestamp = now();
  const { error } = await sb
    .from(TABLE)
    .update({ status: "sending", sending_at: timestamp, updated_at: timestamp })
    .eq("id", deliveryId);
  if (error) {
    if (!isTableUnavailable(error)) console.warn("[whatsapp-delivery] inicio nao gravado:", error.message);
    return;
  }
  await appendEvent(sb, deliveryId, "sending", "sending", {}, "sending");
}

export async function acceptWhatsAppDelivery(
  deliveryId: string | null | undefined,
  externalId: string | null | undefined,
  responsePayload: Record<string, unknown> = {},
  acceptedStatus: "accepted" | "sent" = "accepted",
): Promise<void> {
  const sb = trackingClient;
  if (!sb || !deliveryId) return;
  const timestamp = now();
  const patch: Record<string, unknown> = {
    status: externalId ? acceptedStatus : "unknown",
    accepted_at: externalId ? timestamp : null,
    ...(acceptedStatus === "sent" && externalId ? { sent_at: timestamp } : {}),
    external_id: externalId || null,
    response_payload: responsePayload,
    updated_at: timestamp,
  };
  const { error } = await sb.from(TABLE).update(patch).eq("id", deliveryId);
  if (error) {
    console.error("[whatsapp-delivery] aceite nao gravado:", error.message);
    return;
  }
  await appendEvent(
    sb,
    deliveryId,
    externalId ? "accepted" : "unknown",
    externalId ? "meta_accepted" : "meta_without_wamid",
    { externalId: externalId || null, ...responsePayload },
    externalId ? `accepted:${externalId}` : "accepted:missing-wamid",
  );
}

export async function failWhatsAppDelivery(
  deliveryId: string | null | undefined,
  error: unknown,
  responsePayload: Record<string, unknown> = {},
  acceptedStatus: "accepted" | "sent" = "accepted",
): Promise<void> {
  const sb = trackingClient;
  if (!sb || !deliveryId) return;
  const details = errorDetails(error);
  const timestamp = now();
  const { error: updateError } = await sb
    .from(TABLE)
    .update({
      status: "failed",
      failed_at: timestamp,
      error_code: details.code,
      error_message: details.message,
      response_payload: responsePayload,
      updated_at: timestamp,
    })
    .eq("id", deliveryId);
  if (updateError) {
    console.error("[whatsapp-delivery] falha nao gravada:", updateError.message);
    return;
  }
  await appendEvent(sb, deliveryId, "failed", "send_failed", {
    code: details.code,
    message: details.message,
    ...responsePayload,
  }, "send_failed");
}

const STATUS_RANK: Record<WhatsAppDeliveryStatus, number> = {
  queued: 0,
  sending: 1,
  accepted: 2,
  unknown: 2,
  sent: 3,
  delivered: 4,
  read: 5,
  failed: 6,
};

export async function applyTrackedWhatsAppStatus(
  sb: SupabaseClient,
  externalId: string,
  status: WhatsAppDeliveryStatus,
  payload: Record<string, unknown> = {},
): Promise<boolean> {
  const { data: row, error: findError } = await sb
    .from(TABLE)
    .select("id, status")
    .eq("external_id", externalId)
    .maybeSingle();
  if (findError) {
    if (!isTableUnavailable(findError)) {
      console.warn("[whatsapp-delivery] busca webhook:", findError.message);
    }
    return false;
  }
  if (!row?.id) return false;

  const current = String(row.status || "queued") as WhatsAppDeliveryStatus;
  const terminalFailure = current === "failed" && status !== "read" && status !== "delivered";
  const downgrade = STATUS_RANK[status] < STATUS_RANK[current] && current !== "unknown";
  const timestamp = now();
  const patch: Record<string, unknown> = {
    last_webhook_at: timestamp,
    updated_at: timestamp,
  };

  if (!terminalFailure && !downgrade) {
    patch.status = status;
    if (status === "sent") patch.sent_at = timestamp;
    if (status === "delivered") patch.delivered_at = timestamp;
    if (status === "read") patch.read_at = timestamp;
    if (status === "failed") {
      patch.failed_at = timestamp;
      patch.error_code = safeText(payload.errorCode, 80);
      patch.error_message = safeText(payload.errorMessage, 1000);
    }
  }

  const { error } = await sb.from(TABLE).update(patch).eq("id", row.id);
  if (error) {
    console.warn("[whatsapp-delivery] atualizacao webhook:", error.message);
    return false;
  }

  await appendEvent(
    sb,
    String(row.id),
    status,
    "meta_webhook",
    payload,
    `webhook:${externalId}:${status}`,
  );
  return true;
}

export async function markStaleWhatsAppDeliveries(sb: SupabaseClient): Promise<number> {
  const timestamp = now();
  const queuedCutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  const acceptedCutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  let changed = 0;

  const staleGroups = [
    { statuses: ["queued", "sending"], cutoff: queuedCutoff, reason: "processamento_sem_resposta" },
    { statuses: ["accepted"], cutoff: acceptedCutoff, reason: "meta_sem_webhook" },
  ];

  for (const group of staleGroups) {
    const { data, error } = await sb
      .from(TABLE)
      .select("id")
      .in("status", group.statuses)
      .lt("updated_at", group.cutoff)
      .limit(500);
    if (error) {
      if (!isTableUnavailable(error)) console.warn("[whatsapp-delivery] watchdog:", error.message);
      continue;
    }
    const ids = (data || []).map((row) => String(row.id)).filter(Boolean);
    if (!ids.length) continue;
    const { error: updateError } = await sb
      .from(TABLE)
      .update({ status: "unknown", error_message: group.reason, updated_at: timestamp })
      .in("id", ids);
    if (updateError) {
      console.warn("[whatsapp-delivery] watchdog update:", updateError.message);
      continue;
    }
    changed += ids.length;
    await Promise.all(ids.map((id) => appendEvent(
      sb,
      id,
      "unknown",
      "watchdog_timeout",
      { reason: group.reason },
      `watchdog:${group.reason}`,
    )));
  }

  return changed;
}

export function startWhatsAppDeliveryWatchdog(sb: SupabaseClient): void {
  if (watchdogStarted || process.env.NODE_ENV === "test") return;
  watchdogStarted = true;
  const run = () => void markStaleWhatsAppDeliveries(sb).catch((error) => {
    console.warn("[whatsapp-delivery] watchdog exception:", error instanceof Error ? error.message : error);
  });
  const timer = setInterval(run, 5 * 60_000);
  timer.unref?.();
  setTimeout(run, 15_000).unref?.();
}
