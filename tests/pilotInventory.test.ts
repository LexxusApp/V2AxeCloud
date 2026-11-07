import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
test('real table reader paginates metadata by item_id without querying a nonexistent id column',async()=>{
 const orderCalls:string[]=[],afterCalls:string[]=[],rows=Array.from({length:501},(_,index)=>({item_id:'key-'+String(index+1).padStart(4,'0')}));
 const sb={from:()=>{let after='',size=500;const query:any={select(){return query;},eq(){return query;},order(key:string){orderCalls.push(key);assert.equal(key,'item_id');return query;},limit(n:number){size=n;return query;},gt(key:string,value:string){assert.equal(key,'item_id');afterCalls.push(value);after=value;return query;},then(resolve:any){return Promise.resolve({data:rows.filter(row=>row.item_id>after).slice(0,size),error:null}).then(resolve);}};return query;}};
 const exports:any={},code=ts.transpileModule(readFileSync('design-systems/menu-local-20261029/remote/helpers.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{exports,require:(name:string)=>name.includes('/supabase')?{supabase:sb}:name==='./session'?{previewSession:()=>({tenantId:'house'})}:require(name),File,Error,JSON});
 const result=await exports.tableRows('piloto_estoque_itens','*','item_id');assert.equal(result.length,501);assert.deepEqual(orderCalls,['item_id','item_id']);assert.deepEqual(afterCalls,['key-0500']);
});
function fixture(){
 const writers=new Map<string,any>(),loaders=new Map<string,any>(),values=new Map<string,any>(),rpcs:any[]=[];let refreshes=0;
 const rows=[{id:'kg',item:'Ervas',categoria:'Rituais',quantidade_atual:1500,quantidade_minima:0},{id:'un',item:'Velas',categoria:'Rituais',quantidade_atual:5,quantidade_minima:10},{id:'archived',item:'Item arquivado',quantidade_atual:1}];
 const metadata=[{item_id:'kg',unidade:'kg',escala:1000,localizacao:'Prateleira',observacoes:'Anotação'},{item_id:'archived',arquivado:true}];
 const history=[{id:'movement',item_ref:'kg',nome:'Ervas',unidade:'kg',tipo:'initial',antes:0,depois:1500,motivo:'Saldo inicial',created_at:'2026-11-02T12:00:00Z'}];
 const helpers={equal:(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b),singleChange:(next:any[],before:any[])=>{const row=next.find(row=>JSON.stringify(row)!==JSON.stringify(before.find(old=>old.id===row.id)))||before.find(row=>!next.some(item=>item.id===row.id));return {row,old:before.find(item=>item.id===row.id),removed:!next.some(item=>item.id===row.id)};},tableRows:async(table:string,_columns?:string,cursor?:string)=>{if(table==='piloto_estoque_itens'){assert.equal(cursor,'item_id');return metadata;}return history;},checked:async(value:any)=>{const result=await value;if(result.error)throw result.error;return result.data;}};
 const dependencies:any={'./privateLibrary':{},'../confirmedUpload':{},'./uploads':{},'../../../src/lib/supabase':{supabase:{rpc:async(name:string,args:any)=>{rpcs.push({name,args});return {data:{id:args.p_item}};}}},'./session':{previewSession:()=>({tenantId:'house'}),scoped:(url:string)=>url,request:async()=>({data:rows})},'./runtime':{registerWriter:(key:string,fn:any)=>writers.set(key,fn),registerLoader:(key:string,fn:any)=>loaders.set(key,fn),publishValue:(key:string,value:any)=>values.set(key,value),refreshResource:async()=>{refreshes++;}},'./helpers':helpers,'../../../lib/libraryStoragePath':{}};
 const code=ts.transpileModule(readFileSync('design-systems/menu-local-20261029/remote/media.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;runInNewContext(code,{exports:{},require:(name:string)=>dependencies[name]??require(name),File,Map,Error,Promise,JSON});
 return {writers,loaders,values,rpcs,refreshes:()=>refreshes};
}
test('inventory loads exact fractional units, zero minimum, private metadata and persisted history without archived rows',async()=>{
 const f=fixture();await f.loaders.get('inventory')();const state=JSON.parse(JSON.stringify(f.values.get('inventory')));
 assert.equal(state.items.length,2);assert.deepEqual(state.items[0],{id:'kg',name:'Ervas',category:'Rituais',unit:'kg',quantity:1500,minimum:0,location:'Prateleira',notes:'Anotação'});assert.equal(state.items[1].quantity,5000);assert.equal(state.items[1].minimum,10000);assert.equal(state.movements[0].after,1500);assert.equal(state.movements[0].kind,'initial');
});
test('inventory writer sends one atomic change with original snapshot and keeps history on archive and restore',async()=>{
 const f=fixture();await f.loaders.get('inventory')();const before=f.values.get('inventory'),item=before.items[0],movement={id:'out',itemId:item.id,kind:'out',unit:'kg',before:1500,after:1000,note:'Uso na gira'};
 await f.writers.get('inventory')({...before,items:before.items.map((row:any)=>row.id===item.id?{...row,quantity:1000}:row),movements:[...before.movements,movement]},before);
 assert.equal(f.rpcs[0].name,'piloto_salvar_estoque');assert.equal(f.rpcs[0].args.p_before.quantity,1500);assert.equal(f.rpcs[0].args.p_input.quantity,1000);assert.equal(f.rpcs[0].args.p_movement.id,'out');assert.equal(f.refreshes(),1);
 const archived={...before,items:before.items.filter((row:any)=>row.id!==item.id)};await f.writers.get('inventory')(archived,before);assert.equal(f.rpcs[1].args.p_input,null);assert.equal(f.rpcs[1].args.p_before.id,item.id);
 await f.writers.get('inventory')(before,archived);assert.equal(f.rpcs[2].args.p_before,null);assert.equal(f.rpcs[2].args.p_movement,null);assert.equal(f.rpcs[2].args.p_input.id,item.id);
 await assert.rejects(f.writers.get('inventory')({...archived,movements:[]},before),/preservando o histórico/);assert.equal(f.rpcs.length,3);
});
