import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Valida JWT Supabase (getUser + fallback getUserById com service_role). */
export async function verifyUser(
  supabaseAdmin: SupabaseClient,
  token: string
): Promise<{ user: User | null; error: Error | null }> {
  if (!token || token === "undefined" || token === "null") {
    return { user: null, error: new Error("Token inválido ou ausente") };
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (user && !error) return { user, error: null };

    if (token.includes(".")) {
      try {
        const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
        if (payload?.sub) {
          const { data: { user: adminUser }, error: adminError } =
            await supabaseAdmin.auth.admin.getUserById(payload.sub);
          if (adminUser && !adminError) return { user: adminUser, error: null };
        }
      } catch {
        /* ignore decode errors */
      }
    }
    return { user: null, error: error || new Error("Usuário não encontrado") };
  } catch (err) {
    return { user: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
