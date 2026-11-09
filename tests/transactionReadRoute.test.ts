import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { registerTransactionReadRoute } from '../api/lib/transactionReadRoute.ts';
import { fetchAllFinancialTransactions } from '../src/lib/financialTransactions.ts';
const owner='10000000-0000-4000-8000-000000000001', outside='10000000-0000-4000-8000-000000000002';
const child='20000000-0000-4000-8000-000000000001', childAuth='30000000-0000-4000-8000-000000000001';
async function setup(t:any) {
  let revision=1, changeDuringRead=false, missingRevision=false, rowReads=0;
  const tables:Record<string,any[]>={perfil_lider:[{id:owner,tenant_id:owner,is_admin_global:false},{id:outside,tenant_id:outside},{id:childAuth,tenant_id:owner}],filhos_de_santo:[{id:child,user_id:childAuth,tenant_id:owner,lider_id:owner,email:'member@example.invalid'}],financeiro:Array.from({length:1001},(_,id)=>({id:String(id).padStart(5,'0'),tenant_id:owner,lider_id:owner,filho_id:id===0?child:null,data:'2026-10-31',status:id===1?'excluido':'pago',valor:1,descricao:'Movimento '+id}))};
  const roles:any={owner:{id:owner,email:'owner@example.invalid'},member:{id:childAuth,email:'member@example.invalid'},outside:{id:outside,email:'outside@example.invalid'}};
  const tokens=new Map<string,any>(), headers:any={};for(const [key,user] of Object.entries(roles)){const token=randomUUID();tokens.set(token,user);headers[key]={authorization:'Bearer '+token};}
  const sb:any={auth:{getUser:async(token:string)=>({data:{user:tokens.get(token)||null},error:null}),admin:{getUserById:async(id:string)=>({data:{user:Object.values(roles).find((user:any)=>user.id===id)||null}})}},from(table:string){let rows=table==='financeiro_revisoes'?[{tenant_id:owner,revisao:revision}]:[...(tables[table]||[])],columns='*';
    const result=()=>rows.map(row=>columns==='*'?row:Object.fromEntries(columns.split(',').map(key=>[key.trim(),row[key.trim()]])));
    const q:any={select:(value:string)=>{columns=value;return q;},eq:(key:string,value:any)=>{rows=rows.filter(row=>row[key]===value);return q;},in:(key:string,values:any[])=>{rows=rows.filter(row=>values.includes(row[key]));return q;},or:(value:string)=>{rows=rows.filter(row=>value.split(',').some(part=>{const[key,,val]=part.split('.');return String(row[key])===val;}));return q;},ilike:(key:string,value:string)=>{rows=rows.filter(row=>String(row[key]||'').toLowerCase().includes(value.replace(/%/g,'').toLowerCase()));return q;},order:()=>q,limit:(size:number)=>{rows=rows.slice(0,size);return q;},range:(from:number,to:number)=>{rows=rows.slice(from,to+1);return q;},maybeSingle:async()=>({data:result()[0]||null,error:table==='financeiro_revisoes'&&missingRevision?{code:'42P01'}:null}),then:(resolve:any)=>{if(table==='financeiro'){rowReads++;if(changeDuringRead){revision++;changeDuringRead=false;}}return Promise.resolve({data:result(),error:null}).then(resolve);}};return q;}};
  const app=express();registerTransactionReadRoute(app,{supabaseAdmin:sb});const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  return {tables,request:(path:string,role='owner')=>fetch(base+path,{headers:headers[role]||{}}),mutateDuringRead:()=>{changeDuringRead=true;},withoutRevision:()=>{missingRevision=true;},get rowReads(){return rowReads;}};
}
const base='/api/transactions?tenantId='+owner+'&userRole=admin';
test('páginas versionadas preservam hasMore antes do filtro de excluídos e o cliente carrega todos os registros',async t=>{
  const f=await setup(t);const first=await(await f.request(base+'&limit=500&offset=0')).json();assert.equal(first.data.length,499);assert.equal(first.hasMore,true);assert.equal(first.ledgerRevision,'v1:1');
  const result=await fetchAllFinancialTransactions<{id:string}>(url=>f.request(url),base);assert.equal(result.data.length,1000);assert.ok(!result.data.some(row=>row.id==='00001'));
});
test('alteração durante a consulta é conflito recuperável, não sucesso com saldo misturado',async t=>{
  const f=await setup(t);f.mutateDuringRead();const response=await f.request(base+'&limit=500&offset=0');assert.equal(response.status,409);assert.equal((await response.json()).code,'FINANCE_SNAPSHOT_CHANGED');
});
test('sem migração de revisão, consulta paginada falha fechada; cliente antigo continua com o contrato anterior',async t=>{
  const f=await setup(t);f.withoutRevision();assert.equal((await f.request(base+'&limit=500&offset=0')).status,503);assert.equal(f.rowReads,0);assert.equal((await f.request(base+'&limit=20')).status,200);
});
test('sessão e posse valem no servidor; filho não ganha visão da casa declarando userRole admin',async t=>{
  const f=await setup(t);assert.equal((await f.request(base,'anonymous')).status,401);assert.equal((await f.request(base,'outside')).status,403);
  const response=await f.request(base+'&limit=500&offset=0','member');assert.equal(response.status,200);const data=await response.json();assert.deepEqual(data.data.map((row:any)=>row.id),['00000']);
  assert.equal((await f.request(base+'&limit=501&offset=-1')).status,400);
});

test('co-admin com Financeiro liberado consulta a casa; o modo pessoal e a revogação continuam limitados ao próprio membro',async t=>{
 const f=await setup(t);f.tables.filhos_de_santo[0].status='Ativo';
 const grant={tenant_id:owner,filho_id:child,user_id:childAuth,ativo:true,permissoes:{finance:'visualizar'}};
 f.tables.piloto_coadministradores=[grant];
 const management=await f.request(base+'&limit=500&offset=0','member');assert.equal(management.status,200);
 const snapshot=await management.json();assert.equal(snapshot.ledgerRevision,'v1:1');assert.equal(snapshot.hasMore,true);assert.equal(snapshot.data.length,499);
 const personal='/api/transactions?tenantId='+owner+'&userRole=filho';
 assert.deepEqual((await(await f.request(personal,'member')).json()).data.map((row:any)=>row.id),['00000']);
 grant.ativo=false;const revoked=await(await f.request(base,'member')).json();assert.equal(revoked.ledgerRevision,undefined);assert.deepEqual(revoked.data.map((row:any)=>row.id),['00000']);
});
