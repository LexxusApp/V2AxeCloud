import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolveEfiPixEnv, efiPixCreateImmediateCharge } from "../api/lib/efiPixApi.js";
import { sendMetaCloudTemplate } from "../api/lib/metaCloudSend.js";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const JOYCE_TENANT_ID = "5de04732-9419-4ef5-8558-7287ed140e79";
const JOYCE_PHONE = "5511915128744";
const JOYCE_NAME = "Joyce";
const JOYCE_TERREIRO = "T.U. Casa de Oxóssi Caridade e Amor";
const AMOUNT_CENTS = 6990; // R$ 69,90

async function main() {
  console.log("=== ENVIANDO TEMPLATE DE PIX PARA TERREIRO QUE VENCE HOJE ===");
  console.log(`Terreiro: ${JOYCE_TERREIRO}`);
  console.log(`Zeladora: ${JOYCE_NAME}`);
  console.log(`WhatsApp: ${JOYCE_PHONE}`);
  console.log(`Valor: R$ 69,90 (${AMOUNT_CENTS} centavos)`);

  const sbAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Atualiza whatsapp em perfil_lider caso esteja null
  console.log("\n[1/4] Atualizando perfil_lider com WhatsApp 11915128744...");
  await sbAdmin
    .from("perfil_lider")
    .update({ whatsapp: "11915128744" })
    .eq("id", JOYCE_TENANT_ID);

  // 2. Resolve ambiente Efí e gera Pix dinâmico imediato
  console.log("\n[2/4] Gerando cobrança Pix imediata na Efí Bank...");
  const pixEnv = resolveEfiPixEnv();
  if (!pixEnv) {
    throw new Error("Ambiente Efí Pix não configurado!");
  }

  const charge = await efiPixCreateImmediateCharge(pixEnv, {
    tenantId: JOYCE_TENANT_ID,
    amountCents: AMOUNT_CENTS,
    payerName: JOYCE_NAME,
    description: `AxéCloud Premium — ${JOYCE_TERREIRO}`,
    expirationSeconds: 259200, // 3 dias
  });

  if (!charge?.copyPaste) {
    throw new Error("Falha ao obter código Pix copia e cola da Efí!");
  }
  console.log("Cobrança gerada com sucesso na Efí!");
  console.log(`TxID: ${charge.txid}`);
  console.log(`Pix Copia e Cola: ${charge.copyPaste.slice(0, 50)}...`);

  // 3. Monta componentes do template cobranca_assinatura_pix_order_img_v1
  console.log("\n[3/4] Montando componentes do template cobranca_assinatura_pix_order_img_v1...");
  const bannerMediaId = String(process.env.WA_BILLING_BANNER_MEDIA_ID || "1159299646430694").trim();
  const components: any[] = [
    {
      type: "header",
      parameters: [{ type: "image", image: { id: bannerMediaId } }],
    },
    {
      type: "body",
      parameters: [
        { type: "text", text: JOYCE_NAME },
        { type: "text", text: JOYCE_TERREIRO },
        { type: "text", text: "vence hoje, no dia 12/10/2026" },
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
              reference_id: `OR_SUB_${Date.now()}`,
              type: "digital-goods",
              payment_type: "br",
              currency: "BRL",
              total_amount: {
                value: AMOUNT_CENTS,
                offset: 100,
              },
              payment_settings: [
                {
                  type: "pix_dynamic_code",
                  pix_dynamic_code: {
                    code: charge.copyPaste,
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
                    retailer_id: "axecloud-premium",
                    name: "Plano Premium AxéCloud",
                    amount: { value: AMOUNT_CENTS, offset: 100 },
                    quantity: 1,
                  },
                ],
                subtotal: { value: AMOUNT_CENTS, offset: 100 },
              },
            },
          },
        },
      ],
    },
  ];

  // 4. Envia via Meta Cloud API
  console.log(`\n[4/4] Enviando template para ${JOYCE_PHONE}...`);
  const res = await sendMetaCloudTemplate(
    JOYCE_PHONE,
    "cobranca_assinatura_pix_order_img_v1",
    "pt_BR",
    components,
    {
      tenantId: JOYCE_TENANT_ID,
      recipientName: JOYCE_NAME,
      source: "billing",
      sourceId: JOYCE_TENANT_ID,
      idempotencyKey: `sub-billing-today:${JOYCE_TENANT_ID}:2026-10-12`,
    }
  );

  console.log("\n✅ DISPARO CONCLUÍDO COM SUCESSO!");
  console.log("Resultado Meta:", res);
}

main().catch((err) => {
  console.error("\n❌ ERRO NO DISPARO:", err);
  process.exit(1);
});
