import type { SupabaseClient, User } from "@supabase/supabase-js";
import { verifyUser } from "./verifyUser.js";

export function getBearerToken(req: { headers?: Record<string, string | string[] | undefined> }): string {
  const raw = req.headers?.authorization || req.headers?.Authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  return String(header || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

export async function requireAuthUser(
  supabaseAdmin: SupabaseClient,
  req: { headers?: Record<string, string | string[] | undefined> }
): Promise<{ user: User } | { error: string; status: number }> {
  const token = getBearerToken(req);
  if (!token) return { error: "Não autorizado", status: 401 };

  try {
    const { user, error } = await verifyUser(supabaseAdmin, token);
    if (error || !user) return { error: "Sessão inválida", status: 401 };
    return { user };
  } catch {
    return { error: "Sessão inválida", status: 401 };
  }
}

/** Envia resposta 401/403 e retorna null se não autenticado. */
export async function requireAuthOrRespond(
  supabaseAdmin: SupabaseClient,
  req: { headers?: Record<string, string | string[] | undefined> },
  res: { status: (n: number) => { json: (b: unknown) => unknown } }
): Promise<User | null> {
  try {
    const result = await requireAuthUser(supabaseAdmin, req);
    if ("error" in result) {
      res.status(result.status).json({ error: result.error });
      return null;
    }
    return result.user;
  } catch {
    res.status(401).json({ error: "Sessão inválida" });
    return null;
  }
}
