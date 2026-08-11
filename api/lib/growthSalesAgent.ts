import type { SupabaseClient } from "@supabase/supabase-js";
import { generateSalesReply } from "./growthGemini.js";
import { replyAdminInboxMessage } from "./adminWhatsAppInbox.js";
import { resolvePremiumAmountLabel } from "./plansCatalog.js";

function optedOut(text: string): boolean {
  const value = String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(sair|pare|parar|remover|nao quero|nao envie|sem interesse|cancelar mensagens)\b/.test(value);
}

function nextStage(text: string): string {
  const value = String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/cadastro|testar|teste|quero conhecer|demonstracao|demonstração/.test(value)) return "interessado";
  if (/preco|preço|valor|plano|mensalidade/.test(value)) return "avaliando";
  return "conversa";
}

export async function handleGrowthInboundAutoReply(
  sb: SupabaseClient,
  input: { phone: string; inboundBody: string; inboundAt: string },
): Promise<{ handled: boolean; replied: boolean; reason?: string }> {
  if (String(process.env.GROWTH_AI_SALES_ENABLED || "false").toLowerCase() !== "true") {
    return { handled: false, replied: false, reason: "disabled" };
  }
  const { data: prospect, error: prospectError } = await sb
    .from("growth_prospects")
    .select("*")
    .eq("phone_e164", input.phone)
    .maybeSingle();
  if (prospectError || !prospect || prospect.ai_sales_enabled === false || prospect.status === "cliente") {
    return { handled: false, replied: false, reason: "not_growth_prospect" };
  }
  if (optedOut(input.inboundBody)) {
    await sb.from("growth_prospects").update({
      opt_out_at: input.inboundAt,
      consent_at: prospect.consent_at || input.inboundAt,
      consent_source: prospect.consent_source || "mensagem iniciada pelo contato",
      outreach_status: "opted_out",
      status: "bloqueado",
      ai_sales_enabled: false,
      ai_sales_stage: "opt_out",
      updated_at: new Date().toISOString(),
    }).eq("id", prospect.id);
    return { handled: true, replied: false, reason: "opt_out" };
  }

  const { data: conversation } = await sb
    .from("admin_whatsapp_conversations")
    .select("id,contact_name")
    .eq("phone_e164", input.phone)
    .maybeSingle();
  if (!conversation?.id) return { handled: true, replied: false, reason: "conversation_missing" };
  const { data: newerOutbound } = await sb
    .from("admin_whatsapp_messages")
    .select("id")
    .eq("conversation_id", conversation.id)
    .eq("direction", "outbound")
    .gte("created_at", input.inboundAt)
    .limit(1);
  if (newerOutbound?.length) return { handled: true, replied: false, reason: "already_replied" };

  const { data: history, error: historyError } = await sb
    .from("admin_whatsapp_messages")
    .select("direction,body,created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(16);
  if (historyError) throw historyError;
  const price = await resolvePremiumAmountLabel(sb);
  const registrationUrl = `${String(process.env.APP_PUBLIC_URL || "https://axecloud.com.br").replace(/\/$/, "")}/cadastro`;
  const reply = await generateSalesReply({
    terreiroNome: String(prospect.terreiro_nome),
    contactName: conversation.contact_name,
    history: [...(history || [])].reverse(),
    monthlyPriceLabel: price,
    registrationUrl,
  });
  await replyAdminInboxMessage(sb, conversation.id, reply);
  const now = new Date().toISOString();
  await sb.from("growth_prospects").update({
    consent_at: prospect.consent_at || input.inboundAt,
    consent_source: prospect.consent_source || "mensagem iniciada pelo contato",
    outreach_status: "replied",
    status: nextStage(input.inboundBody) === "interessado" ? "qualificado" : "respondeu",
    ai_sales_stage: nextStage(input.inboundBody),
    ai_last_reply_at: now,
    updated_at: now,
  }).eq("id", prospect.id);
  await sb.from("growth_outreach_events").insert({
    prospect_id: prospect.id,
    event_type: "ai_sales_reply",
    payload: { conversationId: conversation.id, stage: nextStage(input.inboundBody) },
  });
  return { handled: true, replied: true };
}
