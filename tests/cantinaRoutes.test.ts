import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import express from 'express';
import { registerCantinaRoutes } from '../api/lib/cantinaRoutes.js';

const owner = '00000000-0000-4000-8000-000000000001';
const member = '00000000-0000-4000-8000-000000000002';
const outsider = '00000000-0000-4000-8000-000000000003';

// A API e as verificações de autorização são reais; apenas o cliente do banco é controlado.
function database() {
  const tables: Record<string, any[]> = {
    perfil_lider: [{ id: owner, tenant_id: owner }],
    filhos_de_santo: [{ id: member, tenant_id: owner, lider_id: owner, nome: 'Membro de teste', limite_lojinha: 100 }],
    financeiro: [], produtos: [], cantina_cardapio: [],
  };
  let rpcCalls = 0;
  const client: any = {
    auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) },
    rpc: async (_name: string, args: any) => {
      rpcCalls++;
      if (_name === 'pagamento_caderneta') {
        const rows = tables.financeiro.filter(tx => (tx.tenant_id === args.p_tenant_id || tx.lider_id === args.p_tenant_id) && ['Loja','Cantina'].includes(tx.categoria) &&
          (!args.p_filho_id || tx.filho_id === args.p_filho_id) && (!args.p_transacao_id || tx.id === args.p_transacao_id) && tx.status === (args.p_acao === 'estornar' ? 'pago' : 'pendente'));
        rows.forEach(tx => { tx.status = args.p_acao === 'liquidar' ? 'pago' : args.p_acao === 'cancelar' ? 'cancelado' : 'pendente'; });
        return { data: rows.length, error: null };
      }
      const existing = tables.financeiro.find(t => t.cantina_comanda_id === args.p_comanda_id);
      if (existing) return { data: existing, error: null };
      const tx = {
        id: randomUUID(), tenant_id: args.p_tenant_id, lider_id: args.p_lider_id,
        filho_id: args.p_filho_id, cantina_itens: args.p_itens,
        cantina_comanda_id: args.p_comanda_id, categoria: 'Cantina', tipo: 'entrada',
        data: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
        descricao: 'Comanda registrada', status: args.p_forma_pagamento === 'pago' ? 'pago' : 'pendente',
        valor: args.p_itens.reduce((sum: number, item: any) => sum + item.quantidade * item.preco, 0),
      };
      tables.financeiro.push(tx);
      return { data: tx, error: null };
    },
    from(name: string) {
      let rows = tables[name] || [];
      let update: any;
      const query: any = {
        select: () => query, order: () => query,
        range: (from: number, to: number) => { rows = rows.slice(from, to+1); return query; },
        eq: (key: string, val: any) => { rows = rows.filter(r => r[key] === val); return query; },
        in: (key: string, vals: any[]) => { rows = rows.filter(r => vals.includes(r[key])); return query; },
        or: (filter: string) => {
          rows = rows.filter(r => filter.split(',').some(part => {
            const [key, , val] = part.split('.'); return r[key] === val;
          })); return query;
        },
        update: (value: any) => { update = value; return query; },
        insert: (value: any) => { const item={id:randomUUID(),ativo:true,updated_at:new Date().toISOString(),...value}; tables[name].push(item); rows=[item]; return query; },
        single: async () => ({data:rows[0] || null,error:null}),
        maybeSingle: async () => { if(update) rows.forEach(r=>Object.assign(r,update)); return { data: rows[0] || null, error: null }; },
        then: (resolve: any, reject: any) => {
          if (update) rows.forEach(r => Object.assign(r, update));
          return Promise.resolve({ data: structuredClone(rows), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { client, tables, calls: () => rpcCalls };
}

async function fixture(t: any) {
  const db = database();
  const app = express();
  app.use(express.json());
  registerCantinaRoutes(app, { supabaseAdmin: db.client, resolveLeaderId: async id => id });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address() as { port: number };
  const request = (path: string, body?: unknown, auth = true, method?:string) => fetch(`http://127.0.0.1:${address.port}/api/v1/cantina/${path}`, {
    method: method || (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer fixture-${randomUUID()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ...db, request };
}

test('comanda → releitura da caderneta → quitação preserva itens e quantidades', async t => {
  const { request } = await fixture(t);
  const items = [{ nome: 'Produto A', quantidade: 2, preco: 3.5 }, { nome: 'Produto B', quantidade: 1, preco: 7.5 }];
  const saved = await request('consumo', { tenantId: owner, filhoId: member, itens: items, valor: 0, formaPagamento: 'fiado', comandaId: randomUUID() });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).transaction.valor, 14.5, 'total calculado a partir dos itens');
  const read = await (await request(`data?tenantId=${owner}`)).json();
  assert.equal(read.filhos[0].saldo_pendente, 14.5);
  assert.equal(read.filhos[0].saldo_disponivel, 85.5);
  assert.equal(read.stats.total_pendente, 14.5);
  assert.deepEqual(read.filhos[0].historico[0].cantina_itens, items);
  const paid = await request('liquidar', { tenantId: owner, filhoId: member });
  assert.equal((await paid.json()).count, 1);
  const reread = await (await request(`data?tenantId=${owner}`)).json();
  assert.equal(reread.filhos[0].saldo_pendente, 0);
  assert.equal(reread.stats.total_recebido_mes, 14.5);
  assert.equal(reread.filhos[0].historico[0].status, 'pago');
  assert.deepEqual(reread.filhos[0].historico[0].cantina_itens, items);
});

test('venda avulsa à vista entra no recebido do mês', async t => {
  const { request } = await fixture(t);
  const result = await request('consumo', { tenantId: owner, filhoId: null, itens: [{ nome: 'Produto', quantidade: 3, preco: 2 }], formaPagamento: 'pago' });
  assert.equal(result.status, 200);
  const read = await (await request(`data?tenantId=${owner}`)).json();
  assert.equal(read.stats.total_recebido_mes, 6);
  assert.equal(read.stats.total_pendente, 0);
});

test('rejeita sem autenticação, outra casa, quantidade inválida e fiado avulso', async t => {
  const { request, calls } = await fixture(t);
  assert.equal((await request(`data?tenantId=${owner}`, undefined, false)).status, 401);
  assert.equal((await request(`data?tenantId=${outsider}`)).status, 403);
  for (const body of [
    { tenantId: outsider, filhoId: member, itens: [{ nome: 'A', quantidade: 1, preco: 2 }], formaPagamento: 'fiado' },
    { tenantId: owner, filhoId: member, itens: [{ nome: 'A', quantidade: -1, preco: 2 }], formaPagamento: 'fiado' },
    { tenantId: owner, itens: [{ nome: 'A', quantidade: 1, preco: 2 }], formaPagamento: 'fiado' },
  ]) assert.ok((await request('consumo', body)).status >= 400);
  assert.equal(calls(), 0);
});

test('baixa específica não altera mensalidade, outra casa nem inventa um pagamento', async t => {
  const { request, tables } = await fixture(t);
  const monthly = randomUUID(), other = randomUUID();
  tables.financeiro.push({ id: monthly, tenant_id: owner, categoria: 'Mensalidade', status: 'pendente' });
  tables.financeiro.push({ id: other, tenant_id: outsider, categoria: 'Cantina', status: 'pendente' });
  for (const id of [monthly, other, randomUUID()]) {
    assert.equal((await (await request('liquidar', { tenantId: owner, transactionId: id })).json()).count, 0);
  }
  assert.ok(tables.financeiro.every(tx => tx.status === 'pendente'));
});

test('cardápio compartilhado persiste cadastro e impede edição desatualizada ou de outra casa',async t=>{
 const {request}=await fixture(t);
 const item={tenantId:owner,nome:'Café',preco:4,icon:'☕',cat:'bebidas'};
 const created=await request('cardapio',item);assert.equal(created.status,200);const saved=(await created.json()).item;
 const reload=await(await request(`cardapio?tenantId=${owner}`)).json();assert.equal(reload.items[0].id,saved.id);assert.equal(reload.items[0].preco,4);
 assert.equal((await request(`cardapio/${saved.id}`,{...item,preco:5,expectedUpdatedAt:'2020-01-01T00:00:00.000Z'},true,'PATCH')).status,409);
 assert.equal((await request(`cardapio/${saved.id}`,{...item,tenantId:outsider,expectedUpdatedAt:saved.updated_at},true,'PATCH')).status,403);
 assert.equal((await request(`cardapio/${saved.id}`,{...item,preco:5,expectedUpdatedAt:saved.updated_at},true,'PATCH')).status,200);
 assert.equal((await request('cardapio',{...item,preco:0})).status,400);
 assert.equal((await request(`cardapio/${saved.id}`,{tenantId:owner},true,'DELETE')).status,200);
 assert.equal((await(await request(`cardapio?tenantId=${owner}`)).json()).items.length,0);
});

test('cancelamento sai dos totais e permanece no histórico; Loja não infla vendas da Cantina',async t=>{
 const {request,tables}=await fixture(t);const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
 tables.financeiro.push({id:randomUUID(),tenant_id:owner,filho_id:member,categoria:'Cantina',status:'cancelado',valor:50,data:today});
 tables.financeiro.push({id:randomUUID(),tenant_id:owner,filho_id:member,categoria:'Loja',status:'pago',valor:100,data:today});
 const result=await(await request(`data?tenantId=${owner}`)).json();assert.equal(result.stats.total_pendente,0);assert.equal(result.stats.total_recebido_mes,0);assert.equal(result.stats.total_vendas_mes,0);
 assert.equal(result.filhos[0].historico.length,2);assert.equal(result.transactions.length,2);
});
