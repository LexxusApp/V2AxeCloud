import type { SupabaseClient } from "@supabase/supabase-js";
import { isMetaCloudDirectConfigured, sendMetaCloudText, sendMetaCloudTemplate } from "./metaCloudSend.js";
import { normalizeInboxPhone } from "./adminWhatsAppInbox.js";
import { resolveEfiPixEnv, efiPixCreateImmediateCharge } from "./efiPixApi.js";

export type TerreiroWinBackAction =
  | "winback_15d"
  | "winback_15d_plus_50"
  | "winback_discount_50";

/**
 * Detecta se a mensagem recebida corresponde a um clique de botão
 * ou resposta de resgate (Win-Back) de terreiro.
 */
export function detectTerreiroWinBackAction(
  body: string,
  _messageType?: string
): TerreiroWinBackAction | null {
  const text = String(body || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // 15 Dias + 50%
  if (
    text.includes("15 dias + 50%") ||
    text.includes("15d + 50%") ||
    text.includes("15 dias e 50%") ||
    text.includes("15 dias mais 50%") ||
    text === "15 d + 50%" ||
    text === "15d+50%"
  ) {
    return "winback_15d_plus_50";
  }

  // 50% de Desconto
  if (
    text.includes("50% de desconto") ||
    text.includes("50% desconto") ||
    text.includes("50% off") ||
    text === "50%" ||
    text.includes("quero os 50%") ||
    text.includes("desconto de 50%")
  ) {
    return "winback_discount_50";
  }

  // + 15 Dias
  if (
    text.includes("+ 15 dias") ||
    text.includes("+15 dias") ||
    text.includes("15 dias gratis") ||
    text === "+ 15" ||
    text === "+15" ||
    text === "15 dias" ||
    text.includes("mais 15 dias") ||
    text.includes("quero os 15 dias")
  ) {
    return "winback_15d";
  }

  return null;
}

/**
 * Localiza o terreiro e líder pelo número de telefone do remetente.
 */
export async function resolveTerreiroByPhone(
  sb: SupabaseClient,
  rawPhone: string
): Promise<{
  leaderId: string;
  nomeTerreiro: string;
  nomeZelador: string;
  phone: string;
} | null> {
  const clean = rawPhone.replace(/\D/g, "");
  if (!clean || clean.length < 8) return null;
  const last8 = clean.slice(-8);

  // 1. Busca em perfil_lider
  const { data: profiles } = await sb
    .from("perfil_lider")
    .select("id, nome_terreiro, cargo, zelador, whatsapp, whatsapp_publico")
    .or(`whatsapp.ilike.%${last8}%,whatsapp_publico.ilike.%${last8}%`)
    .limit(5);

  if (profiles && profiles.length > 0) {
    const p = profiles[0];
    return {
      leaderId: String(p.id),
      nomeTerreiro: String(p.nome_terreiro || "Terreiro"),
      nomeZelador: String(p.cargo || p.zelador || "Zelador(a)"),
      phone: clean,
    };
  }

  // 2. Busca nos logs recentes do WhatsApp
  const { data: logs } = await sb
    .from("whatsapp_logs")
    .select("tenant_id")
    .ilike("telefone", `%${last8}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (logs && logs.length > 0 && logs[0].tenant_id) {
    const leaderId = String(logs[0].tenant_id);
    const { data: p } = await sb
      .from("perfil_lider")
      .select("id, nome_terreiro, cargo, zelador")
      .eq("id", leaderId)
      .maybeSingle();

    if (p) {
      return {
        leaderId,
        nomeTerreiro: String(p.nome_terreiro || "Terreiro"),
        nomeZelador: String(p.cargo || p.zelador || "Zelador(a)"),
        phone: clean,
      };
    }
  }

  return null;
}

/**
 * Processa a ação de resgate do terreiro quando o líder clica no botão do template.
 */
export async function handleTerreiroWinBackInbound(
  sb: SupabaseClient,
  inbound: { from: string; body: string; messageType?: string }
): Promise<boolean> {
  const action = detectTerreiroWinBackAction(inbound.body, inbound.messageType);
  if (!action) return false;

  const phone = normalizeInboxPhone(inbound.from);
  if (!phone) return false;

  const resolved = await resolveTerreiroByPhone(sb, phone);
  if (!resolved) {
    console.warn(`[WINBACK] Líder não localizado para o telefone: ${phone}`);
    return false;
  }

  const { leaderId, nomeTerreiro, nomeZelador } = resolved;
  const now = new Date();
  const plus15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();

  if (action === "winback_15d") {
    // 1. Aplica +15 dias gratuitos e desbloqueia o terreiro
    await Promise.all([
      sb
        .from("subscriptions")
        .update({
          status: "active",
          expires_at: plus15Days,
          updated_at: now.toISOString(),
        })
        .eq("id", leaderId),
      sb
        .from("perfil_lider")
        .update({
          is_blocked: false,
          access_block_reason: null,
          access_blocked_at: null,
          updated_at: now.toISOString(),
        })
        .eq("id", leaderId),
    ]);

    // Grava log
    await sb.from("whatsapp_logs").insert({
      tenant_id: leaderId,
      tipo: "winback_15d_aplicado",
      telefone: phone,
      mensagem: `Resgate aplicado: +15 dias concedidos até ${plus15Days.slice(0, 10)}.`,
      status: "delivered",
    });

    // Envia resposta no WhatsApp
    if (isMetaCloudDirectConfigured()) {
      const reply =
        `Olá, ${nomeZelador}! Axé! 🙏\n\n` +
        `Mais *15 dias gratuitos* foram liberados com sucesso para o *${nomeTerreiro}*!\n\n` +
        `Seu acesso já está 100% liberado. Acesse seu painel agora mesmo:\n` +
        `👉 https://axecloud.com.br/entrar\n\n` +
        `Se precisar de qualquer ajuda para cadastrar seus filhos ou agendar as primeiras giras, é só me chamar por aqui! Muito axé para a sua casa! 🌿`;

      await sendMetaCloudText(phone, reply).catch((err) =>
        console.warn("[WINBACK] Erro ao enviar confirmação de 15 dias:", err)
      );
    }
    return true;
  }

  if (action === "winback_15d_plus_50") {
    // 2. Aplica +15 dias e registra cupom de 50%
    await Promise.all([
      sb
        .from("subscriptions")
        .update({
          status: "active",
          expires_at: plus15Days,
          updated_at: now.toISOString(),
        })
        .eq("id", leaderId),
      sb
        .from("perfil_lider")
        .update({
          is_blocked: false,
          access_block_reason: null,
          access_blocked_at: null,
          updated_at: now.toISOString(),
        })
        .eq("id", leaderId),
    ]);

    await sb.from("whatsapp_logs").insert({
      tenant_id: leaderId,
      tipo: "winback_15d_plus_50_aplicado",
      telefone: phone,
      mensagem: `Resgate aplicado: +15 dias até ${plus15Days.slice(0, 10)} com 50% garantido na renovação.`,
      status: "delivered",
    });

    if (isMetaCloudDirectConfigured()) {
      const reply =
        `Olá, ${nomeZelador}! Axé! 🙏\n\n` +
        `Excelente escolha! Liberamos *mais 15 dias gratuitos* para o *${nomeTerreiro}* agora mesmo, e garantimos *50% de desconto* na sua primeira mensalidade (de R$ 69,90 por apenas R$ 34,95).\n\n` +
        `Aproveite para colocar a casa em dia no sistema:\n` +
        `👉 https://axecloud.com.br/entrar\n\n` +
        `Quando os 15 dias vencerem, você receberá o Pix com o desconto aplicado automaticamente. Bom trabalho na casa! ✨`;

      await sendMetaCloudText(phone, reply).catch((err) =>
        console.warn("[WINBACK] Erro ao enviar confirmação 15D + 50%:", err)
      );
    }
    return true;
  }

  if (action === "winback_discount_50") {
    // 3. Gera Pix imediato com 50% de desconto (R$ 34,95 = 3495 centavos)
    const pixEnv = resolveEfiPixEnv();
    let pixCopyPaste: string | null = null;
    const discountAmountCents = 3495; // 50% de R$ 69,90

    if (pixEnv) {
      try {
        const charge = await efiPixCreateImmediateCharge(pixEnv, {
          tenantId: leaderId,
          amountCents: discountAmountCents,
          payerName: String(nomeZelador || nomeTerreiro),
          description: `AxéCloud — Reativação 50% OFF (${nomeTerreiro})`,
          expirationSeconds: 259200, // 3 dias
        });
        if (charge?.copyPaste) {
          pixCopyPaste = charge.copyPaste;
        }
      } catch (pixErr) {
        console.warn("[WINBACK] Erro ao gerar Pix 50% Efí:", pixErr);
      }
    }

    await sb.from("whatsapp_logs").insert({
      tenant_id: leaderId,
      tipo: "winback_pix_50_gerado",
      telefone: phone,
      mensagem: `Pix de reativação com 50% gerado (R$ 34,95). Pix: ${pixCopyPaste ? "sim" : "não"}.`,
      status: "delivered",
    });

    if (isMetaCloudDirectConfigured()) {
      let sentTemplate = false;

      // 1. Tenta enviar o template oficial com foto e botão nativo Copiar código Pix
      if (pixCopyPaste && pixEnv?.pixKey) {
        const bannerMediaId = String(process.env.WA_BILLING_BANNER_MEDIA_ID || "1159299646430694").trim();
        const components: any[] = [
          {
            type: "header",
            parameters: [{ type: "image", image: { id: bannerMediaId } }],
          },
          {
            type: "body",
            parameters: [
              { type: "text", text: String(nomeZelador || "Zelador").slice(0, 60) },
              { type: "text", text: String(nomeTerreiro || "Terreiro").slice(0, 80) },
              { type: "text", text: "reativação especial com 50% de desconto" },
            ],
          },
          {
            type: "button",
            sub_type: "order_details",
            index: 0,
            parameters: [
              {
                type: "action",
                action: {
                  order_details: {
                    reference_id: `OR_WB_${Date.now()}`,
                    type: "digital-goods",
                    payment_type: "br",
                    currency: "BRL",
                    total_amount: {
                      value: discountAmountCents,
                      offset: 100,
                    },
                    payment_settings: [
                      {
                        type: "pix_dynamic_code",
                        pix_dynamic_code: {
                          code: pixCopyPaste,
                          merchant_name: "AxéCloud",
                          key: pixEnv.pixKey,
                          key_type: "EVP",
                        },
                      },
                    ],
                    order: {
                      status: "pending",
                      items: [
                        {
                          retailer_id: "axecloud-premium-50off",
                          name: "Plano Premium AxéCloud (50% OFF)",
                          amount: { value: discountAmountCents, offset: 100 },
                          quantity: 1,
                        },
                      ],
                      subtotal: { value: discountAmountCents, offset: 100 },
                    },
                  },
                },
              },
            ],
          },
        ];

        try {
          await sendMetaCloudTemplate(
            phone,
            "cobranca_assinatura_pix_order_img_v1",
            "pt_BR",
            components,
            {
              tenantId: leaderId,
              recipientName: String(nomeZelador || "Zelador"),
              source: "billing",
              sourceId: leaderId,
              idempotencyKey: `winback-pix-order:${leaderId}:${Date.now()}`,
            }
          );
          sentTemplate = true;
        } catch (tmplErr) {
          console.warn("[WINBACK] Falha ao enviar template order_img_v1, acionando fallback:", tmplErr);
        }
      }

      // 2. Fallback de texto caso o template não seja enviado
      if (!sentTemplate) {
        let reply =
          `Olá, ${nomeZelador}! Axé! 🙏\n\n` +
          `Aqui está o seu Pix com *50% de desconto* (de R$ 69,90 por *apenas R$ 34,95*) para reativar o *${nomeTerreiro}*:\n\n`;

        if (pixCopyPaste) {
          reply +=
            `Copie o código Pix abaixo e cole no app do seu banco:\n\n` +
            `\`${pixCopyPaste}\`\n\n` +
            `Assim que o pagamento for confirmado, seu terreiro é liberado instantaneamente na hora! ⚡\n\n` +
            `Painel: https://axecloud.com.br/entrar`;
        } else {
          reply +=
            `Acesse seu painel para gerar o Pix com desconto direto na tela:\n` +
            `👉 https://axecloud.com.br/entrar\n\n` +
            `Qualquer dúvida, é só me chamar por aqui!`;
        }

        await sendMetaCloudText(phone, reply).catch((err) =>
          console.warn("[WINBACK] Erro ao enviar fallback texto Pix 50%:", err)
        );
      }
    }
    return true;
  }

  return false;
}
