import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getConsoleAdminEmailAllowlist, isConsoleGlobalAdmin } from "./consoleAdmin.js";
import { sendJson } from "./discreteSupabase.js";
import { verifyUser } from "./verifyUser.js";

export async function requireConsoleAdminDiscrete(
  supabaseAdmin: SupabaseClient,
  req: any,
  res: any
): Promise<{ user: User } | null> {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader) {
    sendJson(res, 401, { error: "Não autorizado" });
    return null;
  }
  const token = String(authHeader).replace(/^Bearer\s+/i, "").trim();
  const { user, error: authError } = await verifyUser(supabaseAdmin, token);
  if (authError || !user) {
    sendJson(res, 401, { error: "Sessão inválida" });
    return null;
  }
  const ok = await isConsoleGlobalAdmin(supabaseAdmin, user);
  if (!ok) {
    const allow = getConsoleAdminEmailAllowlist();
    const userEmail = String(user.email || "")
      .trim()
      .toLowerCase();
    sendJson(res, 403, {
      error: "Acesso negado ao console administrativo",
      debug: {
        userEmail,
        allowlistCount: allow.length,
        hint: !allow.includes(userEmail)
          ? `O email "${userEmail}" não está na allowlist do servidor.`
          : "Perfil admin global ausente em perfil_lider.",
      },
    });
    return null;
  }
  return { user };
}

export function isMissingOrUnknownTable(
  err: { message?: string; details?: string; code?: string } | null | undefined,
  tableHint: string
): boolean {
  const m = `${String(err?.message || "")} ${String(err?.details || "")}`.toLowerCase();
  const t = tableHint.toLowerCase().replace(/^public\./, "");
  if (!m.includes(t)) return false;
  return (
    /schema cache|does not exist|could not find|undefined relation|unknown table|not find the table|pgrst/i.test(
      m
    ) || String(err?.code || "") === "PGRST205"
  );
}
