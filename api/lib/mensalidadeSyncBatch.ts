const CHILD_BATCH = 25;
const PAGE_SIZE = 1000;
const WRITE_BATCH = 100;

/** IDs must come from the authenticated tenant's member list, never the request body. */
export async function readMensalidadesForChildren(sb: any, childIds: string[], supportsFilhoId: boolean): Promise<any[]> {
  const ids = [...new Set(childIds.map(id => String(id).trim().toLowerCase()))];
  if (ids.some(id => !/^[0-9a-f-]{36}$/.test(id))) throw new Error('Identificador de membro inválido');
  const rows = new Map<string, any>();
  for (let offset = 0; offset < ids.length; offset += CHILD_BATCH) {
    const batch = ids.slice(offset, offset + CHILD_BATCH);
    // The description branch also covers legacy rows whose filho_id is null.
    const filters = batch.map(id => `descricao.ilike.%ID:${id}%`);
    if (supportsFilhoId) filters.unshift(`filho_id.in.(${batch.join(',')})`);
    for (let start = 0; ; start += PAGE_SIZE) {
      const {data, error} = await sb.from('financeiro').select('*').eq('categoria', 'Mensalidade')
        .or(filters.join(',')).order('id', {ascending: true}).range(start, start + PAGE_SIZE - 1);
      if (error) throw error; // Never generate new charges from an incomplete snapshot.
      for (const row of data || []) rows.set(String(row.id), row);
      if ((data || []).length < PAGE_SIZE) break;
    }
  }
  return [...rows.values()];
}

export async function insertMensalidadesBatch(sb: any, rows: Record<string, unknown>[]): Promise<number> {
  let created = 0;
  for (let start = 0; start < rows.length; start += WRITE_BATCH) {
    const batch = rows.slice(start, start + WRITE_BATCH).map(row => ({...row}));
    // Keep compatibility with older schemas; other failures must reach the caller.
    for (let attempt = 0; ; attempt++) {
      const {error} = await sb.from('financeiro').insert(batch);
      if (!error) { created += batch.length; break; }
      const message = String(error.message || '').toLowerCase();
      const missing = ['data_vencimento', 'filho_id', 'status'].find(key =>
        Object.hasOwn(batch[0], key) && message.includes(key) &&
        (['42703', 'PGRST204'].includes(error.code) || /does not exist|schema cache|could not find/.test(message)));
      if (!missing || attempt >= 3) throw error;
      for (const row of batch) delete row[missing];
    }
  }
  return created;
}

const running = new Map<string, Promise<any>>();
/** Share concurrent requests; completed results are not cached. */
export function singleFlightMensalidadeSync<T>(key: string, task: () => Promise<T>): Promise<T> {
  const pending = running.get(key);
  if (pending) return pending;
  const promise = Promise.resolve().then(task).finally(() => {
    if (running.get(key) === promise) running.delete(key);
  });
  running.set(key, promise);
  return promise;
}
