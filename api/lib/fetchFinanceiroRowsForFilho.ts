/**
 * Lista lançamentos do filho sem usar `.or()` composto no PostgREST (evita 500 com padrões ilike + UUID).
 */
export async function fetchFinanceiroRowsForFilho(
  supabaseAdmin: { from: (t: string) => any },
  filhoId: string,
  limit: number
): Promise<Record<string, unknown>[]> {
  const lim = Number.isFinite(limit) && limit > 0 ? Math.min(500, Math.floor(limit)) : 150;
  const cap = Math.min(500, lim * 4);

  const { error: probeErr } = await supabaseAdmin.from("financeiro").select("filho_id").limit(1);
  const hasFilhoId = !probeErr;

  const byId = new Map<string, Record<string, unknown>>();

  if (hasFilhoId) {
    const { data, error } = await supabaseAdmin
      .from("financeiro")
      .select("*")
      .eq("filho_id", filhoId)
      .order("data", { ascending: false })
      .limit(cap);
    if (error) throw error;
    for (const r of data || []) {
      const id = String((r as { id?: string }).id || "");
      if (id) byId.set(id, r as Record<string, unknown>);
    }
  }

  let q2 = supabaseAdmin
    .from("financeiro")
    .select("*")
    .ilike("descricao", `% (ID:${filhoId})%`)
    .order("data", { ascending: false })
    .limit(cap);
  if (hasFilhoId) {
    q2 = q2.eq("categoria", "Mensalidade");
  }
  const { data: data2, error: err2 } = await q2;
  if (err2) throw err2;
  for (const r of data2 || []) {
    const id = String((r as { id?: string }).id || "");
    if (id) byId.set(id, r as Record<string, unknown>);
  }

  const merged = [...byId.values()];
  merged.sort((a, b) => {
    const ta = new Date(String(a?.data || 0)).getTime();
    const tb = new Date(String(b?.data || 0)).getTime();
    return tb - ta;
  });
  return merged.slice(0, lim);
}
