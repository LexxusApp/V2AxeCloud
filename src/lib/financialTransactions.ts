/** All pages are required before calculating the cash balance. Never return a partial success. */
export async function fetchAllFinancialTransactions<T extends { id: string }>(
  fetcher: (url: string) => Promise<Response>, baseUrl: string,
): Promise<{ data: T[] }> {
  const size = 500;
  class SnapshotChanged extends Error {}
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows: T[] = [], ids = new Set<string>();
    let revision = '';
    try {
      for (let page = 0; page < 200; page++) {
        const response = await fetcher(`${baseUrl}&limit=${size}&offset=${page * size}`);
        const result = await response.json().catch(() => ({}));
        if (response.status === 409 && result.code === 'FINANCE_SNAPSHOT_CHANGED') throw new SnapshotChanged();
        if (!response.ok) throw Error('Não foi possível carregar o extrato completo. Tente novamente.');
        if (!Array.isArray(result.data) || result.data.length > size) throw Error('O serviço retornou um extrato inválido.');
        // Even a short legacy response may be truncated after deleted rows were
        // removed. Only a versioned page can confirm a complete cash balance.
        if (typeof result.ledgerRevision !== 'string' || !result.ledgerRevision || typeof result.hasMore !== 'boolean' || result.offset !== page * size) throw Error('O serviço precisa ser atualizado para consultar o histórico completo.');
        if (page && revision !== result.ledgerRevision) throw new SnapshotChanged();
        revision = result.ledgerRevision;
        for (const row of result.data as T[]) {
          if (!row.id || ids.has(row.id)) throw new SnapshotChanged();
          ids.add(row.id); rows.push(row);
        }
        if (!result.hasMore) return { data: rows };
      }
      throw Error('O extrato excedeu o limite de consulta. Solicite a exportação completa ao suporte.');
    } catch (error) {
      if (!(error instanceof SnapshotChanged)) throw error;
    }
  }
  throw Error('O extrato mudou durante a leitura. Atualize para conferir o saldo completo.');
}
