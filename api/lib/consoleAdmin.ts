/**
 * Acesso ao painel admin (API + axecloud-admin).
 * 1) E-mails em ADMIN_CONSOLE_EMAILS (ou ADMIN_EMAILS), separados por vírgula.
 * 2) OU perfil_lider.is_admin_global = true no mesmo id do JWT autenticado.
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

const ADMIN_OK_TTL_MS = 45_000;
const adminOkCache = new Map<string, { exp: number }>();

export function clearConsoleAdminCache(): void {
  adminOkCache.clear();
}

function adminCacheKey(user: { id: string; email?: string | null }): string {
  return `${user.id}:${normalizeEmail(user.email)}`;
}

/** Garante is_admin_global no perfil do utilizador autenticado (allowlist). */
async function promoteConsoleAdminProfile(
  supabaseAdmin: { from: (t: string) => any },
  user: { id: string; email?: string | null }
): Promise<void> {
  const email = normalizeEmail(user.email);
  const { data: byId } = await supabaseAdmin
    .from("perfil_lider")
    .select("id, is_admin_global")
    .eq("id", user.id)
    .maybeSingle();

  if (!byId) {
    // Nunca promover outro UUID por coincidência de e-mail: perfis antigos podem
    // ficar órfãos após uma troca de endereço e transfeririam privilégio.
    return;
  }

  if ((byId as { is_admin_global?: boolean }).is_admin_global === true) return;

  await supabaseAdmin
    .from("perfil_lider")
    .update({ is_admin_global: true, ...(email ? { email } : {}) })
    .eq("id", user.id);
}

export async function isConsoleGlobalAdmin(
  supabaseAdmin: { from: (t: string) => any },
  user: { id: string; email?: string | null }
): Promise<boolean> {
  const cacheKey = adminCacheKey(user);
  const cached = adminOkCache.get(cacheKey);
  if (cached && cached.exp > Date.now()) return true;

  const email = normalizeEmail(user.email);
  const allowlist = getConsoleAdminEmailAllowlist();

  if (email && allowlist.includes(email)) {
    try {
      await promoteConsoleAdminProfile(supabaseAdmin, user);
    } catch (e) {
      console.warn("[consoleAdmin] promote:", (e as Error)?.message || e);
    }
    adminOkCache.set(cacheKey, { exp: Date.now() + ADMIN_OK_TTL_MS });
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
    adminOkCache.set(cacheKey, { exp: Date.now() + ADMIN_OK_TTL_MS });
    return true;
  }

  return false;
}
