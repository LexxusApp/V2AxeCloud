/**
 * One-shot: reenvia dados_acesso para um filho via sendWhatsAppForTenant.
 *
 *   TENANT_ID=... FILHO_ID=... ./node_modules/.bin/tsx /tmp/resend-dados-acesso-filho.ts
 */
import { createClient } from "@supabase/supabase-js";
// Absolute path so the script can run from /tmp inside the read-only app container.
import { sendWhatsAppForTenant } from "/app/api/lib/whatsappSendCore.ts";

async function main() {
  const tenantId = String(process.env.TENANT_ID || "").trim();
  const filhoId = String(process.env.FILHO_ID || "").trim();

  if (!tenantId || !filhoId) {
    console.error("TENANT_ID e FILHO_ID são obrigatórios");
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Supabase URL/service key ausentes no env");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: filho, error } = await sb
    .from("filhos_de_santo")
    .select("id, nome, whatsapp_phone, cpf, status, tenant_id")
    .eq("id", filhoId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar filho:", error.message);
    process.exit(1);
  }
  if (!filho) {
    console.error("Filho não encontrado:", filhoId);
    process.exit(1);
  }

  const phone = String(filho.whatsapp_phone || "").replace(/\D/g, "");
  console.log(
    JSON.stringify(
      {
        filho_id: filho.id,
        nome: filho.nome,
        phone,
        status: filho.status,
        tenant_row: filho.tenant_id,
        send_tenant: tenantId,
      },
      null,
      2
    )
  );

  try {
    const result = await sendWhatsAppForTenant(sb, {
      tenantId,
      filhoId: String(filho.id),
      tipo: "dados_acesso",
      variables: {
        nome_filho: String(filho.nome || "Membro"),
        nome_sistema: "AxéCloud",
      },
    });
    console.log("OK", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(
      "FAIL",
      err instanceof Error ? err.message : String(err),
      (err && typeof err === "object" && "code" in err && (err as { code?: string }).code) || ""
    );
    process.exit(2);
  }
}

main();
