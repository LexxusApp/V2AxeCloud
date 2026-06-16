import type { MetaTemplateComponent } from "../../src/services/evolution.service.js";

function metaToken(): string {
  return String(process.env.WA_META_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || "").trim();
}

function phoneNumberId(): string {
  return String(process.env.WA_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID || "").trim();
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
  components: MetaTemplateComponent[]
): Promise<{ messageId?: string }> {
  const token = metaToken();
  const fromId = phoneNumberId();
  if (!token || !fromId) {
    throw new Error("Meta Cloud API não configurada (WA_META_TOKEN / WA_PHONE_NUMBER_ID).");
  }

  const to = String(phoneDigits).replace(/\D/g, "");
  if (!to) throw new Error("Número inválido para envio WhatsApp.");

  const url = `https://graph.facebook.com/${graphVersion()}/${fromId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: { message?: string } }).error?.message || JSON.stringify(data))
        : `Falha Meta Cloud (${res.status})`;
    throw new Error(err);
  }

  const messageId =
    data && typeof data === "object" && Array.isArray((data as { messages?: Array<{ id?: string }> }).messages)
      ? String((data as { messages: Array<{ id?: string }> }).messages[0]?.id || "")
      : undefined;

  return { messageId: messageId || undefined };
}

/** Mensagem de texto livre (sessão 24h ou janela aberta pelo destinatário). */
export async function sendMetaCloudText(
  phoneDigits: string,
  text: string
): Promise<{ messageId?: string }> {
  const token = metaToken();
  const fromId = phoneNumberId();
  if (!token || !fromId) {
    throw new Error("Meta Cloud API não configurada (WA_META_TOKEN / WA_PHONE_NUMBER_ID).");
  }

  const to = String(phoneDigits).replace(/\D/g, "");
  if (!to) throw new Error("Número inválido para envio WhatsApp.");

  const bodyText = String(text || "").trim();
  if (!bodyText) throw new Error("Mensagem vazia para envio WhatsApp.");

  const url = `https://graph.facebook.com/${graphVersion()}/${fromId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: bodyText.slice(0, 4096), preview_url: false },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errObj =
      data && typeof data === "object" && "error" in data
        ? (data as { error?: { message?: string; code?: number } }).error
        : undefined;
    const err = String(errObj?.message || JSON.stringify(data) || `Falha Meta Cloud (${res.status})`);
    const wrapped = new Error(err) as Error & { metaCode?: number };
    if (typeof errObj?.code === "number") wrapped.metaCode = errObj.code;
    throw wrapped;
  }

  const messageId =
    data && typeof data === "object" && Array.isArray((data as { messages?: Array<{ id?: string }> }).messages)
      ? String((data as { messages: Array<{ id?: string }> }).messages[0]?.id || "")
      : undefined;

  return { messageId: messageId || undefined };
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
