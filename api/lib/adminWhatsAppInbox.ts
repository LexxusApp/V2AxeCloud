import type { SupabaseClient } from "@supabase/supabase-js";
import { isMetaCloudDirectConfigured, sendMetaCloudText } from "./metaCloudSend.js";
import { isMetaCloudWebhookPayload } from "./whatsappMetaWebhook.js";

export function normalizeInboxPhone(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}

function previewText(body: string, max = 120): string {
  const t = String(body || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function extractInboundBody(msg: Record<string, unknown>): { body: string; messageType: string } {
  const type = String(msg.type || "text").toLowerCase();
  if (type === "text") {
    const text = msg.text && typeof msg.text === "object" ? (msg.text as { body?: string }).body : "";
    return { body: String(text || "").trim(), messageType: "text" };
  }
  if (type === "button") {
    const btn = msg.button && typeof msg.button === "object" ? (msg.button as { text?: string; payload?: string }) : {};
    return { body: String(btn.text || btn.payload || "[botão]").trim(), messageType: "button" };
  }
  if (type === "interactive") {
    const interactive = msg.interactive && typeof msg.interactive === "object" ? (msg.interactive as Record<string, unknown>) : {};
    const buttonReply =
      interactive.button_reply && typeof interactive.button_reply === "object"
        ? (interactive.button_reply as { title?: string })
        : null;
    const listReply =
      interactive.list_reply && typeof interactive.list_reply === "object"
        ? (interactive.list_reply as { title?: string })
        : null;
    const title = buttonReply?.title || listReply?.title || "[interativo]";
    return { body: String(title).trim(), messageType: "interactive" };
  }
  if (type === "image") return { body: "[imagem]", messageType: "image" };
  if (type === "audio") return { body: "[áudio]", messageType: "audio" };
  if (type === "video") return { body: "[vídeo]", messageType: "video" };
  if (type === "document") return { body: "[documento]", messageType: "document" };
  if (type === "sticker") return { body: "[sticker]", messageType: "sticker" };
  if (type === "location") return { body: "[localização]", messageType: "location" };
  if (type === "contacts") return { body: "[contato]", messageType: "contacts" };
  if (type === "reaction") {
    const reaction = msg.reaction && typeof msg.reaction === "object" ? (msg.reaction as { emoji?: string }) : {};
    return { body: String(reaction.emoji || "[reação]").trim(), messageType: "reaction" };
  }
  return { body: `[${type}]`, messageType: type || "unknown" };
}

export type MetaInboundMessage = {
  from: string;
  contactName: string;
  externalId: string;
  timestampMs: number;
  body: string;
  messageType: string;
  raw: Record<string, unknown>;
};

export function extractMetaInboundMessages(body: unknown): MetaInboundMessage[] {
  const out: MetaInboundMessage[] = [];
  if (!isMetaCloudWebhookPayload(body)) return out;
  const entries = (body as { entry?: unknown[] }).entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = entry && typeof entry === "object" ? (entry as { changes?: unknown[] }).changes : undefined;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value =
        change && typeof change === "object"
          ? (change as {
              value?: {
                messages?: unknown[];
                contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
              };
            }).value
          : undefined;
      const messages = value?.messages;
      if (!Array.isArray(messages) || messages.length === 0) continue;

      const contacts = Array.isArray(value?.contacts) ? value!.contacts! : [];
      const nameByWa = new Map<string, string>();
      for (const c of contacts) {
        const wa = normalizeInboxPhone(String(c?.wa_id || ""));
        const name = String(c?.profile?.name || "").trim();
        if (wa && name) nameByWa.set(wa, name);
      }

      for (const rawMsg of messages) {
        if (!rawMsg || typeof rawMsg !== "object") continue;
        const msg = rawMsg as Record<string, unknown>;
        const from = normalizeInboxPhone(String(msg.from || ""));
        const externalId = String(msg.id || "").trim();
        if (!from || !externalId) continue;
        const tsSec = Number(msg.timestamp);
        const timestampMs = Number.isFinite(tsSec) && tsSec > 0 ? tsSec * 1000 : Date.now();
        const { body: textBody, messageType } = extractInboundBody(msg);
        out.push({
          from,
          contactName: nameByWa.get(from) || "",
          externalId,
          timestampMs,
          body: textBody || `[${messageType}]`,
          messageType,
          raw: msg,
        });
      }
    }
  }
  return out;
}

