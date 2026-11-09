import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const tenantId='fad75b91-d2eb-4805-b5a3-c19e8a073bed';
function harness(file:string){
 const writers=new Map<string,Function>(),loaders=new Map<string,Function>(),values=new Map<string,any>(),calls:any[]=[],refreshes:string[]=[];
 const rpcResults=new Map<string,any>(),responses=new Map<string,any>();
 const checked=async(promise:any)=>{const result=await promise;if(result.error)throw Error(result.error.message);return result.data;};
 const helpers={equal:(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b),checked,tableRows:async(name:string)=>values.get(name)||[],singleChange:(next:any[],before:any[])=>{const row=next.find(row=>JSON.stringify(row)!==JSON.stringify(before.find(old=>old.id===row.id)))||before.find(row=>!next.some(old=>old.id===row.id));return {row,old:before.find(old=>old.id===row.id),removed:!next.some(old=>old.id===row.id)};}};
 const runtime={registerLoader:(name:string,fn:Function)=>loaders.set(name,fn),registerWriter:(name:string,fn:Function)=>writers.set(name,fn),readValue:(name:string)=>values.get(name),publishValue:(name:string,data:any)=>values.set(name,data),ensureResource:async()=>{},refreshResource:async(name:string)=>refreshes.push(name)};
 const modules:any={
  './runtime':runtime,'./helpers':helpers,'./session':{previewSession:()=>({tenantId,userId:tenantId}),scoped:(url:string)=>url,request:async(...args:any[])=>{calls.push(['request',...args]);if(responses.has(args[0]))return responses.get(args[0]);throw Error('Unexpected HTTP operation');}},
  '../../../src/lib/supabase':{supabase:{from:(table:string)=>{const query:any={update:(payload:any)=>{calls.push(['update',table,payload]);return query;},insert:(payload:any)=>{calls.push(['insert',table,payload]);return query;},eq:()=>query,select:()=>query,single:async()=>({data:{id:'obligation'}})};return query;},rpc:async(name:string,args:any)=>{calls.push(['rpc',name,args]);const result=rpcResults.get(name);return result instanceof Error?{error:result}:{data:result};}}},
  './readModels':{},'./initial':{},'./uploads':{},'../../../lib/storeImageReference':{},'./chatHistory':{},'./notices':{},
 };
 const source=ts.transpileModule(readFileSync('design-systems/menu-local-20261029/remote/'+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(source,{exports:{},require:(name:string)=>{if(!(name in modules))throw Error('Unexpected dependency '+name);return modules[name];},crypto,File,Date,Map,Set,Error});
 return {writers,loaders,values,calls,refreshes,rpcResults,responses};
}

test('support reloads server history and preserves only the unsent draft in memory',async()=>{
 const h=harness('communication.ts'),draft={category:'Uso do sistema',subject:'Unsent',text:'Keep this draft'};
 h.values.set('support',{draft,tickets:[]});h.responses.set('/api/pilot/support',{tickets:[{id:'stable-protocol',subject:'Persistent request',delivery:'uncertain',messages:[]}]});
 await h.loaders.get('support')!();assert.equal(h.values.get('support').tickets[0].id,'stable-protocol');assert.equal(h.values.get('support').draft,draft);
});

test('support retries retain their protocol and uncertain outcomes do not pretend an email was received',async()=>{
 const h=harness('communication.ts'),ticket={id:'stable-protocol',subject:'Request',text:'Description',status:'open',delivery:'failed',messages:[]},before={draft:{subject:'draft'},tickets:[ticket]};
 h.responses.set('/api/pilot/support',{id:ticket.id,messageId:null,delivery:'uncertain'});
 await h.writers.get('support')!({...before,tickets:[{...ticket,retry:true}]},before);
 assert.equal(h.calls[0][3].id,ticket.id);assert.equal(h.calls[0][3].retry,true);assert.deepEqual(h.refreshes,['support']);assert.equal(h.values.get('support').tickets[0].delivery,'failed');
 const bad=harness('communication.ts');bad.responses.set('/api/pilot/support',{id:'another-protocol',delivery:'confirmed'});
 await assert.rejects(bad.writers.get('support')!({draft:{},tickets:[ticket]},{draft:{},tickets:[]}),/não confirmou/);assert.deepEqual(bad.refreshes,[]);
});
test('delivery uses its own confirmed operation and never confirms a payment or refreshes cash',async()=>{
 const h=harness('commerce.ts');h.rpcResults.set('piloto_marcar_entrega',{id:'order-1',delivered:true});
 const order={id:'order-1',delivered:false,status:'pending',method:'book'},before={orders:[order],products:[],cart:{},cartId:'cart'};
 await h.writers.get('shop')!({...before,orders:[{...order,delivered:true}]},before);
 assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'piloto_marcar_entrega');assert.equal(h.calls[0][2].p_antes,false);assert.deepEqual(h.refreshes,['shop']);
});
test('a combined delivery/payment change is rejected before any mutation',async()=>{
 const h=harness('commerce.ts'),order={id:'o',delivered:false,status:'pending',method:'book'},before={orders:[order],products:[]};
 await assert.rejects(h.writers.get('shop')!({...before,orders:[{...order,delivered:true,status:'paid'}]},before),/separadamente/);assert.equal(h.calls.length,0);
});
test('a different returned order cannot be reported as delivered',async()=>{
 const h=harness('commerce.ts');h.rpcResults.set('piloto_marcar_entrega',{id:'another-order',delivered:true});
 const order={id:'order-1',delivered:false,status:'pending',method:'book'},before={orders:[order],products:[]};
 await assert.rejects(h.writers.get('shop')!({...before,orders:[{...order,delivered:true}]},before),/não confirmou/);assert.deepEqual(h.refreshes,[]);
});
test('archiving and restoring a product preserve stock and avoid the legacy deletion fallback',async()=>{
 for(const archived of [true,false]){const h=harness('commerce.ts');h.rpcResults.set('piloto_arquivar_produto',{id:'p',archived});const product={id:'p',archived:!archived,stock:7},before={orders:[],products:[product]};await h.writers.get('shop')!({...before,products:[{...product,archived}]},before);assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'piloto_arquivar_produto');assert.equal(h.calls[0][2].p_antes,!archived);assert.deepEqual(h.refreshes,['shop']);}
});
test('preparation-only changes do not resave or announce an event',async()=>{
 const h=harness('house.ts'),g={id:'event',title:'Gira',date:'2099-01-01',time:'20:00',type:'Gira',place:'Casa',instructions:'',status:'scheduled',reminder:false,capacity:1,tasks:[],queue:[],responses:{},highlight:false,noticeDraft:'',noticeSaved:false};h.rpcResults.set('piloto_preparar_gira',{event_id:g.id});
 await h.writers.get('giras')!([{...g,tasks:['materiais']}],[g]);assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'piloto_preparar_gira');assert.equal(h.calls[0][2].p_dados.tasks[0],'materiais');
});
test('ticket issuance sends the name and stable request ID to atomic capacity control',async()=>{
 const h=harness('house.ts'),g={id:'event',queue:[],responses:{}},ticket={id:'ticket',number:1,name:'Consulente',phone:'',state:'waiting'};h.rpcResults.set('piloto_emitir_senha',{id:'ticket',numero:9});
 await h.writers.get('giras')!([{...g,queue:[ticket]}],[g]);assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'piloto_emitir_senha');assert.equal(h.calls[0][2].p_nome,'Consulente');assert.equal(h.calls[0][2].p_id,'ticket');
});
test('an attendance list and closure are sent together instead of partially saving members',async()=>{
 const h=harness('house.ts');h.values.set('members',[{id:'child'}]);h.rpcResults.set('piloto_salvar_chamada',{event_id:'event'});const before={event:{marks:{},closed:false}},after={event:{marks:{child:'present'},closed:true}};
 await h.writers.get('attendance')!(after,before);assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'piloto_salvar_chamada');assert.equal(h.calls[0][2].p_chamada.closed,true);assert.equal(h.calls[0][2].p_chamada.marks.child,'present');assert.deepEqual(h.refreshes,['giras','attendance']);
});
test('archiving a conversation preserves messages and drafts, with no send request',async()=>{
 const h=harness('communication.ts');h.rpcResults.set('piloto_arquivar_conversa',{id:'thread',archived:true});const thread={id:'thread',archived:false,messages:[{id:'message',body:'Preservar'}]},before={conversations:[thread],drafts:{thread:{body:'Rascunho'}}};
 await h.writers.get('inbox')!({...before,conversations:[{...thread,archived:true}]},before);assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'piloto_arquivar_conversa');assert.equal(h.values.get('inbox').drafts.thread.body,'Rascunho');assert.deepEqual(h.refreshes,['inbox']);
});

