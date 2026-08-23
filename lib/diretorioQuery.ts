import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

type QueryBuilder = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

export function selectColumnFromSchemaError(error: unknown): string | null {
  const message = String((error as { message?: string })?.message || (error as Error)?.message || "");
  return (
    message.match(/Could not find the '([^']+)' column/i)?.[1] ||
    message.match(/column "([^"]+)" does not exist/i)?.[1] ||
    null
  );
}

export function omitSelectColumn(select: string, column: string): string {
  return select
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && part !== column)
    .join(", ");
}

async function fetchRange(
  sb: SupabaseClient,
  table: string,
  select: string,
  from: number,
  to: number,
  buildQuery?: (query: QueryBuilder, range: { from: number; to: number }) => QueryBuilder,
): Promise<Record<string, unknown>[]> {
  let query = sb.from(table).select(select) as QueryBuilder;
  query = buildQuery ? buildQuery(query, { from, to }) : query.range(from, to);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Record<string, unknown>[];
}

/** Busca todas as linhas paginando (Supabase limita 1000 por request). */
export async function fetchAllTerreirosRows(
  sb: SupabaseClient,
  table: string,
  select: string,
  buildQuery?: (query: QueryBuilder, range: { from: number; to: number }) => QueryBuilder,
): Promise<Record<string, unknown>[]> {
  if (!buildQuery) {
    const { count, error } = await sb.from(table).select(select, { count: "exact", head: true });
    if (error) throw error;
    const total = count || 0;
    if (total === 0) return [];
    const pages = Math.min(20, Math.ceil(total / PAGE_SIZE));
    const batches = await Promise.all(
      Array.from({ length: pages }, (_, index) => {
        const from = index * PAGE_SIZE;
        return fetchRange(sb, table, select, from, from + PAGE_SIZE - 1);
      }),
    );
    return batches.flat();
  }

  const all: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const from = offset;
    const to = offset + PAGE_SIZE - 1;
    const batch = await fetchRange(sb, table, select, from, to, buildQuery);
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

/** Igual ao fetch paginado, mas tira colunas ausentes no schema (migration pendente). */
export async function fetchAllTerreirosRowsResilient(
  sb: SupabaseClient,
  table: string,
  select: string,
  buildQuery?: (query: QueryBuilder, range: { from: number; to: number }) => QueryBuilder,
): Promise<Record<string, unknown>[]> {
  let current = select;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await fetchAllTerreirosRows(sb, table, current, buildQuery);
    } catch (error) {
      const column = selectColumnFromSchemaError(error);
      if (!column) throw error;
      const next = omitSelectColumn(current, column);
      if (!next || next === current) throw error;
      console.warn(`[diretorioQuery] coluna ausente "${column}", retry sem ela`);
      current = next;
    }
  }
  throw new Error("fetchAllTerreirosRowsResilient: retries esgotadas");
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

export async function fetchTerreirosByEstado(
  sb: SupabaseClient,
  table: string,
  select: string,
  estado: string,
): Promise<Record<string, unknown>[]> {
  const uf = String(estado || "").trim().toUpperCase();
  if (uf.length !== 2) return [];
  return fetchAllTerreirosRows(sb, table, select, (query, { from, to }) =>
    query
      .ilike("estado", uf)
      .order("cidade", { ascending: true })
      .order("nome", { ascending: true })
      .range(from, to),
  );
}
