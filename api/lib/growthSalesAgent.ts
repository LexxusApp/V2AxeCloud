import type { SupabaseClient } from "@supabase/supabase-js";
import { generateSalesReply } from "./growthGemini.js";
import { replyAdminInboxMessage } from "./adminWhatsAppInbox.js";
import { resolvePremiumAmountLabel } from "./plansCatalog.js";

function optedOut(text: string): boolean {
  const value = String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(sair|pare|parar|remover|nao quero|nao envie|sem interesse|cancelar mensagens)\b/.test(value);
}

export function nextStage(text: string): string {
  const value = String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/cadastro|testar|teste|quero conhecer|demonstracao|demonstração/.test(value)) return "interessado";
  if (/preco|preço|valor|plano|mensalidade/.test(value)) return "avaliando";
  return "conversa";
}

const STAGE_RANK: Record<string, number> = {
  novo: 0,
  conversa: 1,
  interessado: 2,
  avaliando: 3,
};

export function mergeSalesStage(current: string | null | undefined, inferred: string): string {
  const currentStage = String(current || "novo");
  return (STAGE_RANK[currentStage] ?? 0) >= (STAGE_RANK[inferred] ?? 0) ? currentStage : inferred;
}

export function statusForSalesStage(currentStatus: string | null | undefined, stage: string): string {
  if (currentStatus === "qualificado" || (STAGE_RANK[stage] ?? 0) >= STAGE_RANK.interessado) {
    return "qualificado";
  }
  return "respondeu";
}

