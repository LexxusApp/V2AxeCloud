import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {mergeChatMessages,confirmChatMessage} from '../design-systems/member-pilot-20261102/chatState';
import {unreadChatAlerts} from '../design-systems/menu-local-20261029/chatAlertModels';
import {pilotBootstrap} from '../cloudflare/pilot-bootstrap.js';
import {createOperationStore,isRemoteMutation} from '../design-systems/menu-local-20261029/operations';
const require=createRequire(import.meta.url);
const message=(id:string,pending=false)=>({id,pending,body:id,createdAt:'2026-11-02T12:54:31.422Z',isOwn:true} as any);

test('member read recovery repeats only GET after a transient server failure; chat POST is never resent',async()=>{
 let calls=0;const store=createOperationStore(),exports:any={};
 const code=ts.transpileModule(readFileSync('design-systems/member-pilot-20261102/authenticatedFetch.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{exports,require:(id:string)=>id==='../../src/lib/authenticatedFetch'?{authFetch:async()=>{calls++;return calls===1?new Response('Temporary failure',{status:500}):Response.json({data:[]});}}:id.includes('/operations')?{operations:store}:id.includes('/uploadTransport')?{}:require(id),URL,File,Blob,Error,Response});
 assert.equal((await exports.authFetch('/api/v1/chat/conversations')).status,200);assert.equal(calls,2);
 calls=0;assert.equal((await exports.authFetch('/api/v1/chat/conversations/id/messages',{method:'POST',body:'{}'})).status,500);assert.equal(calls,1);assert.equal(store.snapshot().length,0);
});
test('confirming one optimistic message never deletes a different concurrent send',()=>{
 const rows=[message('first',true),message('second',true),message('real-first')];
 const next=confirmChatMessage(rows,'first','real-first','2026-11-02T12:54:32Z');
 assert.deepEqual(next.map(row=>row.id),['second','real-first']);assert.equal(next[0].pending,true);
 const final=confirmChatMessage(next,'second','real-second','2026-11-02T12:54:33Z');assert.equal(final.filter(row=>row.pending).length,0);assert.equal(final.length,2);
});
test('a delayed history refresh preserves pending sends and newer realtime messages',()=>{
 const next=mergeChatMessages([message('known'),message('realtime'),message('pending',true)],[message('known')]);
 assert.deepEqual(next.map(row=>row.id),['known','realtime','pending']);
});
test('the manager bell uses recipient unread counts, stable conversation ids and real timestamps',()=>{
 const rows=[{id:'own-send',unreadCount:0},{id:'old',unreadCount:1,lastMessageAt:'2026-11-01T12:00:00Z',peer:{nome:'Membro'},lastMessagePreview:'Olá'},{id:'new',type:'group',title:'Corrente',unreadCount:2,lastMessageAt:'2026-11-02T12:54:31.422Z',lastMessagePreview:'Nova mensagem'}] as any;
 const alerts=unreadChatAlerts(rows);assert.deepEqual(alerts.map(row=>row.id),['new','old']);assert.equal(alerts[0].count,2);assert.equal(alerts[0].date,rows[2].lastMessageAt);
 assert.equal(unreadChatAlerts(rows.map((row:any)=>({...row,unreadCount:0}))).length,0);
});
test('reading a conversation stays quiet while adding a message still owns send progress',()=>{
 const before={conversations:[{id:'thread',unread:true,messages:[],archived:false,title:''}]};
 const read={conversations:[{...before.conversations[0],unread:false}]};assert.equal(isRemoteMutation('inbox',read,before),false);
 const sent={conversations:[{...before.conversations[0],messages:[message('new')]}]};assert.equal(isRemoteMutation('inbox',sent,before),true);
});
test('chat opens, read markers, text and uploads preserve authentication without opening the global activities panel',async()=>{
 const store=createOperationStore(),calls:any[]=[];
 const source=readFileSync('design-systems/member-pilot-20261102/authenticatedFetch.ts','utf8'),compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports:any={};
 const transport=async()=>Response.json({});
 runInNewContext(compiled,{exports,require:(id:string)=>id==='../../src/lib/authenticatedFetch'?{authFetch:async(...args:any[])=>{calls.push(args);return Response.json({message:{id:'confirmed'}});}}:id.includes('/operations')?{operations:store}:id.includes('/uploadTransport')?{xhrUploadTransport:()=>transport}:require(id),URL,File,Blob,Error,Response});
 const file=new File(['photo'],'photo.png',{type:'image/png'});
 for(const path of ['/api/v1/chat/conversations','/api/v1/chat/conversations/id/read','/api/v1/chat/conversations/id/messages','/api/v1/chat/conversations/id/upload'])await exports.authFetch(path,{method:'POST',body:path.endsWith('upload')?file:'{}'},'same-session',transport);
 assert.equal(store.snapshot().length,0);assert.equal(calls.length,4);assert.ok(calls.every(call=>call[2]==='same-session'&&call[3]===transport));assert.equal(calls[3][1].body,file);
});
function bootstrapHarness(userId:string,result:any={enabled:true},reject=false){
 const nodes:any[]=[],elements=new Map<string,any>();let resolve!:()=>void,reloads=0,fetches=0;
 const element=(tag:string)=>{const node:any={tag,hidden:false,textContent:'',innerHTML:'',removed:false,setAttribute(){},remove(){this.removed=true;},querySelector(selector:string){if(!elements.has(selector))elements.set(selector,{hidden:false,textContent:''});return elements.get(selector);}};return node;};
 const document={head:{append:(node:any)=>nodes.push(node)},documentElement:{append:(node:any)=>nodes.push(node)},createElement:element};
 const pending=new Promise<void>(done=>{resolve=done;});
 runInNewContext(pilotBootstrap(['allowed-member','allowed-manager']),{document,location:{pathname:'/dashboard',search:'',reload:()=>{reloads++;}},localStorage:{getItem:()=>JSON.stringify({user:{id:userId},access_token:'test-session'})},fetch:async()=>{fetches++;await pending;if(reject)throw Error('offline');return Response.json(result);},URLSearchParams,AbortController,setTimeout:()=>1,clearTimeout(){},setInterval(){},window:{addEventListener(){}}});
 return {nodes,elements,resolve,reloads:()=>reloads,fetches:()=>fetches};
}
test('pilot startup covers the previous layout synchronously before access validation resolves',async()=>{
 const h=bootstrapHarness('allowed-member');assert.equal(h.nodes.length,2);assert.match(h.nodes[0].textContent,/visibility:hidden!important/);assert.equal(h.reloads(),0);h.resolve();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.reloads(),1);assert.ok(h.nodes.every(node=>!node.removed));
});
test('the startup cover never unlocks private assets, does not affect other members and recovers from outages',async()=>{
 const other=bootstrapHarness('other-member');assert.equal(other.nodes.length,0);assert.equal(other.fetches(),0);
 const denied=bootstrapHarness('allowed-member',{enabled:false});denied.resolve();await new Promise(resolve=>setImmediate(resolve));assert.equal(denied.reloads(),0);assert.ok(denied.nodes.every(node=>node.removed));
 const failed=bootstrapHarness('allowed-member',{},true);failed.resolve();await new Promise(resolve=>setImmediate(resolve));assert.equal(failed.reloads(),0);assert.ok(failed.nodes.every(node=>!node.removed));assert.equal(failed.elements.get('#boot-recovery').hidden,true);assert.match(failed.elements.get('#boot-status').textContent,/Reconectando/);
});
