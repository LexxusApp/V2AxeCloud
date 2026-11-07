import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {createOperationStore} from '../design-systems/menu-local-20261029/operations';
function automatic({enabled=true,fail=false,changeAccount=false}={}){
 const store=createOperationStore(),calls:any[]=[],exports:any={};let claimed=false,current='owner';
 const modules:any={
  '../operations':{operations:store,currentOperation:()=>undefined},
  './helpers':{checked:async(value:any)=>{const result=await value;if(result.error)throw Error(result.error.message);return result.data;}},
  '../../../src/lib/supabase':{supabase:{rpc:async(name:string,args:any)=>{calls.push(['rpc',name,args]);if(name==='piloto_iniciar_aviso_cantina'){if(!enabled||claimed)return {data:{send:false}};claimed=true;return {data:{send:true,member_id:'child'}};}return {data:{state:args.p_error?'incerto':'solicitado'}};}}},
  './session':{previewSession:()=>({tenantId:current,userId:current,profile:{}}),request:async(...args:any[])=>{calls.push(['send',...args]);if(fail)throw Error('Resposta de rede incerta');return {success:true,externalId:'wamid.technical-test'};}},
  './runtime':{ensureResource:async()=>{if(changeAccount)current='another-account';},loadResource:async()=>{},readValue:(name:string)=>name==='financeRows'?[{categoria:'Cantina',status:'pendente',filho_id:'child',valor:13}]:name==='members'?[{id:'child',name:'Membro técnico',phone:'11999999999'}]:name==='pixSettings'?{key:'technical@example.invalid'}:{profile:{house:'Casa técnica'}}},
 };
 const source=ts.transpileModule(readFileSync('design-systems/menu-local-20261029/remote/reminders.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(source,{exports,require:(name:string)=>{if(!(name in modules))throw Error('Unexpected dependency '+name);return modules[name];},crypto,Error,Promise,Set});return {run:exports.sendAutomaticCantinaNotice,calls,store};
}
test('disabled cantina preference never dispatches or invents a send activity',async()=>{
 const h=automatic({enabled:false});await h.run('sale');assert.equal(h.calls.filter(call=>call[0]==='send').length,0);assert.equal(h.store.snapshot().length,0);
});
test('an authorized automatic notice uses the complete outstanding balance and is dispatched only once',async()=>{
 const h=automatic();await h.run('sale');await h.run('sale');const sends=h.calls.filter(call=>call[0]==='send');assert.equal(sends.length,1);assert.equal(sends[0][3].filhoId,'child');assert.equal(sends[0][3].variables.valor,'13,00');assert.equal(sends[0][3].tenant_id,'owner');
 const final=h.calls.find(call=>call[1]==='piloto_finalizar_aviso_cantina');assert.equal(final[2].p_external,'wamid.technical-test');assert.equal(final[2].p_error,null);const activity=h.store.snapshot()[0];assert.equal(activity.state,'done');assert.equal(activity.delivery?.status,'sent');assert.notEqual(activity.delivery?.status,'delivered');
});
test('a lost send response preserves bookkeeping, records uncertainty and never automatically resends',async()=>{
 const h=automatic({fail:true});await h.run('sale');await h.run('sale');assert.equal(h.calls.filter(call=>call[0]==='send').length,1);const final=h.calls.find(call=>call[1]==='piloto_finalizar_aviso_cantina');assert.equal(final[2].p_external,null);assert.match(final[2].p_error,/incerta/);const activity=h.store.snapshot()[0];assert.equal(activity.state,'error');assert.match(activity.detail,/comanda foi salva/i);
});
test('a changed account cannot dispatch the previous house notice',async()=>{
 const h=automatic({changeAccount:true});await h.run('sale');assert.equal(h.calls.filter(call=>call[0]==='send').length,0);assert.equal(h.store.snapshot()[0].state,'error');
});
