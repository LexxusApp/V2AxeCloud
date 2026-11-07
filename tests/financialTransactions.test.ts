import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllFinancialTransactions } from '../src/lib/financialTransactions.ts';
test('extrato lê todas as páginas e não limita o saldo aos últimos 200 movimentos', async () => {
  const calls: string[] = [];
  const all = Array.from({ length: 1203 }, (_, id) => ({ id: String(id), valor: 1 }));
  const result = await fetchAllFinancialTransactions(async url => {
    calls.push(url);
    const offset = Number(new URL(url, 'https://local.invalid').searchParams.get('offset'));
    return Response.json({ data: all.slice(offset, offset + 500), hasMore: offset + 500 < all.length, ledgerRevision: 'v1:1', offset });
  }, '/api/transactions?tenantId=test');
  assert.equal(result.data.length, 1203);
  assert.equal(calls.length, 3);
  assert.match(calls[2], /offset=1000/);
});
test('erro em página posterior e repetição de registros nunca retornam um saldo parcial como sucesso', async () => {
  const data = Array.from({ length: 500 }, (_, id) => ({ id: String(id) }));
  let page = 0;
  await assert.rejects(fetchAllFinancialTransactions(async () => ++page === 1 ? Response.json({ data, hasMore: true, ledgerRevision: 'v1:1', offset: 0 }) : new Response('', { status: 500 }), '/api/transactions?tenantId=test'), /extrato completo/);
  await assert.rejects(fetchAllFinancialTransactions(async url => Response.json({ data, hasMore: true, ledgerRevision: 'v1:1', offset: Number(new URL(url, 'https://local.invalid').searchParams.get('offset')) }), '/api/transactions?tenantId=test'), /mudou durante/);
});
test('resposta antiga curta também pode estar truncada depois de remover excluídos; nunca confirma o saldo', async () => {
  for (const count of [1,499,500]) await assert.rejects(fetchAllFinancialTransactions(async () => Response.json({ data: Array.from({ length: count }, (_, id) => ({ id: String(id) })) }), '/api/transactions?tenantId=test'), /serviço precisa ser atualizado/);
});
test('exclusão entre páginas reinicia a leitura e descarta todas as linhas da revisão anterior', async () => {
  let rows = Array.from({ length: 1001 }, (_, id) => ({ id: String(id), valor: id === 0 ? 1 : id === 500 ? 100 : 1 }));
  let revision = 1, changed = false;
  const result = await fetchAllFinancialTransactions<{id:string;valor:number}>(async url => {
    const offset = Number(new URL(url, 'https://local.invalid').searchParams.get('offset'));
    if (offset === 500 && !changed) { rows = rows.slice(1); revision++; changed = true; }
    return Response.json({ data: rows.slice(offset, offset + 500), hasMore: offset + 500 < rows.length, offset, ledgerRevision: 'v1:' + revision });
  }, '/api/transactions?tenantId=test');
  assert.equal(result.data.length, 1000);
  assert.equal(result.data.reduce((sum,row)=>sum+row.valor,0),1099);
  assert.equal(result.data.some(row=>row.id==='0'),false);
});
