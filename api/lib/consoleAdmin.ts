/**
 * Acesso ao painel admin (API + futuro axecloud-admin).
 * 1) E-mails em ADMIN_CONSOLE_EMAILS (ou ADMIN_EMAILS), separados por vírgula.
 * 2) OU perfil_lider.is_admin_global = true para o mesmo id do JWT.
 */
export function getConsoleAdminEmailAllowlist(): string[] {
  const raw = process.env.ADMIN_CONSOLE_EMAILS || process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function isConsoleGlobalAdmin(
  supabaseAdmin: { from: (t: string) => any },
  user: { id: string; email?: string | null }
): Promise<boolean> {
  const email = String(user.email || "")
    .trim()
    .toLowerCase();
  if (email && getConsoleAdminEmailAllowlist().includes(email)) return true;

  const { data, error } = await supabaseAdmin
    .from("perfil_lider")
    .select("is_admin_global")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("[consoleAdmin] perfil_lider:", error.message);
    return false;
  }
  return !!(data as { is_admin_global?: boolean } | null)?.is_admin_global;
}
