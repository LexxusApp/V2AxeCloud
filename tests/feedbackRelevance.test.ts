import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createOperationStore,isRemoteMutation,operationPending} from '../design-systems/menu-local-20261029/operations';
import {createActivityAutoDismiss,announceBackgroundDispatch} from '../design-systems/menu-local-20261029/activityLifecycle';
const require=createRequire(import.meta.url);
function clock(){let now=0,serial=0;const tasks=new Map<number,{due:number;fn:()=>void}>();return {options:{setTimer:(fn:()=>void,delay:number)=>{const id=++serial;tasks.set(id,{due:now+delay,fn});return id;},clearTimer:(id:unknown)=>{tasks.delete(id as number);}},size:()=>tasks.size,tick(ms:number){const end=now+ms;for(;;){const next=[...tasks.entries()].filter(([,row])=>row.due<=end).sort((a,b)=>a[1].due-b[1].due)[0];if(!next)break;now=next[1].due;tasks.delete(next[0]);next[1].fn();}now=end;}};}
test('success cards expire independently three seconds after conclusion without resetting for another activity',()=>{
 const store=createOperationStore(),time=clock(),auto=createActivityAutoDismiss(store,time.options),first=store.begin('Primeira');first.complete();time.tick(1500);const second=store.begin('Segunda');time.tick(1499);assert.equal(store.snapshot().length,2);time.tick(1);assert.deepEqual(store.snapshot().map(row=>row.id),[second.id]);second.complete();time.tick(3000);assert.equal(store.snapshot().length,0);auto.stop();
});
test('failure, pending delivery and an incomplete upload never disappear automatically',()=>{
 const store=createOperationStore(),time=clock(),auto=createActivityAutoDismiss(store,time.options),error=store.begin('Falha'),send=store.begin('Aviso'),upload=store.begin('Foto');
 error.fail(Error('Falha real'));send.sent('message','accepted');send.complete();upload.files([{id:'file',name:'foto.jpg',bytes:100}]);upload.progress('file',100,100);upload.complete();assert.equal(operationPending(store.snapshot()[2]),true);time.tick(30000);assert.equal(store.snapshot().length,3);
 store.delivery('message','delivered');upload.file('file',{phase:'done',progress:1});time.tick(3000);assert.deepEqual(store.snapshot().map(row=>row.id),[error.id]);auto.stop();
});
test('reading or focusing the activity pauses dismissal; a late failure cancels success expiration',()=>{
 const store=createOperationStore(),time=clock(),auto=createActivityAutoDismiss(store,time.options),op=store.begin('Cadastro');op.complete();time.tick(2000);auto.setPaused(true);time.tick(30000);assert.equal(store.snapshot().length,1);auto.setPaused(false);time.tick(2000);op.fail(Error('Falha na confirmação'));time.tick(10000);assert.equal(store.snapshot()[0].state,'error');assert.equal(time.size(),0);auto.stop();
});
test('unmount cancels timers without changing completed records or business data',()=>{
 const store=createOperationStore(),time=clock(),auto=createActivityAutoDismiss(store,time.options);store.begin('Salvo').complete();auto.stop();assert.equal(time.size(),0);time.tick(10000);assert.equal(store.snapshot().length,1);
});
test('read markers are quiet, and only a new failure from background dispatches deserves a global alert',()=>{
 assert.equal(isRemoteMutation('notifications',[{id:'notice',read:true}],[{id:'notice',read:false}]),false);
 for(const status of ['queued','sending','accepted','sent','delivered','read','unknown'])assert.equal(announceBackgroundDispatch(status),false);assert.equal(announceBackgroundDispatch('failed'),true);
});
function load(file:string,deps:Record<string,unknown>){const exports:any={},code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;runInNewContext(code,{exports,require:(name:string)=>name.endsWith('.css')?{}:deps[name]??require(name),Promise,Error,Map,Set,Date});return exports;}
function notificationWriter(error: Error | null = null) {
 const calls: any[] = [], writers: Record<string, any> = {};
 let refreshes = 0;
 load('design-systems/menu-local-20261029/remote/home.ts', {
  './session': { previewSession: () => ({ tenantId: 'own' }) },
  './runtime': { registerLoader() {}, registerWriter: (key: string, writer: any) => { writers[key] = writer; }, refreshResource: async () => { refreshes++; } },
  '../../../src/lib/supabase': { supabase: { rpc: async (name: string, args: any) => { calls.push(JSON.stringify([name, args])); return { error }; } } },
  '../giras': {},
 });
 return { write: writers.notifications, calls, refreshes: () => refreshes };
}
test('reading only selected notices never marks an unseen incoming notice or uses a tenant-wide read-all', async () => {
 const f = notificationWriter();
 const before = [{ id: 'a', read: false }, { id: 'b', read: false }];
 await f.write([{ id: 'a', read: true }, { id: 'b', read: false }, { id: 'new-incoming', read: true }], before);
 assert.deepEqual(f.calls.map(value => JSON.parse(value)), [['sync_notification_inbox', {
  p_tenant_id: 'own', p_actions: [{ id: 'a', action: 'read' }],
 }]]);
 assert.equal(f.refreshes(), 1);
});
test('an already-read list makes no request and an atomic write failure does not confirm reads', async () => {
 const empty = notificationWriter();
 await empty.write([{ id: 'a', read: true }], [{ id: 'a', read: true }]);
 assert.equal(empty.calls.length, 0);
 assert.equal(empty.refreshes(), 0);
 const f = notificationWriter(Error('Falha ao marcar'));
 await assert.rejects(f.write([{ id: 'a', read: true }], [{ id: 'a', read: false }]), /Falha ao marcar/);
 assert.equal(f.calls.length, 1);
 assert.equal(f.refreshes(), 0);
});
test('background delivery updates stay quiet; a transition to failure alerts once and stays dismissed after acknowledgment',async()=>{
 const store=createOperationStore(),loaders:Record<string,any>={};let rows=[{id:'log',externalId:'message',status:'sent',title:'Aviso',recipient:'Membro',memberId:'member'}];
 const query:any={select(){return this;},eq(){return this;},order(){return this;},limit:async()=>({data:rows,error:null})};
 load('design-systems/menu-local-20261029/remote/dispatches.ts',{'../../../src/lib/supabase':{supabase:{from:()=>query}},'./session':{previewSession:()=>({tenantId:'own'})},'./runtime':{readValue:()=>[],publishValue(){},registerLoader:(key:string,fn:any)=>{loaders[key]=fn;}},'../dispatchReadModels':{dispatchesFromServer:(data:any)=>data},'../operations':{operations:store},'../whatsappDispatches':{dispatchStatus:(record:any)=>record.status},'../refreshLoop':{},'../activityLifecycle':{announceBackgroundDispatch}});
 await loaders.dispatches();rows=[{...rows[0],status:'delivered'}];await loaders.dispatches();assert.equal(store.snapshot().length,0);
 rows=[{...rows[0],status:'failed'}];await loaders.dispatches();assert.equal(store.snapshot().length,1);assert.equal(store.snapshot()[0].state,'error');await loaders.dispatches();assert.equal(store.snapshot().length,1);store.dismiss(store.snapshot()[0].id);await loaders.dispatches();assert.equal(store.snapshot().length,0);
});
test('a chat-only notification list never offers an irrelevant mark-notices-read action',()=>{
 const passthrough=(p:any)=>p.children,radix={Root:passthrough,Portal:passthrough,Overlay:()=>null,Content:passthrough,Title:(p:any)=>createElement('h2',null,p.children),Description:(p:any)=>createElement('p',null,p.children),Close:passthrough};
 const Center=load('design-systems/menu-local-20261029/NotificationCenter.tsx',{'@radix-ui/react-dialog':radix}).default;
 const props={open:true,onOpenChange(){},notifications:[],chatAlerts:[{id:'chat',title:'Membro',body:'Olá',count:1,date:'2026-11-02T12:54:31Z'}],onRefreshChat(){},onRead:async()=>{},onNavigate(){},onOpenConversation(){}};
 let html=renderToStaticMarkup(createElement(Center,props));assert.match(html,/1 mensagem não lida/);assert.doesNotMatch(html,/Marcar avisos como lidos|Atividades|confirmação do servidor/);
 html=renderToStaticMarkup(createElement(Center,{...props,notifications:[{id:'notice',read:false,title:'Aviso da casa',description:'Novo comunicado',time:'Hoje',tab:'mural'}]}));assert.match(html,/Marcar avisos como lidos/);assert.match(html,/>Marcar como lida</);
});

