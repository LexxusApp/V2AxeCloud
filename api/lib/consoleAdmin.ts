/**
 * Acesso ao painel admin (API + axecloud-admin).
 * 1) E-mails em ADMIN_CONSOLE_EMAILS (ou ADMIN_EMAILS), separados por vírgula.
 * 2) OU perfil_lider.is_admin_global = true (por id do JWT ou pelo e-mail do perfil).
 */
export function getConsoleAdminEmailAllowlist(): string[] {
  const raw = process.env.ADMIN_CONSOLE_EMAILS || process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeEmail(email: string | null | undefined): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/** Garante is_admin_global no perfil do utilizador autenticado (allowlist). */
async function promoteConsoleAdminProfile(
  supabaseAdmin: { from: (t: string) => any },
  user: { id: string; email?: string | null }
): Promise<void> {
  const email = normalizeEmail(user.email);
  const { data: byId } = await supabaseAdmin
    .from("perfil_lider")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (byId) {
    await supabaseAdmin
      .from("perfil_lider")
      .update({ is_admin_global: true, ...(email ? { email } : {}) })
      .eq("id", user.id);
    return;
  }

  if (email) {
    const { data: byEmail } = await supabaseAdmin
      .from("perfil_lider")
      .select("id")
      .ilike("email", email)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (byEmail?.id) {
      await supabaseAdmin.from("perfil_lider").update({ is_admin_global: true }).eq("id", byEmail.id);
      return;
    }
  }

  await supabaseAdmin.from("perfil_lider").upsert({
    id: user.id,
    tenant_id: user.id,
    email: email || null,
    nome_terreiro: "Console Admin",
    role: "admin",
    is_admin_global: true,
  });
}

export async function isConsoleGlobalAdmin(
  supabaseAdmin: { from: (t: string) => any },
  user: { id: string; email?: string | null }
): Promise<boolean> {
  const email = normalizeEmail(user.email);
  const allowlist = getConsoleAdminEmailAllowlist();

  if (email && allowlist.includes(email)) {
    try {
      await promoteConsoleAdminProfile(supabaseAdmin, user);
    } catch (e) {
      console.warn("[consoleAdmin] promote:", (e as Error)?.message || e);
    }
    return true;
  }

  const { data: byId, error: byIdErr } = await supabaseAdmin
    .from("perfil_lider")
    .select("is_admin_global")
    .eq("id", user.id)
    .maybeSingle();

  if (byIdErr) {
    console.warn("[consoleAdmin] perfil_lider by id:", byIdErr.message);
  } else if ((byId as { is_admin_global?: boolean } | null)?.is_admin_global) {
    return true;
  }

  if (email) {
    const { data: byEmail, error: byEmailErr } = await supabaseAdmin
      .from("perfil_lider")
      .select("is_admin_global")
      .ilike("email", email)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (byEmailErr) {
      console.warn("[consoleAdmin] perfil_lider by email:", byEmailErr.message);
    } else if ((byEmail as { is_admin_global?: boolean } | null)?.is_admin_global) {
      return true;
    }
  }

  return false;
}
