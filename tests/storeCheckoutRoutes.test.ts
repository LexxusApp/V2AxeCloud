import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import express from 'express';
import { registerStoreCheckoutRoutes } from '../api/lib/storeCheckoutRoutes.js';
const owner='10000000-0000-4000-8000-000000000001', child='10000000-0000-4000-8000-000000000002', userChild='10000000-0000-4000-8000-000000000003', other='10000000-0000-4000-8000-000000000004', product='10000000-0000-4000-8000-000000000005';
async function fixture(t:any, role='manager') {
 const calls:any[]=[]; let failed=false;
 const user={id:role==='manager'?owner:userChild,email:role+'@example.test'};
 const tables:any={perfil_lider:[{id:owner,tenant_id:owner}],filhos_de_santo:[{id:child,user_id:userChild,tenant_id:owner,lider_id:owner}],configuracoes_pix:[{terreiro_id:owner,chave_pix:'pix@example.test',nome_beneficiario:'Casa Teste',tipo_chave:'email'}],loja_pedidos:[]};
 const sb:any={auth:{getUser:async()=>({data:{user},error:null}),admin:{getUserById:async()=>({data:{user},error:null})}},
  from(name:string){let rows=tables[name]||[];const q:any={select:()=>q,eq:(key:string,val:any)=>{rows=rows.filter((r:any)=>r[key]===val);return q;},or:(val:string)=>{rows=rows.filter((r:any)=>val.split(',').some(term=>{const [k,,v]=term.split('.');return r[k]===v;}));return q;},order:()=>q,limit:()=>q,maybeSingle:async()=>({data:rows[0]||null,error:null}),then:(resolve:any)=>Promise.resolve({data:rows,error:null}).then(resolve)};return q;},
  rpc:async(name:string,args:any)=>{calls.push({name,args});return failed?{data:null,error:{code:'P0001',message:'Estoque insuficiente'}}:{data:{id:randomUUID(),tenant_id:owner,total:23,status:args.p_metodo_pagamento==='pix'?'pendente':'reservado',metodo_pagamento:args.p_metodo_pagamento},error:null};}};
 const app=express();app.use(express.json());registerStoreCheckoutRoutes(app,{supabaseAdmin:sb,resolveLeaderId:async id=>id});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));t.after(()=>new Promise<void>(r=>server.close(()=>r())));
 const base=`http://127.0.0.1:${(server.address() as any).port}/api/v1/store/`;
 const request=(path:string,body?:any,auth=true)=>fetch(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer store-'+randomUUID()}: {})},body:body?JSON.stringify(body):undefined});
 const payload={tenantId:owner,checkoutId:randomUUID(),items:[{id:product,quantidade:2,preco:0.01,nome:'Nome adulterado'}],method:'reserva'};
 return {request,payload,calls,fail:()=>{failed=true;}};
}
test('checkout usa uma única operação transacional, ignora preços do navegador e preserva reserva',async t=>{
 const {request,payload,calls}=await fixture(t);const res=await request('checkout',payload);assert.equal(res.status,200);
 assert.equal((await res.json()).order.total,23);assert.equal(calls.length,1);assert.equal(calls[0].name,'checkout_loja_seguro');
 assert.deepEqual(calls[0].args.p_itens,[{produto_id:product,quantidade:2}]);assert.equal(calls[0].args.p_metodo_pagamento,'reserva');assert.equal(calls[0].args.p_checkout_id,payload.checkoutId);
});
test('Pix mostra valor do pedido e chave da casa, ainda pendente de confirmação',async t=>{
 const {request,payload}=await fixture(t);const res=await request('checkout',{...payload,method:'pix'});assert.equal(res.status,200);const result=await res.json();
 assert.equal(result.order.status,'pendente');assert.equal(result.pix.chave_pix,'pix@example.test');assert.ok(result.pix.payload.includes('540523.00'));assert.equal(result.pix.confirmacao,'responsavel');
});
test('filho não registra dinheiro, não compra para outro membro nem confirma recebimento',async t=>{
 const {request,payload,calls}=await fixture(t,'child');
 assert.equal((await request('checkout',{...payload,method:'dinheiro'})).status,403);
 assert.equal((await request('checkout',{...payload,filhoId:other})).status,403);
 assert.equal((await request(`orders/${randomUUID()}/action`,{tenantId:owner,action:'confirmar'})).status,403);
 assert.equal(calls.length,0);
 assert.equal((await request('checkout',{...payload,method:'mensalidade'})).status,200);assert.equal(calls[0].args.p_filho_id,child);
});
test('bloqueia outra casa, carrinho inválido e resposta de falha não simula sucesso',async t=>{
 const {request,payload,calls,fail}=await fixture(t);
 assert.equal((await request('checkout',payload,false)).status,401);
 assert.equal((await request('checkout',{...payload,tenantId:other})).status,403);
 for(const qty of [-1,0,1.5,10001]) assert.equal((await request('checkout',{...payload,items:[{id:product,quantidade:qty}]})).status,400);
 assert.equal(calls.length,0);fail();const res=await request('checkout',payload);assert.equal(res.status,400);assert.equal((await res.json()).success,undefined);
});