test('a read notification is restored from the server as read after a new session load', async () => {
 const loaders: Record<string, any> = {}, writers: Record<string, any> = {};
 let published: any[] = [];
 const read = new Set<string>();
 const row = { id: 'notice', tipo: 'biblioteca_duvida', mensagem: 'Nova dúvida', link: 'library', lida: false, created_at: '2026-11-05T12:00:00Z' };
 const reply = { id: 'suporte:message', ticketId: 'ticket', title: 'Nova resposta do suporte', body: 'Ajuda', created_at: '2026-11-06T12:00:00Z' };
 const receipt = { id: 'comprovante:receipt:enviado', title: 'Comprovante aguardando análise', target: 'financial-mensalidades', created_at: '2026-11-04T12:00:00Z' };
 const request = async (url: string) => ({ data: [url.includes('/support/') ? reply : url.includes('/comprovantes/') ? receipt : row] });
 const rpc = async (_name: string, args: any) => {
  for (const action of args.p_actions || []) read.add(action.id);
  return { data: [...read].map(id => ({ notification_id: id, read_at: 'now', dismissed_at: null })), error: null };
 };
 load('design-systems/menu-local-20261029/remote/home.ts', {
  './session': { previewSession: () => ({ tenantId: 'own', userId: 'owner', profile: {} }), request, scoped: (url: string) => url },
  './runtime': { registerLoader: (key: string, fn: any) => { loaders[key] = fn; }, registerWriter: (key: string, fn: any) => { writers[key] = fn; }, publishValue: (_key: string, value: any) => { published = value; }, readValue: () => [], refreshResource: async (key: string) => loaders[key]() },
  '../../../src/lib/supabase': { supabase: { rpc } },
  '../giras': {},
 });
 await loaders.notifications();
 assert.equal(published.length, 3);
 assert.equal(published[0].ticketId, 'ticket');
 assert.equal(published[1].tab, 'library');
 assert.equal(published[2].tab, 'financial-mensalidades');
 assert.equal(published[0].read, false);
 const before = published;
 await writers.notifications([{ ...before[0], read: true }, ...before.slice(1)], before);
 assert.equal(published[0].read, true);
 published = [];
 await loaders.notifications();
 assert.equal(published[0].read, true);
 assert.equal(published[1].read, false);
});

test('an unsent cantina cart does not announce a saved bookkeeping operation',()=>{
 const before={sales:[],receipts:[],products:[{id:'menu',name:'Water',cents:600}],preferences:{},cart:{}};
 assert.equal(isRemoteMutation('cantina',{...before,products:[...before.products,{id:'loose',name:'Unsent item',cents:100,transient:true}],cart:{loose:1}},before),false);
 assert.equal(isRemoteMutation('cantina',{...before,products:[{...before.products[0],cents:700}]},before),true);
 assert.equal(isRemoteMutation('cantina',{...before,sales:[{id:'command'}]},before),true);
});