test('obligation reload retains its real PDF path and recognizes the production completion state',async()=>{
 const h=harness('house.ts');h.responses.set('/api/events',{data:[{id:'o',tipo:'Obrigação',titulo:'Cuidado',data:'2099-01-01',hora:'19:00:00',status_confirmacao:'Confirmado',pdf_storage_path:tenantId+'/obrigacoes/child/orientacoes.pdf',descricao:'Orientação\n\n=== METADADOS ===\nFILHO_ID:11111111-1111-4111-8111-111111111111'}]});
 await h.loaders.get('obligations')!();const row=h.values.get('obligations')[0];assert.equal(row.done,true);assert.match(row.attachmentPath,/orientacoes.pdf$/);assert.equal(row.attachment,null);
});
test('concluding an obligation uses a state accepted by production and preserves its existing PDF',async()=>{
 const h=harness('house.ts'),path=tenantId+'/obrigacoes/child/orientacoes.pdf',old={id:'obligation',memberId:'child',title:'Cuidado',date:'2099-01-01',time:'19:00',description:'Orientação',done:false,attachmentPath:path,attachment:null,reminder:false};
 await h.writers.get('obligations')!([{...old,done:true}],[old]);const update=h.calls.find(call=>call[0]==='update');assert.equal(update[2].status_confirmacao,'Confirmado');assert.equal(update[2].pdf_storage_path,path);assert.equal(h.calls.filter(call=>call[0]==='request').length,0);
});

