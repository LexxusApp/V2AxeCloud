import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

const LUCAS_TENANT_ID = "4b167a21-d208-4f36-8b97-692f9c8e44a3";
const LUCAS_EMAIL = "vendasmercadolivrev1@gmail.com";
const LUCAS_PHONE = "5511920033501";

async function main() {
  console.log("=== INICIANDO GERAÇÃO DE PIX R$ 6,00 PARA CONTA DO LUCAS ===");
  console.log(`Tenant ID: ${LUCAS_TENANT_ID}`);
  console.log(`E-mail: ${LUCAS_EMAIL}`);
  console.log(`WhatsApp: ${LUCAS_PHONE}`);

  const sbAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const sbAnon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Obter token de autenticação JWT para Lucas
  console.log("\n[1/5] Gerando sessão JWT para o usuário...");
  const { data: linkData, error: linkErr } = await sbAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: LUCAS_EMAIL,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(`Falha ao gerar magic link: ${linkErr?.message}`);
  }

  const { data: sessionData, error: sessionErr } = await sbAnon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (sessionErr || !sessionData?.session?.access_token) {
    throw new Error(`Falha ao obter access token: ${sessionErr?.message}`);
  }
  const accessToken = sessionData.session.access_token;
  console.log("Token JWT obtido com sucesso!");

  // 2. Backup do catálogo global atual
  console.log("\n[2/5] Lendo catálogo global atual...");
  const { data: originalSetting, error: getSettingErr } = await sbAdmin
    .from("global_settings")
    .select("data")
    .eq("id", "plans")
    .single();

  if (getSettingErr || !originalSetting?.data) {
    throw new Error(`Falha ao ler global_settings plans: ${getSettingErr?.message}`);
  }

  const originalData = JSON.parse(JSON.stringify(originalSetting.data));
  console.log("Preço atual original:", originalData.premium?.price);

  let pixChargeResult: any = null;

  try {
    // 3. Temporariamente define o preço do plano premium como 6.0 (R$ 6,00)
    console.log("\n[3/5] Ajustando preço temporariamente para R$ 6,00...");
    const testData = {
      ...originalData,
      premium: {
        ...originalData.premium,
        price: 6.0,
      },
    };
    await sbAdmin.from("global_settings").update({ data: testData }).eq("id", "plans");

    // 4. Chama o endpoint de checkout EFI PIX em produção
    console.log("\n[4/5] Solicitando cobrança PIX imediata à Efí...");
    const checkoutRes = await fetch("https://axecloud.com.br/api/v1/checkout/efi/pix", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        purpose: "renewal",
        billingCycle: "monthly",
        payerName: "Lucas Teste",
      }),
    });

    const checkoutText = await checkoutRes.text();
    if (!checkoutRes.ok) {
      throw new Error(`Falha no checkout EFI PIX (${checkoutRes.status}): ${checkoutText}`);
    }

    pixChargeResult = JSON.parse(checkoutText);
    console.log("PIX gerado com sucesso na Efí!");
    console.log(`TXID: ${pixChargeResult.txid}`);
    console.log(`Status: ${pixChargeResult.status}`);
    console.log(`Copia e Cola (primeiros 50 chars): ${pixChargeResult.copyPaste?.slice(0, 50)}...`);
  } finally {
    // 5. Restaura imediatamente o preço global original para R$ 69,90
    console.log("\n[5/5] Restaurando catálogo global para o valor original...");
    await sbAdmin.from("global_settings").update({ data: originalData }).eq("id", "plans");
    console.log("Catálogo global 100% restaurado para R$ 69,90!");
  }

  // 6. Verificar a assinatura no banco de dados
  const { data: subAfter } = await sbAdmin
    .from("subscriptions")
    .select("id, status, efi_pix_txid, efi_charge_id, expires_at")
    .eq("id", LUCAS_TENANT_ID)
    .single();

  console.log("\nAssinatura atualizada no banco:");
  console.log(JSON.stringify(subAfter, null, 2));

  return pixChargeResult;
}

main()
  .then((res) => {
    console.log("\n=== CONCLUÍDO COM SUCESSO ===");
    console.log("COPIA E COLA COMPLETO:\n", res.copyPaste);
  })
  .catch((err) => {
    console.error("\n❌ ERRO:", err);
    process.exit(1);
  });
