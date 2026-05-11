/**
 * Recria (ou actualiza) utilizador Auth + perfil_lider admin global + subscrição.
 * Não commites credenciais. Uso:
 *   $env:ADMIN_BOOTSTRAP_EMAIL="email@..."
 *   $env:ADMIN_BOOTSTRAP_PASSWORD="..."
 *   npx tsx scripts/bootstrap-admin-user.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const service =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || process.argv[2] || "").trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || process.argv[3] || "";

async function main() {
  if (!url || !service) {
    console.error("Faltam VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
    process.exit(1);
  }
  if (!email || !password) {
    console.error("Defina ADMIN_BOOTSTRAP_EMAIL e ADMIN_BOOTSTRAP_PASSWORD (ou passe email e senha como args).");
    process.exit(1);
  }

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome_zelador: "Administrador", nome_terreiro: "Sede Admin" },
  });

  if (createErr) {
    if (!String(createErr.message || "").toLowerCase().includes("registered")) {
      console.error("createUser:", createErr.message);
      process.exit(1);
    }
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) {
      console.error("listUsers:", listErr.message);
      process.exit(1);
    }
    const existing = list.users.find((u) => (u.email || "").toLowerCase() === email);
    if (!existing) {
      console.error("Utilizador existe mas não foi encontrado na listagem.");
      process.exit(1);
    }
    userId = existing.id;
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { ...(existing.user_metadata || {}), nome_zelador: "Administrador" },
    });
    if (updErr) {
      console.error("updateUser:", updErr.message);
      process.exit(1);
    }
    console.log("Conta já existia — senha e metadados actualizados.");
  } else {
    userId = created!.user.id;
    console.log("Conta Auth criada.");
  }

  const expires = new Date("2099-12-31T23:59:59.000Z").toISOString();

  const { error: subErr } = await admin.from("subscriptions").upsert(
    { id: userId, plan: "premium", status: "active", expires_at: expires },
    { onConflict: "id" }
  );
  if (subErr) console.warn("subscriptions:", subErr.message);

  const baseProfile = {
    id: userId,
    email,
    nome_terreiro: "Sede Admin",
    cargo: "Administrador",
    role: "admin",
    tenant_id: userId,
    is_blocked: false,
    deleted_at: null,
    updated_at: new Date().toISOString(),
  };

  const { error: pl0 } = await admin.from("perfil_lider").upsert(
    { ...baseProfile, is_admin_global: false },
    { onConflict: "id" }
  );
  if (pl0) {
    console.error("perfil_lider (base):", pl0.message);
    process.exit(1);
  }

  const { error: pl1 } = await admin.from("perfil_lider").update({ is_admin_global: true }).eq("id", userId);
  if (pl1) {
    console.warn("perfil_lider is_admin_global:", pl1.message);
    console.warn(
      "Executa no Supabase SQL Editor (como postgres):\n  UPDATE public.perfil_lider SET is_admin_global = true WHERE id = '" +
        userId +
        "';"
    );
  }

  console.log("OK. user_id=", userId);
  console.log("Podes entrar no AxéCloud Command com este e-mail e senha.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
