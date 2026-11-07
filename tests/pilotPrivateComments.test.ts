import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
function load(sb:any){const exports:any={},code=ts.transpileModule(readFileSync('design-systems/shared/privateLibraryComments.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;runInNewContext(code,{exports,require:()=>({supabase:sb}),Error,Array});return exports;}
test('private discussion requires access and paginates beyond the first 500 comments without losing authors',async()=>{
 let allowed=false,reads=0;const rows=Array.from({length:501},(_,id)=>({id,author_name:'Author '+id,texto:'Comment '+id}));
 const query:any={select(){return query;},eq(key:string,value:string){assert.equal(key,'material_id');assert.equal(value,'private');return query;},order(){return query;},range(from:number,to:number){reads++;return Promise.resolve({data:rows.slice(from,to+1),error:null});}};
 const api=load({rpc:async()=>({data:allowed,error:null}),from:()=>query});
 await assert.rejects(api.readPrivateComments('private'),/seu acesso/);assert.equal(reads,0);allowed=true;
 const result=await api.readPrivateComments('private');assert.equal(result.length,501);assert.equal(result[500].authorName,'Author 500');assert.equal(reads,2);
});
test('a private comment is confirmed only by the exact request id; response loss can be retried without changing identity',async()=>{
 const calls:any[]=[];let mode='lost';const api=load({rpc:async(name:string,args:any)=>{calls.push({name,args});return mode==='lost'?{error:{message:'Response lost'}}:{data:{id:mode==='wrong'?'another':args.p_request}};}});
 await assert.rejects(api.sendPrivateComment('private','Technical','request'),/Response lost/);mode='wrong';await assert.rejects(api.sendPrivateComment('private','Technical','request'),/não foi confirmado/);mode='ok';await api.sendPrivateComment('private','Technical','request');
 assert.ok(calls.every(row=>row.name==='piloto_comentar_pdf'&&row.args.p_request==='request'&&row.args.p_material==='private'));
});