export async function storeMetaInboundMessages(sb: SupabaseClient, body: unknown): Promise<number> {
  const events = extractMetaInboundMessages(body);
  let stored = 0;

  for (const event of events) {
    const { data: existingMsg } = await sb
      .from("admin_whatsapp_messages")
      .select("id")
      .eq("external_id", event.externalId)
      .maybeSingle();
    if (existingMsg?.id) continue;

    const nowIso = new Date(event.timestampMs).toISOString();
    let conversationId: string | null = null;

    const { data: existingConv } = await sb
      .from("admin_whatsapp_conversations")
      .select("id, unread_count, contact_name")
      .eq("phone_e164", event.from)
      .maybeSingle();

    if (existingConv?.id) {
      conversationId = existingConv.id;
      const patch: Record<string, unknown> = {
        last_message_at: nowIso,
        last_message_preview: previewText(event.body),
        unread_count: Number(existingConv.unread_count || 0) + 1,
        status: "open",
        updated_at: new Date().toISOString(),
      };
      if (event.contactName && !existingConv.contact_name) {
        patch.contact_name = event.contactName;
      }
      await sb.from("admin_whatsapp_conversations").update(patch).eq("id", conversationId);
    } else {
      const { data: created, error: createErr } = await sb
        .from("admin_whatsapp_conversations")
        .insert({
          phone_e164: event.from,
          contact_name: event.contactName || null,
          last_message_at: nowIso,
          last_message_preview: previewText(event.body),
          unread_count: 1,
          status: "open",
        })
        .select("id")
        .single();
      if (createErr || !created?.id) {
        console.warn("[WHATSAPP INBOX] falha ao criar conversa:", createErr?.message || createErr);
        continue;
      }
      conversationId = created.id;
    }

    const { error: msgErr } = await sb.from("admin_whatsapp_messages").insert({
      conversation_id: conversationId,
      direction: "inbound",
      body: event.body,
      message_type: event.messageType,
      external_id: event.externalId,
      status: "received",
      raw_payload: event.raw,
      created_at: nowIso,
    });
    if (msgErr) {
      if (String(msgErr.code || "") === "23505") continue;
      console.warn("[WHATSAPP INBOX] falha ao salvar mensagem:", msgErr.message);
      continue;
    }
    stored += 1;
  }

  return stored;
}

/** Atualiza status de mensagens outbound da inbox (e whatsapp_logs) pelo wamid. */
export async function applyAdminInboxDeliveryStatus(
  sb: SupabaseClient,
  externalId: string,
  status: string
): Promise<void> {
  const mapped = String(status || "").toLowerCase();
  if (!externalId || !mapped) return;
  await sb
    .from("admin_whatsapp_messages")
    .update({ status: mapped })
    .eq("external_id", externalId)
    .eq("direction", "outbound");
}

export async function listAdminInboxConversations(
  sb: SupabaseClient,
  opts?: { status?: "open" | "archived" | "all"; limit?: number }
) {
  const limit = Math.min(Math.max(Number(opts?.limit) || 50, 1), 200);
  let q = sb
    .from("admin_whatsapp_conversations")
    .select("id, phone_e164, contact_name, last_message_at, last_message_preview, unread_count, status, created_at")
    .order("last_message_at", { ascending: false })
    .limit(limit);
  if (opts?.status === "open" || opts?.status === "archived") {
    q = q.eq("status", opts.status);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function listAdminInboxMessages(
  sb: SupabaseClient,
  conversationId: string,
  opts?: { limit?: number }
) {
  const limit = Math.min(Math.max(Number(opts?.limit) || 100, 1), 500);
  const { data, error } = await sb
    .from("admin_whatsapp_messages")
    .select("id, conversation_id, direction, body, message_type, external_id, status, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function markAdminInboxRead(sb: SupabaseClient, conversationId: string): Promise<void> {
  const { error } = await sb
    .from("admin_whatsapp_conversations")
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) throw error;
}

export async function archiveAdminInboxConversation(
  sb: SupabaseClient,
  conversationId: string,
  archived: boolean
): Promise<void> {
  const { error } = await sb
    .from("admin_whatsapp_conversations")
    .update({
      status: archived ? "archived" : "open",
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
  if (error) throw error;
}

export async function replyAdminInboxMessage(
  sb: SupabaseClient,
  conversationId: string,
  text: string
): Promise<{ messageId?: string }> {
  const body = String(text || "").trim();
  if (!body) throw new Error("Mensagem vazia.");
  if (body.length > 4096) throw new Error("Mensagem muito longa (máx. 4096).");
  if (!isMetaCloudDirectConfigured()) {
    throw new Error("Meta Cloud API não configurada (WA_META_TOKEN / WA_PHONE_NUMBER_ID).");
  }

  const { data: conv, error: convErr } = await sb
    .from("admin_whatsapp_conversations")
    .select("id, phone_e164")
    .eq("id", conversationId)
    .maybeSingle();
  if (convErr) throw convErr;
  if (!conv?.phone_e164) throw new Error("Conversa não encontrada.");

  const out = await sendMetaCloudText(conv.phone_e164, body);
  const nowIso = new Date().toISOString();

  await sb.from("admin_whatsapp_messages").insert({
    conversation_id: conversationId,
    direction: "outbound",
    body,
    message_type: "text",
    external_id: out.messageId || null,
    status: "sent",
    created_at: nowIso,
  });

  await sb
    .from("admin_whatsapp_conversations")
    .update({
      last_message_at: nowIso,
      last_message_preview: previewText(body),
      status: "open",
      updated_at: nowIso,
    })
    .eq("id", conversationId);

  return out;
}
