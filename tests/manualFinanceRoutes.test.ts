import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { registerManualFinanceRoutes } from '../api/lib/manualFinanceRoutes.ts';
const owner='11111111-1111-4111-8111-111111111111';
async function setup(t:any) {
 let calls:any[]=[];let result:any={data:{id:randomUUID()},error:null};
 const client:any={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},
  from(){let rows:any[]=[{id:owner,tenant_id:owner}];const q:any={select:()=>q,eq:(key:string,value:string)=>{rows=rows.filter(r=>r[key]===value);return q;},or:(filter:string)=>{rows=rows.filter(r=>filter.split(',').some(x=>{const [k,,v]=x.split('.');return r[k]===v;}));return q;},maybeSingle:async()=>({data:rows[0]||null,error:null})};return q;},
  rpc:async(name:string,args:any)=>{calls.push({name,args});return result;}};
 const app=express();app.use(express.json());registerManualFinanceRoutes(app,{supabaseAdmin:client});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));t.after(()=>new Promise<void>(r=>server.close(()=>r())));
 const address=server.address() as {port:number};
 const post=(body:any,auth=true)=>fetch(`http://127.0.0.1:${address.port}/api/transactions`,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{authorization:'Bearer manual-'+randomUUID()}:{})},body:JSON.stringify(body)});
 return {post,calls,setResult:(r:any)=>{result=r;}};
}
const body={tenantId:owner,requestId:randomUUID(),tipo:'entrada',valor:'100',categoria:'Mensalidade',data:'2026-09-10',descricao:'Setembro',filho_id:'22222222-2222-4222-8222-222222222222',status:'pendente',jurosTipo:'porcentagem',jurosValor:'2'};
test('rota autenticada valida, calcula juros no servidor e só confirma registro persistido',async t=>{
 const f=await setup(t);let r=await f.post(body);assert.equal(r.status,201);assert.ok((await r.json()).data.id);
 assert.equal(f.calls[0].args.p_payload.valor,102);assert.equal(f.calls[0].args.p_actor,owner);assert.equal(f.calls[0].args.p_payload.filho_id,body.filho_id);
 const id=randomUUID();f.setResult({data:[{id}],error:null});r=await f.post(body);assert.equal(r.status,201);assert.equal((await r.json()).data.id,id);
 f.setResult({data:null,error:{code:'XX000',message:'database failed'}});r=await f.post(body);assert.equal(r.status,500);assert.ok((await r.json()).error);
});
test('nega acesso sem sessão, a outro terreiro e mensalidade sem membro',async t=>{
 const f=await setup(t);assert.equal((await f.post(body,false)).status,401);
 assert.equal((await f.post({...body,tenantId:randomUUID()})).status,403);
 assert.equal((await f.post({...body,filho_id:''})).status,400);assert.equal(f.calls.length,0);
});
test('duplicidade informa conflito e falha nunca vira sucesso vazio',async t=>{
 const f=await setup(t);f.setResult({data:null,error:{code:'23505',message:'Já existe mensalidade neste mês.'}});
 const r=await f.post(body);assert.equal(r.status,409);assert.match((await r.json()).error,/Já existe/);
 f.setResult({data:null,error:null});assert.equal((await f.post(body)).status,500);
});
