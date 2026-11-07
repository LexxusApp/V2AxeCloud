import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://vlaojhfwhqmwudqsumpi.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const PROD_API_BASE = "https://axecloud.com.br";

async function main() {
  console.log("=== Teste E2E Cantina em Produção Cloudflare ===");

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
    email: "vendasmercadolivrev1@gmail.com",
    password: "Lucas4356!",
  });

  if (loginError || !authData.session) {
    console.error("Falha ao logar usuário de teste:", loginError);
    process.exit(1);
  }

  const token = authData.session.access_token;
  const tenantId = authData.user.id;
  console.log("Logado com sucesso! User/Tenant ID:", tenantId);

  // 1. GET /api/v1/cantina/data
  console.log("\n1. Testando GET /api/v1/cantina/data...");
  const resGet = await fetch(`${PROD_API_BASE}/api/v1/cantina/data?tenantId=${tenantId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("Status GET:", resGet.status);
  const dataGet = await resGet.json();
  console.log("Runtime header:", resGet.headers.get("x-axecloud-runtime"));
  console.log("Filhos retornados:", dataGet.filhos?.length);
  console.log("Stats:", dataGet.stats);

  if (!resGet.ok || !Array.isArray(dataGet.filhos)) {
    console.error("GET falhou!", dataGet);
    process.exit(1);
  }

  const testChild = dataGet.filhos[0];
  if (!testChild) {
    console.error("Nenhum filho encontrado para testar consumo");
    process.exit(1);
  }
  console.log(`Usando médium de teste: ${testChild.nome} (ID: ${testChild.id})`);

  // 2. POST /api/v1/cantina/consumo
  console.log("\n2. Testando POST /api/v1/cantina/consumo...");
  const resConsumo = await fetch(`${PROD_API_BASE}/api/v1/cantina/consumo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tenantId,
      filhoId: testChild.id,
      descricao: "1x Refrigerante, 1x Salgado (Teste Cloudflare)",
      valor: 12.0,
      formaPagamento: "fiado",
      itens: [
        { nome: "Refrigerante", preco: 5.0, quantidade: 1 },
        { nome: "Salgado", preco: 7.0, quantidade: 1 },
      ],
    }),
  });
  console.log("Status POST consumo:", resConsumo.status);
  const dataConsumo = await resConsumo.json();
  console.log("Resposta consumo:", dataConsumo);
  if (!resConsumo.ok || !dataConsumo.transaction?.id) {
    console.error("Lançamento de consumo falhou!", dataConsumo);
    process.exit(1);
  }
  const txId = dataConsumo.transaction.id;

  // 3. POST /api/v1/cantina/liquidar
  console.log("\n3. Testando POST /api/v1/cantina/liquidar para a transação gerada...");
  const resLiquidar = await fetch(`${PROD_API_BASE}/api/v1/cantina/liquidar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tenantId,
      transactionId: txId,
    }),
  });
  console.log("Status POST liquidar:", resLiquidar.status);
  const dataLiquidar = await resLiquidar.json();
  console.log("Resposta liquidar:", dataLiquidar);
  if (!resLiquidar.ok || !dataLiquidar.success) {
    console.error("Liquidação falhou!", dataLiquidar);
    process.exit(1);
  }

  // 4. Limpeza da transação de teste
  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  await supabaseAdmin.from("financeiro").delete().eq("id", txId);
  await supabaseAdmin.from("loja_pedidos").delete().eq("tenant_id", tenantId).eq("resumo_itens", "1x Refrigerante, 1x Salgado (Teste Cloudflare)");
  console.log("Transação de teste limpa com sucesso!");

  console.log("\n>>> TODOS OS TESTES EM PRODUÇÃO CLOUDFLARE PASSARAM COM SUCESSO 100%! <<<");
}

main().catch(console.error);
