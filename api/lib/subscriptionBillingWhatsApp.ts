import type { SupabaseClient } from "@supabase/supabase-js";
import { formatAmountLabelFromCents, normalizeBillingCycle } from "./plansCatalog.js";
import { isMetaCloudDirectConfigured, sendMetaCloudTemplate, sendMetaCloudText } from "./metaCloudSend.js";
import { resolveTenantPremiumAmountCents } from "./premiumPricing.js";
import { resolveLeaderId } from "./tenantAccess.js";
import { normalizeBrazilMsisdn } from "./welcomeMessage.js";
import { resolveEfiPixEnv, efiPixCreateImmediateCharge } from "./efiPixApi.js";
import {
  buildCobrancaAssinaturaComponents,
  resolveMetaTemplateLanguage,
} from "./whatsappMetaCloud.js";

const TEMPLATE = "cobranca_assinatura_pix_order_img_v1";
const BR_TZ = "America/Sao_Paulo";

function buildCobrancaAssinaturaOrderDetailsComponents(
  nome: string,
  terreiro: string,
  vencimento: string,
  amountCents: number,
  pixCode: string,
  pixKey: string,
  mediaIdOrUrl = "1159299646430694",
): any[] {
  const headerParam: Record<string, unknown> = mediaIdOrUrl.startsWith("http")
    ? { type: "image", image: { link: mediaIdOrUrl } }
    : { type: "image", image: { id: mediaIdOrUrl } };

  return [
    {
      type: "header",
      parameters: [headerParam],
    },
    {
      type: "body",
      parameters: [
        { type: "text", text: String(nome || "Zelador").slice(0, 60) },
        { type: "text", text: String(terreiro || "Terreiro").slice(0, 80) },
        { type: "text", text: String(vencimento).slice(0, 80) },
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
              reference_id: `OR_${Date.now()}`,
              type: "digital-goods",
              payment_type: "br",
              currency: "BRL",
              total_amount: {
                value: amountCents,
                offset: 100,
              },
              payment_settings: [
                {
                  type: "pix_dynamic_code",
                  pix_dynamic_code: {
                    code: pixCode,
                    merchant_name: "AxéCloud",
                    key: pixKey,
                    key_type: "EVP",
                  },
                },
              ],
              order: {
                status: "pending",
                items: [
                  {
                    retailer_id: "axecloud-premium",
                    name: "Plano Premium AxéCloud",
                    amount: { value: amountCents, offset: 100 },
                    quantity: 1,
                  },
                ],
                subtotal: { value: amountCents, offset: 100 },
              },
            },
          },
        },
      ],
    },
  ];
}

