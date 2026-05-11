/**
 * Uso (na raiz do projeto, com .env carregado):
 *   npx tsx scripts/purge-user-by-email.ts <email>
 * Variáveis: VITE_SUPABASE_URL ou SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (ou equivalentes já usados no servidor).
 */
import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  permanentDeleteZeladorAccount,
  SHARED_GLOBAL_TENANT_ID,
} from "../api/permanentAccountDelete.js";

function getUrl(): string | undefined {
  return (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}

function getServiceKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_KEY
  );
}

async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data.users || [];
    const hit = users.find((u) => (u.email || "").toLowerCase() === target);
    if (hit?.id) return hit.id;
    if (users.length < 1000) return null;
    page += 1;
  }
}

async function main() {
  const email = (process.argv[2] || "").trim();
  if (!email) {
    console.error("Uso: npx tsx scripts/purge-user-by-email.ts <email>");
    process.exit(1);
  }

  const url = getUrl();
  const key = getServiceKey();
  if (!url || !key) {
    console.error("Faltam VITE_SUPABASE_URL/SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
    process.exit(1);
  }

  const supabaseAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userId = await findUserIdByEmail(supabaseAdmin, email);
  if (!userId) {
    console.error(`Nenhum utilizador em auth com o e-mail: ${email}`);
    process.exit(1);
  }

  console.log(`Encontrado auth user id=${userId} — a purgar terreiro e conta (force admin)...`);

  const { data: pl } = await supabaseAdmin
    .from("perfil_lider")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();
  const tenantScope = String((pl as { tenant_id?: string | null } | null)?.tenant_id || userId).trim();
  const needsSharedBypass = tenantScope === SHARED_GLOBAL_TENANT_ID;
  if (needsSharedBypass) {
    console.warn(
      "[AVISO] perfil_lider.tenant_id é o tenant global partilhado; a purga segue o mesmo critério de linhas que o fluxo normal (tenant_id/lider_id)."
    );
  }

  const result = await permanentDeleteZeladorAccount(
    {
      supabaseAdmin,
      force: true,
      forceIgnoreSharedTenantGuard: needsSharedBypass,
    },
    userId
  );

  if (result.ok === false) {
    console.error(`Falha [${result.status}]: ${result.message}`);
    process.exit(1);
  }

  console.log("Purge concluída com sucesso.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