export async function handleGrowthInboundAutoReply(
  sb: SupabaseClient,
  input: { phone: string; inboundBody: string; inboundAt: string },
): Promise<{ handled: boolean; replied: boolean; reason?: string }> {
  if (String(process.env.GROWTH_AI_SALES_ENABLED || "true").toLowerCase() === "false") {
    return { handled: false, replied: false, reason: "disabled" };
  }

  let prospect: Record<string, any> | null = null;
  let sourceTable: "growth_prospects" | "prospecting_leads" | "admin_whatsapp_conversations" = "growth_prospects";

  const { data: growthProspect } = await sb
    .from("growth_prospects")
    .select("*")
    .eq("phone_e164", input.phone)
    .maybeSingle();

  if (growthProspect) {
    if (growthProspect.ai_sales_enabled === false || growthProspect.status === "cliente") {
      return { handled: false, replied: false, reason: "disabled_or_client" };
    }
    prospect = growthProspect;
    sourceTable = "growth_prospects";
  } else {
    // Não tratar líderes ativos existentes como prospects comerciais
    const digits = input.phone.replace(/\D/g, "").slice(-8);
    if (digits.length >= 8) {
      const { data: leader } = await sb
        .from("perfil_lider")
        .select("id, nome_terreiro")
        .or(`whatsapp.ilike.%${digits}%,telefone.ilike.%${digits}%`)
        .limit(1)
        .maybeSingle();
      if (leader) {
        return { handled: false, replied: false, reason: "active_leader" };
      }
    }

    // Verificar se o contato está na tabela prospecting_leads
    const { data: lead } = await sb
      .from("prospecting_leads")
      .select("id, name, phone, city, state, status")
      .or(`phone.ilike.%${digits}%,whatsapp.ilike.%${digits}%`)
      .limit(1)
      .maybeSingle();

    if (lead) {
      prospect = {
        id: lead.id,
        phone_e164: input.phone,
        terreiro_nome: lead.name || "seu terreiro",
        status: lead.status || "respondeu",
        ai_sales_enabled: true,
        ai_sales_stage: "novo",
        consent_at: input.inboundAt,
        consent_source: "mensagem iniciada pelo contato",
      };
      sourceTable = "prospecting_leads";
    } else {
      // Verificar em admin_whatsapp_conversations
      const { data: conv } = await sb
        .from("admin_whatsapp_conversations")
        .select("id, contact_name, phone_e164")
        .eq("phone_e164", input.phone)
        .maybeSingle();

      if (conv) {
        prospect = {
          id: conv.id,
          phone_e164: input.phone,
          terreiro_nome: conv.contact_name || "seu terreiro",
          status: "respondeu",
          ai_sales_enabled: true,
          ai_sales_stage: "novo",
          consent_at: input.inboundAt,
          consent_source: "mensagem iniciada pelo contato",
        };
        sourceTable = "admin_whatsapp_conversations";
      }
    }
  }

  if (!prospect) {
    return { handled: false, replied: false, reason: "not_growth_prospect" };
  }

  if (optedOut(input.inboundBody)) {
    if (sourceTable === "growth_prospects") {
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
    } else if (sourceTable === "prospecting_leads") {
      await sb.from("prospecting_leads").update({
        status: "do_not_contact",
        whatsapp_opt_in: false,
        updated_at: new Date().toISOString(),
      }).eq("id", prospect.id);
    }
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

  // Se a mensagem contiver um e-mail, criar a conta e liberar o acesso de 30 dias na hora!
  const emailMatch = input.inboundBody.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    const rawEmail = emailMatch[1].trim().toLowerCase();
    const phoneDigits = input.phone.replace(/\D/g, "");
    const tempPassword = `Axe@${Math.floor(1000 + Math.random() * 9000)}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const terreiroNome = String(prospect.terreiro_nome || "Terreiro").trim();
    const zeladorNome = String(conversation.contact_name || "Zelador").trim();

    try {
      const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
        email: rawEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          nome_terreiro: terreiroNome,
          nome_zelador: zeladorNome,
          whatsapp: phoneDigits,
          onboarding: "chat_auto_onboarding",
          is_trial: true,
          billing_cycle: "monthly",
        },
      });

      if (!authErr && authUser?.user?.id) {
        const userId = authUser.user.id;
        const nowIso = new Date().toISOString();

        await sb.from("perfil_lider").upsert({
          id: userId,
          email: rawEmail,
          nome_terreiro: terreiroNome,
          cargo: zeladorNome,
          role: "admin",
          tenant_id: userId,
          whatsapp: phoneDigits.slice(0, 15) || null,
          whatsapp_publico: phoneDigits.slice(0, 15) || null,
          updated_at: nowIso,
        });

        await sb.from("subscriptions").upsert({
          id: userId,
          plan: "premium",
          status: "active",
          expires_at: expiresAt,
          billing_cycle: "monthly",
          updated_at: nowIso,
        });

        const onboardingReply = `Axé! 🙏 Conta criada com sucesso para o seu terreiro!\n\nSeus dados de acesso aos 30 dias de teste gratuito:\n📧 E-mail: ${rawEmail}\n🔑 Senha temporária: ${tempPassword}\n\n👉 Acesse agora o seu painel: https://axecloud.com.br/entrar\n\nQualquer dúvida no primeiro acesso, pode me chamar por aqui!`;
        await replyAdminInboxMessage(sb, conversation.id, onboardingReply);

        // Disparar template oficial de boas-vindas da Meta (registrando em whatsapp_logs)
        try {
          const { sendWelcomeMessage } = await import("./welcomeMessage.js");
          await sendWelcomeMessage({
            nome_zelador: zeladorNome,
            nome_terreiro: terreiroNome,
            email: rawEmail,
            msisdn: input.phone,
            senha: tempPassword,
            tenantId: userId,
            sb,
          });
        } catch (welcomeErr) {
          console.warn("[GROWTH AI] falha ao disparar template de boas-vindas:", welcomeErr);
        }

        // Notificar operador (WhatsApp) sobre o novo terreiro criado
        try {
          const { notifyOpsNewTerreiro } = await import("./opsAlertWhatsApp.js");
          await notifyOpsNewTerreiro({
            nome_terreiro: terreiroNome,
            nome_zelador: zeladorNome,
            email: rawEmail,
            whatsapp: input.phone,
            source: "public-register",
            tenantId: userId,
          });
        } catch (opsErr) {
          console.warn("[GROWTH AI] falha ao alertar operador:", opsErr);
        }

        if (sourceTable === "prospecting_leads") {
          await sb.from("prospecting_leads").update({
            status: "trial",
            email: rawEmail,
            terreiro_id: userId,
            last_contact_at: nowIso,
            updated_at: nowIso,
          }).eq("id", prospect.id);

          await sb.from("prospecting_events").insert({
            lead_id: prospect.id,
            event_type: "trial_started",
            from_status: prospect.status || "interested",
            to_status: "trial",
            description: "Conta de teste criada automaticamente pelo chat com senha gerada",
            metadata: { userId, email: rawEmail },
            created_at: nowIso,
          });
        }

        return { handled: true, replied: true };
      } else if (authErr && /already|registered|duplicate|exists/i.test(authErr.message || "")) {
        const existingReply = `Axé! 🙏 O e-mail ${rawEmail} já possui cadastro no AxéCloud.\n\nVocê pode acessar seu painel diretamente em: https://axecloud.com.br/entrar\n(Caso não lembre a senha, é só clicar em 'Esqueci minha senha' na tela de login).`;
        await replyAdminInboxMessage(sb, conversation.id, existingReply);
        return { handled: true, replied: true };
      }
    } catch (e) {
      console.warn("[GROWTH AI] erro no auto-onboarding:", e);
    }
  }

  const { data: history, error: historyError } = await sb
    .from("admin_whatsapp_messages")
    .select("direction,body,created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(16);
  if (historyError) throw historyError;
  const price = await resolvePremiumAmountLabel(sb);
  const registrationUrl = `${String(process.env.APP_PUBLIC_URL || "https://axecloud.com.br").replace(/\/$/, "")}/register`;
  const reply = await generateSalesReply({
    terreiroNome: String(prospect.terreiro_nome),
    contactName: conversation.contact_name,
    history: [...(history || [])].reverse(),
    monthlyPriceLabel: price,
    registrationUrl,
  });
  await replyAdminInboxMessage(sb, conversation.id, reply);
  const now = new Date().toISOString();
  const stage = mergeSalesStage(prospect.ai_sales_stage, nextStage(input.inboundBody));

  if (sourceTable === "growth_prospects") {
    await sb.from("growth_prospects").update({
      consent_at: prospect.consent_at || input.inboundAt,
      consent_source: prospect.consent_source || "mensagem iniciada pelo contato",
      outreach_status: "replied",
      status: statusForSalesStage(prospect.status, stage),
      ai_sales_stage: stage,
      ai_last_reply_at: now,
      updated_at: now,
    }).eq("id", prospect.id);
    await sb.from("growth_outreach_events").insert({
      prospect_id: prospect.id,
      event_type: "ai_sales_reply",
      payload: { conversationId: conversation.id, stage },
    });
  } else if (sourceTable === "prospecting_leads") {
    await sb.from("prospecting_leads").update({
      status: "interested",
      last_contact_at: now,
      updated_at: now,
    }).eq("id", prospect.id);
    await sb.from("prospecting_events").insert({
      lead_id: prospect.id,
      event_type: "ai_sales_reply",
      from_status: prospect.status || "contacted",
      to_status: "interested",
      description: "Resposta comercial automatizada enviada ao interessado via WhatsApp",
      metadata: { conversationId: conversation.id, stage },
      created_at: now,
    });
  }

  return { handled: true, replied: true };
}
