import type { SupabaseClient } from "@supabase/supabase-js";

/** E-mail obrigatório em perfil_lider — nunca retorna string vazia. */
export async function resolvePerfilLiderEmail(
  supabaseAdmin: SupabaseClient,
  user: { id: string; email?: string | null }
): Promise<string> {
  const fromJwt = String(user.email || "").trim().toLowerCase();
  if (fromJwt) return fromJwt;

  try {
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(user.id);
    const fromAuth = String(authData?.user?.email || "").trim().toLowerCase();
    if (fromAuth) return fromAuth;
  } catch {
    /* auth admin indisponível */
  }

  const { data: prof } = await supabaseAdmin
    .from("perfil_lider")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();
  const fromProfile = String(prof?.email || "").trim().toLowerCase();
  if (fromProfile) return fromProfile;

  return `u_${user.id.replace(/-/g, "").slice(0, 24)}@axecloud.local`;
}
