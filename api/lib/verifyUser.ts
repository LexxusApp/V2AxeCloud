import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Valida JWT Supabase via getUser — sem fallback inseguro. */
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
    return { user: null, error: error || new Error("Usuário não encontrado") };
  } catch (err) {
    return { user: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
