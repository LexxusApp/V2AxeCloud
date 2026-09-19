import type { MetaTemplateComponent } from "../../src/services/evolution.service.js";
import {
  acceptWhatsAppDelivery,
  beginWhatsAppDelivery,
  failWhatsAppDelivery,
  type WhatsAppDeliveryContext,
} from "./whatsappDeliveryTracking.js";

function metaToken(): string {
  return String(process.env.WA_META_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || "").trim();
}

function phoneNumberId(): string {
  return String(process.env.WA_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID || "").trim();
}
function inferTemplateSource(templateName: string, explicit?: string): string {
  if (explicit) return explicit;
  const name = String(templateName || "").toLowerCase();
  if (/reivind|claim/.test(name)) return "directory_claim";
  if (/boas.?vindas|welcome/.test(name)) return "welcome";
  if (/cobranca|mensalidade|assinatura|pagamento/.test(name)) return "billing";
  if (/gira|evento|lembrete/.test(name)) return "calendar";
  if (/acesso|senha|cadastro/.test(name)) return "credentials";
  if (/prospec|radar|marketing/.test(name)) return "growth";
  return "meta_template";
}

function graphVersion(): string {
  return String(process.env.WA_BUSINESS_VERSION || process.env.META_WHATSAPP_API_VERSION || "v21.0").trim();
}

export function isMetaCloudDirectConfigured(): boolean {
  return Boolean(metaToken() && phoneNumberId());
}

/** Envia template aprovado direto na Graph API (Meta Cloud), sem passar pela Evolution. */
export async function sendMetaCloudTemplate(
  phoneDigits: string,
  templateName: string,
  language: string,
  components: MetaTemplateComponent[],
  tracking: WhatsAppDeliveryContext = {},
): Promise<{ messageId?: string; deliveryId?: string }> {
  const to = String(phoneDigits).replace(/\D/g, "");
  if (!to) throw new Error("Número inválido para envio WhatsApp.");
  const tracked = await beginWhatsAppDelivery({
    ...tracking,
    source: inferTemplateSource(templateName, tracking.source),
    recipientPhone: to,
    messageKind: "template",
    templateName,
    templateLanguage: language,
    requestPayload: { templateName, language, components },
  });
  if (tracked?.duplicate && tracked.externalId) {
    return { messageId: tracked.externalId, deliveryId: tracked.id };
  }

  const token = metaToken();
  const fromId = phoneNumberId();
  if (!token || !fromId) {
    const error = new Error("Meta Cloud API não configurada (WA_META_TOKEN / WA_PHONE_NUMBER_ID).");
    await failWhatsAppDelivery(tracked?.id, error);
    throw error;
  }

  const url = `https://graph.facebook.com/${graphVersion()}/${fromId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: { name: templateName, language: { code: language }, components },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: { message?: string } }).error?.message || JSON.stringify(data))
        : `Falha Meta Cloud (${res.status})`;
    const error = new Error(message);
    await failWhatsAppDelivery(tracked?.id, error, {
      httpStatus: res.status,
      meta: data as Record<string, unknown>,
    });
    throw error;
  }
  const messageId =
    data && typeof data === "object" && Array.isArray((data as { messages?: Array<{ id?: string }> }).messages)
      ? String((data as { messages: Array<{ id?: string }> }).messages[0]?.id || "")
      : undefined;
  await acceptWhatsAppDelivery(tracked?.id, messageId, {
    httpStatus: res.status,
    meta: data as Record<string, unknown>,
  });
  return { messageId: messageId || undefined, deliveryId: tracked?.id };
}
/** Mensagem de texto livre (sessão 24h ou janela aberta pelo destinatário). */
export async function sendMetaCloudText(
  phoneDigits: string,
  text: string,
  tracking: WhatsAppDeliveryContext = {},
): Promise<{ messageId?: string; deliveryId?: string }> {
  const to = String(phoneDigits).replace(/\D/g, "");
  if (!to) throw new Error("Número inválido para envio WhatsApp.");
  const bodyText = String(text || "").trim();
  if (!bodyText) throw new Error("Mensagem vazia para envio WhatsApp.");

  const tracked = await beginWhatsAppDelivery({
    ...tracking,
    source: tracking.source || "meta_text",
    recipientPhone: to,
    messageKind: "text",
    requestPayload: { text: bodyText.slice(0, 4096) },
  });
  if (tracked?.duplicate && tracked.externalId) {
    return { messageId: tracked.externalId, deliveryId: tracked.id };
  }

  const token = metaToken();
  const fromId = phoneNumberId();
  if (!token || !fromId) {
    const error = new Error("Meta Cloud API não configurada (WA_META_TOKEN / WA_PHONE_NUMBER_ID).");
    await failWhatsAppDelivery(tracked?.id, error);
    throw error;
  }

  const url = `https://graph.facebook.com/${graphVersion()}/${fromId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: bodyText.slice(0, 4096), preview_url: false },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errObj =
      data && typeof data === "object" && "error" in data
        ? (data as { error?: { message?: string; code?: number } }).error
        : undefined;
    const message = String(errObj?.message || JSON.stringify(data) || `Falha Meta Cloud (${res.status})`);
    const error = new Error(message) as Error & { metaCode?: number };
    if (typeof errObj?.code === "number") error.metaCode = errObj.code;
    await failWhatsAppDelivery(tracked?.id, error, {
      httpStatus: res.status,
      meta: data as Record<string, unknown>,
    });
    throw error;
  }
  const messageId =
    data && typeof data === "object" && Array.isArray((data as { messages?: Array<{ id?: string }> }).messages)
      ? String((data as { messages: Array<{ id?: string }> }).messages[0]?.id || "")
      : undefined;
  await acceptWhatsAppDelivery(tracked?.id, messageId, {
    httpStatus: res.status,
    meta: data as Record<string, unknown>,
  });
  return { messageId: messageId || undefined, deliveryId: tracked?.id };
}
/** Meta bloqueia texto livre fora da janela de 24h — usar template como fallback. */
export function isTemplateRequiredMetaError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err || "").toLowerCase();
  const code =
    err && typeof err === "object" && "metaCode" in err
      ? Number((err as { metaCode?: number }).metaCode)
      : NaN;
  if (code === 131047 || code === 131026 || code === 470) return true;
  return (
    msg.includes("131047") ||
    msg.includes("131026") ||
    msg.includes("24 hour") ||
    msg.includes("24-hour") ||
    msg.includes("re-engagement") ||
    msg.includes("outside the allowed window") ||
    (msg.includes("template") && msg.includes("required"))
  );
}
