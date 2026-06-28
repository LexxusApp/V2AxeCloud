import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

type QueryBuilder = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

/** Busca todas as linhas paginando (Supabase limita 1000 por request). */
export async function fetchAllTerreirosRows(
  sb: SupabaseClient,
  table: string,
  select: string,
  buildQuery?: (query: QueryBuilder, range: { from: number; to: number }) => QueryBuilder,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const from = offset;
    const to = offset + PAGE_SIZE - 1;
    let query = sb.from(table).select(select) as QueryBuilder;
    if (buildQuery) query = buildQuery(query, { from, to });
    else query = query.range(from, to);

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data || []) as Record<string, unknown>[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

export async function fetchTerreirosByCitySlug(
  sb: SupabaseClient,
  table: string,
  select: string,
  estado: string,
  cidadeSlug: string,
): Promise<Record<string, unknown>[]> {
  return fetchAllTerreirosRows(sb, table, select, (query, { from, to }) => {
    let q = query
      .eq("cidade_slug", cidadeSlug)
      .order("nome", { ascending: true })
      .range(from, to);
    if (estado.length === 2) {
      q = q.ilike("estado", estado.toUpperCase());
    }
    return q;
  });
}
