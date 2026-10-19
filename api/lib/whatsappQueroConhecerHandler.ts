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

/**
 * Extrai o primeiro endereço de e-mail válido de um texto.
 */
export function extractEmailFromText(text: string): string | null {
  const match = String(text || "").match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase().trim() : null;
}

/**
 * Handler síncrono e automático para provisionar conta quando o dirigente
 * responde à prospecção enviando seu e-mail e nome da casa.
 */
export async function handleAutoProvisionInbound(
  sb: SupabaseClient,
  inbound: { from: string; body: string; messageType?: string; externalId?: string }
): Promise<{ handled: boolean; userId?: string; messageId?: string }> {
  const email = extractEmailFromText(inbound.body);
  if (!email) {
    return { handled: false };
  }

  const phone = normalizeInboxPhone(inbound.from);
  if (!phone) return { handled: false };

  const last8 = phone.slice(-8);

  // 1. Busca conversa aberta no WhatsApp Admin para verificar contexto
  const { data: conv } = await sb
    .from("admin_whatsapp_conversations")
    .select("id, contact_name")
    .eq("phone_e164", phone)
    .maybeSingle();

  // 2. Busca o lead no CRM de prospecção
  const { data: leads } = await sb
    .from("prospecting_leads")
    .select("*")
    .ilike("phone", `%${last8}%`)
    .limit(1);

  const lead = leads?.[0];

  // Se não houver lead ou conversa, não provisionar cegamente
  if (!lead && !conv) {
    return { handled: false };
  }

  // 3. Verifica se o usuário já existe no Supabase Auth
  const { data: existingUsers } = await sb.auth.admin.listUsers();
  const alreadyUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  const nowIso = new Date().toISOString();

  if (alreadyUser) {
    const textAlready = `Axé! Identificamos que já existe um acesso cadastrado para o e-mail *${email}*.\n\nVocê pode entrar diretamente em: https://axecloud.com.br/login\n\nCaso tenha esquecido sua senha, use a opção "Esqueci minha senha" na tela de login.`;
    const sendRes = await sendMetaCloudText(phone, textAlready);
    if (conv?.id) {
      await sb.from("admin_whatsapp_messages").insert({
        conversation_id: conv.id,
        direction: "outbound",
        message_type: "text",
        body: textAlready,
        external_id: sendRes.messageId,
        status: "sent",
        created_at: nowIso,
      });
    }
    return { handled: true, userId: alreadyUser.id, messageId: sendRes.messageId };
  }

  // 4. Identifica nome do terreiro e do dirigente
  let nomeTerreiro = lead?.name || conv?.contact_name || "Meu Terreiro";
  const bodyClean = inbound.body.replace(email, "").trim();
  if (bodyClean.length >= 4 && !bodyClean.toLowerCase().includes("email") && !bodyClean.toLowerCase().includes("ola")) {
    nomeTerreiro = bodyClean;
  } else if (conv?.id) {
    const { data: prevMsgs } = await sb
      .from("admin_whatsapp_messages")
      .select("body")
      .eq("conversation_id", conv.id)
      .eq("direction", "inbound")
      .neq("body", inbound.body)
      .order("created_at", { ascending: false })
      .limit(3);

    const prevCandidate = prevMsgs?.find(
      (m) => m.body && m.body.length >= 4 && !extractEmailFromText(m.body) && !m.body.toLowerCase().includes("quero conhecer")
    );
    if (prevCandidate?.body) {
      nomeTerreiro = prevCandidate.body.trim();
    }
  }

  const nomeZelador = conv?.contact_name || lead?.contact_name || "Dirigente";
  const tempPassword = `Axe@2026${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    // 5. Cria usuário no Supabase Auth
    const { data: authCreated, error: authError } = await sb.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        nome_terreiro: nomeTerreiro,
        nome_zelador: nomeZelador,
        whatsapp: `+${phone}`,
        plan: "premium",
        is_trial: true,
        onboarding: "whatsapp_prospecting_auto",
      },
    });

    if (authError) throw authError;

    const userId = authCreated.user?.id;
    if (!userId) throw new Error("ID do usuário retornado vazio.");

    // 6. Cria subscription de 30 dias grátis
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await sb.from("subscriptions").upsert({
      id: userId,
      plan: "premium",
      status: "active",
      expires_at: trialEndsAt,
      billing_cycle: "monthly",
      updated_at: nowIso,
    });

    // 7. Cria perfil_lider
    await sb.from("perfil_lider").upsert({
      id: userId,
      tenant_id: userId,
      email,
      nome_terreiro: nomeTerreiro,
      cargo: nomeZelador,
      role: "admin",
      whatsapp_publico: phone,
      updated_at: nowIso,
    });

    // 8. Reivindica no diretório se houver directory_id
    if (lead?.directory_id) {
      await sb
        .from("terreiros_diretorio")
        .update({
          claimed_by_tenant_id: userId,
          verified_at: nowIso,
          whatsapp_atendimento: `+${phone}`,
          updated_at: nowIso,
        })
        .eq("id", lead.directory_id);
    }

    // 9. Atualiza lead no CRM
    if (lead?.id) {
      await sb
        .from("prospecting_leads")
        .update({
          status: "trial",
          email,
          terreiro_id: userId,
          updated_at: nowIso,
        })
        .eq("id", lead.id);

      await sb.from("prospecting_events").insert({
        lead_id: lead.id,
        event_type: "account_created_auto",
        from_status: lead.status || "interested",
        to_status: "trial",
        description: `Conta criada automaticamente via WhatsApp com e-mail ${email}`,
        metadata: { userId, email, phone },
      });
    }

    // 10. Envia mensagem com credenciais no WhatsApp
    const welcomeMsg = `Axé, ${nomeZelador}! 🙏🌿\n\nJá criamos o seu acesso e liberamos seus 30 dias de teste gratuito no AxéCloud para o *${nomeTerreiro}*:\n\n🔗 *Acesso ao Painel:* https://axecloud.com.br/login\n📧 *Seu E-mail:* ${email}\n🔑 *Sua Senha Provisória:* ${tempPassword}\n\n*(Você pode alterar sua senha a qualquer momento dentro do painel em Minha Conta).*\n\n📘 *Guia de Primeiros Passos:* https://axecloud.com.br/instrucoes\n\nQualquer dúvida para cadastrar os filhos de santo ou cadastrar suas giras, estamos à disposição por aqui!`;

    const sendRes = await sendMetaCloudText(phone, welcomeMsg);
    const messageId = sendRes.messageId;

    if (conv?.id) {
      await sb.from("admin_whatsapp_messages").insert({
        conversation_id: conv.id,
        direction: "outbound",
        message_type: "text",
        body: welcomeMsg,
        external_id: messageId,
        status: "sent",
        created_at: nowIso,
      });

      await sb
        .from("admin_whatsapp_conversations")
        .update({
          last_message_at: nowIso,
          last_message_preview: welcomeMsg.slice(0, 140),
          unread_count: 0,
          updated_at: nowIso,
        })
        .eq("id", conv.id);
    }

    console.log(`[AUTO PROVISION] Conta ${email} provisionada com sucesso para ${phone} (wamid: ${messageId})`);
    return { handled: true, userId, messageId };
  } catch (provErr) {
    console.error(`[AUTO PROVISION] Erro ao auto-provisionar ${email} para ${phone}:`, provErr);
    return { handled: false };
  }
}