test('calling an existing ticket requires the exact persisted state in the response',async()=>{
 const h=harness('house.ts'),ticket={id:'ticket',name:'Consulente',phone:'',number:1,state:'waiting'},g={id:'event',queue:[ticket],responses:{}};h.values.set('ticketRows',[{id:'ticket',event_id:'event',numero:1,status:'aguardando'}]);h.rpcResults.set('piloto_atualizar_senha',{id:'ticket',status:'aguardando'});
 await assert.rejects(h.writers.get('giras')!([{...g,queue:[{...ticket,state:'called'}]}],[g]),/não confirmou o estado/);assert.equal(h.refreshes.length,0);
 h.rpcResults.set('piloto_atualizar_senha',{id:'ticket',status:'chamado'});await h.writers.get('giras')!([{...g,queue:[{...ticket,state:'called'}]}],[g]);assert.equal(h.calls.at(-1)[2].p_antes,'aguardando');assert.deepEqual(h.refreshes,['giras']);
});

test('WhatsApp preferences require the exact server values without rewriting templates or the shared connection',async()=>{
 const h=harness('account.ts'),whatsapp={connected:true,days:3,sameDay:false,obligations:false,monthly:true,cantina:false},before={profile:{},draft:{},whatsapp,whatsDraft:whatsapp};h.values.set('account',before);h.rpcResults.set('piloto_configurar_whatsapp',{tenant_id:tenantId,preferences:{cantina:false,monthly:true,obligations:false,sameDay:true,days:4}});
 await h.writers.get('account')!({...before,whatsapp:{...whatsapp,days:4,sameDay:true}},before);assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'piloto_configurar_whatsapp');assert.equal(h.calls[0][2].p_antes.days,3);assert.equal(h.calls[0][2].p_dados.days,4);assert.equal(h.calls[0][2].p_dados.sameDay,true);assert.deepEqual(h.refreshes,['giras','account']);
});
test('a stale or incomplete WhatsApp confirmation is not presented as saved',async()=>{
 const h=harness('account.ts'),whatsapp={connected:true,days:3,sameDay:false,obligations:false,monthly:true,cantina:false},before={profile:{},draft:{},whatsapp,whatsDraft:whatsapp};h.rpcResults.set('piloto_configurar_whatsapp',{tenant_id:tenantId,preferences:{days:3}});
 await assert.rejects(h.writers.get('account')!({...before,whatsapp:{...whatsapp,days:4}},before),/não confirmou/);assert.equal(h.refreshes.length,0);
});
