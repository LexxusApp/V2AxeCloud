import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
function fixture(){
 const calls:any[]=[],values=new Map(),writers=new Map<string,Function>(),loaders=new Map<string,Function>(),refreshes:string[]=[];let result:any;
 const modules:any={
  './reminders':{sendAutomaticCantinaNotice:async()=>{}},'./session':{previewSession:()=>({tenantId:'owner'}),scoped:(url:string)=>url,request:async(...args:any[])=>{calls.push(['http',...args]);if(args[0]==='/api/v1/cantina/data')return {filhos:[{id:'child',nome:'Membro',limite_lojinha:100,bloquear_fiado_loja:false}]};if(args[0]==='/api/v1/cantina/cardapio')return {items:[]};throw Error('No HTTP payment fallback allowed');}},
  './runtime':{registerLoader:(key:string,fn:Function)=>loaders.set(key,fn),ensureResource:async()=>{throw Error('Cantina must not require finance');},registerWriter:(key:string,fn:Function)=>writers.set(key,fn),readValue:(key:string)=>values.get(key),publishValue:(key:string,value:any)=>values.set(key,value),refreshResource:async(key:string)=>refreshes.push(key)},
  '../../../src/lib/supabase':{supabase:{rpc:async(name:string,input:any)=>{calls.push(['rpc',name,input]);return {data:result};}}},
  './helpers':{checked:async(promise:any)=>{const response=await promise;if(response.error)throw Error(response.error.message);return response.data;}},
 };
 runInNewContext(ts.transpileModule(readFileSync('design-systems/menu-local-20261029/remote/cantina.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:{},require:(key:string)=>{if(!(key in modules))throw Error(key);return modules[key];},crypto,Map,Set,Error});
 const sale={id:'sale-1',memberId:'child',settled:false,lines:[{name:'Item',cents:100,quantity:2}]},before={sales:[sale],receipts:[],products:[],cart:{},memberId:'child',preferences:{}};
 const after={...before,sales:[{...sale,settled:true}],receipts:[{id:'receipt-6c410234-c701-48d1-9199-58914b086adb',saleIds:[sale.id],cents:200}]};
 return {calls,refreshes,values,before,after,setResult:(value:any)=>result=value,load:()=>loaders.get('cantina')!(),write:(next:any=after)=>writers.get('cantina')!(next,before)};
}

test('Cantina standalone loads a complete restricted ledger without loading or replacing the general Financeiro',async()=>{
 const f=fixture();f.values.set('financeRows',[{id:'private-finance-snapshot'}]);
 f.setResult([{id:'sale-1',filho_id:'child',categoria:'Cantina',status:'pendente',valor:13,data:'2026-11-09',created_at:'2026-11-09T12:00:00Z'}]);
 await f.load();assert.equal(f.values.get('cantina').sales.length,1);assert.equal(f.values.get('cantina').sales[0].lines[0].cents,1300);
 assert.equal(f.values.get('financeRows')[0].id,'private-finance-snapshot');
 assert.ok(f.calls.some(call=>call[1]==='piloto_cantina_lancamentos'));assert.equal(f.calls.some(call=>String(call[1]).includes('/api/transactions')),false);
});
test('cantina settlement identifies exact commands, amount and request without settling all store debt',async()=>{
 const f=fixture();f.setResult({memberId:'child',ids:['sale-1'],count:1,totalCents:200,status:'pago'});await f.write();
 assert.equal(f.calls.length,1);assert.equal(f.calls[0][1],'piloto_liquidar_cantina');assert.equal(f.calls[0][2].p_request,'6c410234-c701-48d1-9199-58914b086adb');assert.equal(f.calls[0][2].p_transacoes[0].valor,2);assert.equal(f.calls[0][2].p_transacoes[0].id,'sale-1');assert.deepEqual(f.refreshes,['finance','cantina']);
});
test('a mismatched payment result is never treated as a confirmed receipt',async()=>{
 for(const patch of [{ids:['other-command']},{memberId:'another-child'},{count:2},{totalCents:1},{status:'pendente'}]){const f=fixture();f.setResult({memberId:'child',ids:['sale-1'],count:1,totalCents:200,status:'pago',...patch});await assert.rejects(f.write(),/não confirmou/);assert.equal(f.values.has('cantina'),false);assert.equal(f.refreshes.length,0);}
});
test('a receipt with different command IDs or total is rejected before reaching the server',async()=>{
 for(const patch of [{saleIds:['another-command']},{cents:300}]){const f=fixture();await assert.rejects(f.write({...f.after,receipts:[{...f.after.receipts[0],...patch}]}),/Confira/);assert.equal(f.calls.length,0);}
});
