import type { SupabaseClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Verify Token do painel Meta (GET hub.challenge). */
export function resolveMetaWebhookVerifyToken(): string {
  return String(
    process.env.WA_BUSINESS_TOKEN_WEBHOOK ||
      process.env.WA_META_WEBHOOK_VERIFY_TOKEN ||
      process.env.WHATSAPP_WEBHOOK_SECRET ||
      ""
  ).trim();
}

export function resolveMetaAppSecret(): string {
  return String(process.env.WA_META_APP_SECRET || process.env.META_APP_SECRET || "").trim();
}

export function isMetaCloudWebhookPayload(body: unknown): boolean {
  return Boolean(
    body &&
      typeof body === "object" &&
      (body as { object?: string }).object === "whatsapp_business_account"
  );
}

/** Responde o desafio de assinatura do webhook Meta (GET). */
export function handleMetaWebhookChallenge(query: Record<string, unknown>): {
  ok: boolean;
  challenge?: string;
  status: number;
} {
  const mode = String(query["hub.mode"] || query.hub_mode || "").trim();
  const token = String(query["hub.verify_token"] || query.hub_verify_token || "").trim();
  const challenge = String(query["hub.challenge"] || query.hub_challenge || "").trim();
  const expected = resolveMetaWebhookVerifyToken();
  if (mode !== "subscribe" || !expected || !token || token !== expected || !challenge) {
    return { ok: false, status: 403 };
  }
  return { ok: true, challenge, status: 200 };
}

/** Valida X-Hub-Signature-256 quando META_APP_SECRET estiver configurado. */
export function verifyMetaWebhookSignature(
  rawBody: string | Buffer | undefined,
  signatureHeader: string | string[] | undefined
): boolean {
  const secret = resolveMetaAppSecret();
  if (!secret) return true; // sem secret: confiar no shape do payload (configure META_APP_SECRET em produção)
  const header = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  const provided = String(header || "").trim();
  if (!provided.startsWith("sha256=")) return false;
  const raw = typeof rawBody === "string" ? rawBody : rawBody ? rawBody.toString("utf8") : "";
  if (!raw) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

type MetaStatusEvent = {
  id: string;
  status: string;
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>;
};

function mapMetaStatus(status: string): string {
  const s = String(status || "").toLowerCase();
  if (s === "delivered") return "delivered";
  if (s === "read") return "read";
  if (s === "failed") return "failed";
  if (s === "deleted") return "failed";
  if (s === "sent") return "sent";
  return s || "sent";
}

function formatMetaStatusError(errors: MetaStatusEvent["errors"]): string {
  if (!errors?.length) return "";
  return errors
    .map((e) => {
      const code = e.code != null ? `#${e.code}` : "";
      const title = String(e.title || e.message || "").trim();
      const details = String(e.error_data?.details || "").trim();
      return [code, title, details].filter(Boolean).join(" — ");
    })
    .filter(Boolean)
    .join("; ");
}

export function extractMetaStatusEvents(body: unknown): MetaStatusEvent[] {
  const out: MetaStatusEvent[] = [];
  if (!isMetaCloudWebhookPayload(body)) return out;
  const entries = (body as { entry?: unknown[] }).entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    const changes = entry && typeof entry === "object" ? (entry as { changes?: unknown[] }).changes : undefined;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value =
        change && typeof change === "object" ? (change as { value?: { statuses?: unknown[] } }).value : undefined;
      const statuses = value?.statuses;
      if (!Array.isArray(statuses)) continue;
      for (const st of statuses) {
        if (!st || typeof st !== "object") continue;
        const id = String((st as MetaStatusEvent).id || "").trim();
        const status = String((st as MetaStatusEvent).status || "").trim();
        if (!id || !status) continue;
        out.push({
          id,
          status,
          errors: Array.isArray((st as MetaStatusEvent).errors) ? (st as MetaStatusEvent).errors : undefined,
        });
      }
    }
  }
  return out;
}

/** Atualiza whatsapp_logs a partir de statuses do webhook Meta Cloud. */
export async function applyMetaCloudStatusUpdates(
  sb: SupabaseClient,
  body: unknown
): Promise<number> {
  const events = extractMetaStatusEvents(body);
  let updated = 0;
  for (const event of events) {
    const mapped = mapMetaStatus(event.status);
    const errText = formatMetaStatusError(event.errors);
    const patch: { status: string; mensagem?: string } = { status: mapped };

    if (mapped === "failed" && errText) {
      const { data: row } = await sb
        .from("whatsapp_logs")
        .select("mensagem")
        .eq("external_id", event.id)
        .maybeSingle();
      const prev = String(row?.mensagem || "").trim();
      const marker = `[meta:falha ${errText}]`;
      if (!prev.includes(marker)) {
        patch.mensagem = prev ? `${prev}\n\n${marker}` : marker;
      }
    }

    const { error } = await sb.from("whatsapp_logs").update(patch).eq("external_id", event.id);
    if (error) {
      console.warn("[WHATSAPP] webhook Meta update falhou:", error.message);
    } else {
      updated += 1;
      if (mapped === "failed") {
        console.error(`[WHATSAPP] Meta status failed wamid=${event.id.slice(0, 24)}… ${errText || "(sem detalhe)"}`);
      }
    }

    // Também atualiza mensagens outbound da caixa do admin (mesmo wamid).
    try {
      const { applyAdminInboxDeliveryStatus } = await import("./adminWhatsAppInbox.js");
      await applyAdminInboxDeliveryStatus(sb, event.id, mapped);
    } catch {
      /* tabela pode ainda não existir */
    }
  }
  return updated;
}

/** Processa statuses + mensagens inbound do webhook Meta. */
export async function processMetaCloudWebhook(
  sb: SupabaseClient,
  body: unknown
): Promise<{ statuses: number; inbound: number }> {
  const statuses = await applyMetaCloudStatusUpdates(sb, body);
  let inbound = 0;
  try {
    const { storeMetaInboundMessages } = await import("./adminWhatsAppInbox.js");
    inbound = await storeMetaInboundMessages(sb, body);
  } catch (err) {
    console.warn(
      "[WHATSAPP INBOX] store inbound falhou:",
      err instanceof Error ? err.message : err
    );
  }
  if (inbound > 0) {
    console.log(`[WHATSAPP INBOX] ${inbound} mensagem(ns) recebida(s)`);
  }
  return { statuses, inbound };
}