function saoPauloYmd(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function ymdUtcDays(value: string): number {
  const match = String(value || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return Number.NaN;
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000);
}

export function subscriptionBillingReminderOffset(expiresAt: string, now = new Date()): number | null {
  const today = ymdUtcDays(saoPauloYmd(now));
  const expiryYmd = String(expiresAt || "").slice(0, 10);
  const expiry = ymdUtcDays(expiryYmd);
  if (!Number.isFinite(today) || !Number.isFinite(expiry)) return null;
  const offset = expiry - today;
  return offset === 0 || offset === 1 ? offset : null;
}

function firstName(value: unknown): string {
  const name = String(value || "").trim().split(/\s+/).find(Boolean) || "Zelador";
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function formatDateBr(ymd: string): string {
  const [year, month, day] = ymd.split("-");
  return `${day}/${month}/${year}`;
}

export async function runSubscriptionBillingReminders(
  sb: SupabaseClient,
  now = new Date(),
): Promise<{ sent: number; skipped: number; errors: number }> {
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  if (!isMetaCloudDirectConfigured()) return { sent, skipped: 1, errors };

  const { data: subscriptions, error } = await sb
    .from("subscriptions")
    .select("id, tenant_id, status, expires_at, billing_cycle")
    .eq("status", "active")
    .not("expires_at", "is", null)
    .limit(500);
  if (error) {
    console.error("[SUBSCRIPTION WA] query:", error.message);
    return { sent, skipped, errors: 1 };
  }

  for (const subscription of subscriptions || []) {
    const expiresAt = String(subscription.expires_at || "");
    const offset = subscriptionBillingReminderOffset(expiresAt, now);
    if (offset == null) {
      skipped++;
      continue;
    }
    const tenantRef = String(subscription.tenant_id || subscription.id || "").trim();
    if (!tenantRef) {
      skipped++;
      continue;
    }

    try {
      const leaderId = await resolveLeaderId(sb, tenantRef);
      const { data: profile } = await sb
        .from("perfil_lider")
        .select("id, tenant_id, nome_terreiro, cargo, email, whatsapp, whatsapp_publico")
        .eq("id", leaderId)
        .maybeSingle();
      if (!profile) {
        skipped++;
        continue;
      }
      const authResult = await sb.auth.admin.getUserById(leaderId);
      let phone = normalizeBrazilMsisdn(
        String(authResult.data?.user?.user_metadata?.whatsapp || profile.whatsapp || profile.whatsapp_publico || "")
      );
      if (!phone) {
        const { data: lastLog } = await sb
          .from("whatsapp_logs")
          .select("telefone")
          .eq("tenant_id", leaderId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastLog?.telefone) {
          phone = normalizeBrazilMsisdn(String(lastLog.telefone));
        }
      }
      if (!phone) {
        skipped++;
        continue;
      }

      const expiryYmd = expiresAt.slice(0, 10);
      const dedupe = `ASSINATURA:${expiryYmd}:D-${offset}`;
      const { count } = await sb
        .from("whatsapp_logs")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", leaderId)
        .eq("tipo", "cobranca_assinatura")
        .ilike("mensagem", `%${dedupe}%`);
      if ((count || 0) > 0) {
        skipped++;
        continue;
      }

      const cycle = normalizeBillingCycle(subscription.billing_cycle);
      const amount = await resolveTenantPremiumAmountCents(sb, leaderId, cycle);
      const valueLabel = formatAmountLabelFromCents(amount);
      const expiryLabel = offset === 1
        ? `vence amanha, no dia ${formatDateBr(expiryYmd)}`
        : `vence hoje, no dia ${formatDateBr(expiryYmd)}`;
      const templateName = String(process.env.WA_META_TEMPLATE_COBRANCA_ASSINATURA || "").trim() || TEMPLATE;
      const pixEnv = resolveEfiPixEnv();
      let pixCopyPaste: string | null = null;

      if (pixEnv) {
        try {
          const charge = await efiPixCreateImmediateCharge(pixEnv, {
            tenantId: leaderId,
            amountCents: amount,
            payerName: String(profile.cargo || profile.nome_terreiro || "Zelador"),
            description: `AxéCloud Premium — ${profile.nome_terreiro || "Terreiro"}`,
            expirationSeconds: 259200, // 3 dias de validade para cobrança enviada no WhatsApp
          });
          if (charge?.copyPaste) {
            pixCopyPaste = charge.copyPaste;
          }
        } catch (pixErr) {
          console.warn("[SUBSCRIPTION WA] Falha ao gerar Pix imediato Efí:", pixErr);
        }
      }

      const isOrderImgTemplate =
        (templateName === "cobranca_assinatura_pix_order_img_v1" || templateName === TEMPLATE) &&
        Boolean(pixCopyPaste && pixEnv?.pixKey);

      const resolvedTemplate = isOrderImgTemplate
        ? "cobranca_assinatura_pix_order_img_v1"
        : "cobranca_assinatura_pix_v2_axecloud";

      const components = isOrderImgTemplate
        ? buildCobrancaAssinaturaOrderDetailsComponents(
            firstName(profile.cargo),
            String(profile.nome_terreiro || "Seu terreiro"),
            expiryLabel,
            amount,
            pixCopyPaste!,
            pixEnv!.pixKey,
            String(process.env.WA_BILLING_BANNER_MEDIA_ID || "1159299646430694").trim(),
          )
        : buildCobrancaAssinaturaComponents(
            firstName(profile.cargo),
            String(profile.nome_terreiro || "Seu terreiro"),
            expiryLabel,
            valueLabel,
          );

      const out = await sendMetaCloudTemplate(phone, resolvedTemplate, resolveMetaTemplateLanguage(), components, {
        tenantId: leaderId,
        recipientName: String(profile.cargo || "Zelador"),
        source: "billing",
        sourceId: leaderId,
        idempotencyKey: `subscription-billing:${leaderId}:${expiryYmd}:d${offset}`,
        metadata: { billingCycle: cycle, expiresAt: expiryYmd, offset },
      });

      // No template interativo com foto e botão 'Copiar código Pix', NÃO envia segunda mensagem
      if (!isOrderImgTemplate && pixCopyPaste) {
        try {
          await new Promise((r) => setTimeout(r, 1200));
          const pixTemplate = String(process.env.WA_META_TEMPLATE_CODIGO_PIX || "codigo_pix_pagamento_v1_axecloud").trim();
          try {
            await sendMetaCloudTemplate(
              phone,
              pixTemplate,
              resolveMetaTemplateLanguage(),
              [{ type: "body", parameters: [{ type: "text", text: pixCopyPaste }] }],
              {
                tenantId: leaderId,
                recipientName: String(profile.cargo || "Zelador"),
                source: "billing_pix_code",
                idempotencyKey: `subscription-pix-code:${leaderId}:${expiryYmd}:d${offset}`,
              }
            );
          } catch {
            await sendMetaCloudText(phone, pixCopyPaste, {
              tenantId: leaderId,
              recipientName: String(profile.cargo || "Zelador"),
              source: "billing_pix_code",
              idempotencyKey: `subscription-pix-code:${leaderId}:${expiryYmd}:d${offset}`,
            });
          }
        } catch (textErr) {
          console.warn("[SUBSCRIPTION WA] Falha ao enviar código Pix em mensagem separada:", textErr);
        }
      }

      await sb.from("whatsapp_logs").insert({
        tenant_id: leaderId,
        filho_id: null,
        tipo: "cobranca_assinatura",
        telefone: phone,
        mensagem: `${dedupe} · ${expiryLabel} · ${valueLabel}`,
        status: "sent",
        external_id: out.messageId || `subscription_${Date.now()}_${leaderId.slice(0, 8)}`,
      });
      sent++;
    } catch (sendError) {
      errors++;
      console.error("[SUBSCRIPTION WA] reminder:", sendError instanceof Error ? sendError.message : sendError);
    }
  }
  return { sent, skipped, errors };
}
