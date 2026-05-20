/** Lista terreiros reais (zeladores) para operações do console admin — exclui filhos e perfis internos. */
export type ConsoleTenantRow = {
  id: string;
  email: string | null;
  nome_terreiro: string | null;
  tenant_id?: string | null;
};

function isShadowFilhoEmail(email?: string | null): boolean {
  return typeof email === "string" && /(^f_[a-f0-9-]{8,}@|@axecloud\.internal$)/i.test(email);
}

export async function listConsoleTenants(supabaseAdmin: any): Promise<ConsoleTenantRow[]> {
  const { data: profiles, error: pError } = await supabaseAdmin
    .from("perfil_lider")
    .select("id, email, nome_terreiro, tenant_id")
    .is("deleted_at", null);
  if (pError) throw pError;

  const { data: childrenRaw, error: cError } = await supabaseAdmin
    .from("filhos_de_santo")
    .select("user_id");
  if (cError) throw cError;

  const childUserIdSet = new Set<string>(
    (childrenRaw || []).map((c: { user_id?: string | null }) => String(c.user_id || "")).filter(Boolean)
  );

  return (profiles || []).filter((p: ConsoleTenantRow) => {
    if (childUserIdSet.has(String(p.id))) return false;
    if (isShadowFilhoEmail(p.email)) return false;
    return true;
  }) as ConsoleTenantRow[];
}
