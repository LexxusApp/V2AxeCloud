import type { SupabaseClient } from "@supabase/supabase-js";
import { isMetaCloudDirectConfigured, sendMetaCloudText } from "./metaCloudSend.js";
import { normalizeInboxPhone } from "./adminWhatsAppInbox.js";

const OFFICIAL_REPLY_TEXT = `Axé! 🙏 O AxéCloud organiza fichas dos filhos, obrigações litúrgicas, mensalidades com Pix no WhatsApp e aviso de giras. Entre muitos outros Módulos.

Liberei 30 dias grátis para você testar sem cartão:
👉 Crie seu terreiro em 1 minuto: https://axecloud.com.br/register

Ou se preferir, me manda aqui seu e-mail e o nome da casa que eu já gero seu acesso por aqui mesmo!`;

/**
 * Detecta se a mensagem recebida é um clique no botão "Quero conhecer"
 * ou texto equivalente de interesse inicial de prospecção.
 */
export function isQueroConhecerMessage(body: string): boolean {
  const text = String(body || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return (
    text === "quero conhecer" ||
    text.startsWith("quero conhecer") ||
    text.includes("quero conhecer") ||
    text === "quero saber mais" ||
    text === "como funciona" ||
    text.includes("ativar 30 dias") ||
    text.includes("30 dias gratis") ||
    text.includes("ativar teste") ||
    text === "quero" ||
    text === "sim" ||
    text.includes("quero testar")
  );
}

/**
 * Handler síncrono e nativo para responder imediatamente quando um dirigente
 * clica no botão "Quero conhecer" da prospecção oficial.
 */
export async function handleQueroConhecerInbound(
  sb: SupabaseClient,
  inbound: { from: string; body: string; messageType?: string; externalId?: string }
): Promise<{ handled: boolean; messageId?: string }> {
  if (!isQueroConhecerMessage(inbound.body)) {
    return { handled: false };
  }

  const phone = normalizeInboxPhone(inbound.from);
  if (!phone) return { handled: false };

  // 1. Evita responder se o número já for filho de santo ou zelador com terreiro ativo
  const last8 = phone.slice(-8);
  const { data: existingLeader } = await sb
    .from("perfil_lider")
    .select("id")
    .ilike("whatsapp", `%${last8}%`)
    .limit(1);

  if (existingLeader && existingLeader.length > 0) {
    console.log(`[QUERO CONHECER] Telefone ${phone} já é líder cadastrado. Ignorando resposta fria.`);
    return { handled: false };
  }

  // 2. Trava de Idempotência: não reenviar se já enviamos a mensagem de introdução nas últimas 6 horas
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: conv } = await sb
    .from("admin_whatsapp_conversations")
    .select("id")
    .eq("phone_e164", phone)
    .maybeSingle();

  if (conv?.id) {
    const { data: recentReplies } = await sb
      .from("admin_whatsapp_messages")
      .select("id")
      .eq("conversation_id", conv.id)
      .eq("direction", "outbound")
      .gte("created_at", sixHoursAgo)
      .ilike("body", "%AxéCloud organiza fichas dos filhos%")
      .limit(1);

    if (recentReplies && recentReplies.length > 0) {
      console.log(`[QUERO CONHECER] Resposta recente já enviada para ${phone} nas últimas 6h. Evitando duplicação.`);
      return { handled: true };
    }
  }

  // 3. Disparo imediato via Meta Cloud API oficial
  if (!isMetaCloudDirectConfigured()) {
    console.warn("[QUERO CONHECER] Meta Cloud API direta não configurada.");
    return { handled: false };
  }

  try {
    const sendRes = await sendMetaCloudText(phone, OFFICIAL_REPLY_TEXT);
    const messageId = sendRes.messageId;
    console.log(`[QUERO CONHECER] Resposta automática enviada com sucesso para ${phone} (wamid: ${messageId})`);

    const nowIso = new Date().toISOString();

    // 4. Registra no chat administrativo
    if (conv?.id) {
      await sb.from("admin_whatsapp_messages").insert({
        conversation_id: conv.id,
        direction: "outbound",
        message_type: "text",
        body: OFFICIAL_REPLY_TEXT,
        external_id: messageId,
        status: "sent",
        created_at: nowIso,
      });

      await sb
        .from("admin_whatsapp_conversations")
        .update({
          last_message_at: nowIso,
          last_message_preview: OFFICIAL_REPLY_TEXT.slice(0, 140),
          unread_count: 0,
        })
        .eq("id", conv.id);
    }

    // 5. Atualiza o lead no CRM para 'interested'
    const { data: leads } = await sb
      .from("prospecting_leads")
      .select("id")
      .ilike("phone", `%${last8}%`)
      .limit(1);

    if (leads && leads.length > 0) {
      await sb
        .from("prospecting_leads")
        .update({
          status: "interested",
          last_contact_at: nowIso,
        })
        .eq("id", leads[0].id);

      await sb.from("prospecting_events").insert({
        lead_id: leads[0].id,
        event_type: "lead_interested",
        from_status: "contacted",
        to_status: "interested",
        description: "Dirigente clicou em 'Quero conhecer' e recebeu introdução automática com 30 dias grátis",
        metadata: { messageId, phone },
      });
    }

    return { handled: true, messageId };
  } catch (err) {
    console.error(`[QUERO CONHECER] Erro ao enviar resposta automática para ${phone}:`, err);
    return { handled: false };
  }
}
