import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isConsoleGlobalAdmin } from "./consoleAdmin.js";
import { sendJson } from "./discreteSupabase.js";
import { getBearerToken } from "./requireAuth.js";
import { verifyUser } from "./verifyUser.js";

export async function requireConsoleAdminDiscrete(
  supabaseAdmin: SupabaseClient,
  req: any,
  res: any
): Promise<{ user: User } | null> {
  const token = getBearerToken(req);
  if (!token) {
    sendJson(res, 401, { error: "Não autorizado" });
    return null;
  }
  const { user, error: authError } = await verifyUser(supabaseAdmin, token);
  if (authError || !user) {
    sendJson(res, 401, { error: "Sessão inválida" });
    return null;
  }
  const ok = await isConsoleGlobalAdmin(supabaseAdmin, user);
  if (!ok) {
    sendJson(res, 403, { error: "Acesso negado ao console administrativo" });
    return null;
  }
  return { user };
}

const missingTableUntil = new Map<string, number>();

function tableKey(tableHint: string): string {
  return tableHint.toLowerCase().replace(/^public\./, "");
}

/** Evita repetir consultas a tabelas que já falharam com PGRST205 neste processo. */
export function rememberMissingTable(tableHint: string, ttlMs = 5 * 60_000): void {
  missingTableUntil.set(tableKey(tableHint), Date.now() + ttlMs);
}

export function isRememberedMissingTable(tableHint: string): boolean {
  const key = tableKey(tableHint);
  const until = missingTableUntil.get(key);
  if (until == null) return false;
  if (until <= Date.now()) {
    missingTableUntil.delete(key);
    return false;
  }
  return true;
}

export function isMissingOrUnknownTable(
  err: { message?: string; details?: string; code?: string } | null | undefined,
  tableHint: string
): boolean {
  const m = `${String(err?.message || "")} ${String(err?.details || "")}`.toLowerCase();
  const t = tableKey(tableHint);
  if (!m.includes(t)) return false;
  const missing =
    /schema cache|does not exist|could not find|undefined relation|unknown table|not find the table|pgrst/i.test(
      m
    ) || String(err?.code || "") === "PGRST205";
  if (missing) rememberMissingTable(t);
  return missing;
}
