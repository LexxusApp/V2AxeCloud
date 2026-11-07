import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { resolveEfiPixEnv, efiPixCreateImmediateCharge } from "../api/lib/efiPixApi.js";
import { resolveTenantPremiumAmountCents } from "../api/lib/premiumPricing.js";
import { sendMetaCloudTemplate } from "../api/lib/metaCloudSend.js";
import { resolveMetaTemplateLanguage } from "../api/lib/whatsappMetaCloud.js";
import { normalizeBrazilMsisdn } from "../api/lib/welcomeMessage.js";

const TENANT_ID = "3b0bac5d-93fd-4612-a0ef-00f41104593b";
const MEDIA_ID = process.env.WA_BILLING_BANNER_MEDIA_ID || "1159299646430694";

function buildCobrancaAssinaturaOrderDetailsComponents(
  nome: string,
  terreiro: string,
  vencimento: string,
  amountCents: number,
  pixCode: string,
  pixKey: string,
  mediaIdOrUrl = MEDIA_ID,
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
              reference_id: `OR_URANDI_${Date.now()}`,
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

async function main() {
  console.log("=== INICIANDO DISPARO DO PIX OFICIAL PARA PAI CRISTIAN (URANDI) ===");
  const sbUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbKey) throw new Error("Supabase credentials missing");

  const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false } });

  // 1. Obter perfil do líder
  const { data: profile, error: profErr } = await sb
    .from("perfil_lider")
    .select("id, tenant_id, nome_terreiro, cargo, email, whatsapp, whatsapp_publico")
    .eq("id", TENANT_ID)
    .single();
  if (profErr || !profile) throw new Error(`Perfil não encontrado: ${profErr?.message}`);

  const phone = normalizeBrazilMsisdn(profile.whatsapp_publico || profile.whatsapp || "67999174377");
  console.log(`Destinatário: ${phone} (${profile.cargo} - ${profile.nome_terreiro})`);

  // 2. Resolver valor da assinatura
  const amount = await resolveTenantPremiumAmountCents(sb, TENANT_ID, "monthly");
  console.log(`Valor da cobrança: R$ ${(amount / 100).toFixed(2)}`);

  // 3. Gerar Pix dinâmico na Efí
  const pixEnv = resolveEfiPixEnv();
  if (!pixEnv) throw new Error("Ambiente Efí Pix não configurado no .env");

  console.log("Gerando cobrança imediata na Efí Bank...");
  const charge = await efiPixCreateImmediateCharge(pixEnv, {
    tenantId: TENANT_ID,
    amountCents: amount,
    payerName: String(profile.cargo || "Pai Cristian de Oxossi"),
    description: `Assinatura AxéCloud — ${profile.nome_terreiro}`,
    expirationSeconds: 86400 * 3, // 3 dias
  });

  if (!charge?.copyPaste) {
    throw new Error("Efí não retornou código Pix Copia e Cola.");
  }
  console.log(`Pix gerado com sucesso! TxID: ${charge.txid}`);
  console.log(`Código Pix Copia e Cola: ${charge.copyPaste.slice(0, 40)}...`);

  // 4. Montar componentes e enviar template oficial da Meta
  const expiryLabel = "venceu ontem, no dia 21/10/2026";
  const firstName = String(profile.cargo || "Cristian").trim().split(/\s+/).find(Boolean) || "Cristian";
  const components = buildCobrancaAssinaturaOrderDetailsComponents(
    firstName,
    String(profile.nome_terreiro || "Terreiro de Umbanda Cabocla Urandi"),
    expiryLabel,
    amount,
    charge.copyPaste,
    pixEnv.pixKey,
    MEDIA_ID
  );

  console.log("Enviando template cobranca_assinatura_pix_order_img_v1 pela Meta Cloud API...");
  const out = await sendMetaCloudTemplate(
    phone,
    "cobranca_assinatura_pix_order_img_v1",
    resolveMetaTemplateLanguage(),
    components,
    {
      tenantId: TENANT_ID,
      recipientName: String(profile.cargo || "Pai Cristian"),
      source: "billing",
      sourceId: TENANT_ID,
      idempotencyKey: `subscription-billing:${TENANT_ID}:manual:${Date.now()}`,
      metadata: { billingCycle: "monthly", txid: charge.txid },
    }
  );

  console.log("Resultado do envio Meta:", JSON.stringify(out, null, 2));

  // 5. Registrar em whatsapp_logs
  await sb.from("whatsapp_logs").insert({
    tenant_id: TENANT_ID,
    telefone: phone,
    tipo: "cobranca_assinatura",
    mensagem: `ASSINATURA:2026-10-21:D-0 | Template: cobranca_assinatura_pix_order_img_v1 | TxID: ${charge.txid}`,
    status: out.sent ? "delivered" : "failed",
    meta_message_id: out.messageId || null,
  });

  console.log(">>> DISPARO DO PIX CONCLUÍDO COM SUCESSO! <<<");
}

main().catch((err) => {
  console.error("ERRO NO DISPARO DO PIX:", err);
  process.exit(1);
});
