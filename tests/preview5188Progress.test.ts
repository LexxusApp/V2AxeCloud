import test from 'node:test';
import assert from 'node:assert/strict';
import { activityUsesPanel, createOperationStore, currentOperation, withOperation, fileTransferPercent, operationPending, isRemoteMutation } from '../design-systems/menu-local-20261029/operations';
import { confirmCachedUpload } from '../design-systems/menu-local-20261029/confirmedUpload';
import { dispatchesFromServer, serverDispatchStatus } from '../design-systems/menu-local-20261029/dispatchReadModels';
import { dispatchGroup, dispatchStatus } from '../design-systems/menu-local-20261029/whatsappDispatches';
import { createRefreshLoop } from '../design-systems/menu-local-20261029/refreshLoop';
import { xhrUploadTransport } from '../design-systems/menu-local-20261029/uploadTransport';

test('concurrent operations retain independent progress, completion and errors',()=>{
 const store=createOperationStore(),first=store.begin('Fotos'),second=store.begin('Financeiro');
 first.files([{id:'a',name:'foto.jpg',bytes:100}]);first.progress('a',25,100);second.fail(new Error('Falha no caixa'));
 assert.equal(store.snapshot().length,2);assert.equal(store.snapshot()[0].state,'working');assert.equal(store.snapshot()[0].files[0].progress,.25);assert.equal(store.snapshot()[1].state,'error');
 first.file('a',{phase:'done',progress:1});first.complete();assert.equal(store.snapshot()[0].state,'done');assert.equal(store.snapshot()[1].state,'error');
});
test('the detailed activity panel is reserved for gallery uploads and member dispatches',()=>{
 const store=createOperationStore(),gallery=store.begin('Fotos','gallery'),receipt=store.begin('Comprovante'),save=store.begin('Cadastro'),send=store.begin('Aviso');
 gallery.files([{id:'photo',name:'foto.jpg',bytes:100}]);receipt.files([{id:'receipt',name:'comprovante.jpg',bytes:100}]);send.sending();
 assert.equal(activityUsesPanel(store.snapshot().find(row=>row.id===gallery.id)!),true);
 assert.equal(activityUsesPanel(store.snapshot().find(row=>row.id===send.id)!),true);
 assert.equal(activityUsesPanel(store.snapshot().find(row=>row.id===receipt.id)!),false);
 assert.equal(activityUsesPanel(store.snapshot().find(row=>row.id===save.id)!),false);
});
test('async writers capture their own operation without leaking an async global scope',async()=>{
 const store=createOperationStore(),a=store.begin('A'),b=store.begin('B'),captured:string[]=[];
 const write=async()=>{const operation=currentOperation()!;await Promise.resolve();captured.push(operation.id);};
 await Promise.all([withOperation(a,write),withOperation(b,write)]);
 assert.deepEqual(captured,[a.id,b.id]);assert.equal(currentOperation(),undefined);
});
test('100 percent transferred is not a saved file; partial failures preserve already confirmed files',()=>{
 const store=createOperationStore(),op=store.begin('Lote');op.files([{id:'a',name:'a.jpg',bytes:100},{id:'b',name:'b.jpg',bytes:300}]);
 op.progress('a',100,100);op.file('a',{phase:'confirming'});assert.equal(store.snapshot()[0].files.filter(file=>file.phase==='done').length,0);
 op.file('a',{phase:'done',progress:1});op.progress('b',150,300);assert.equal(fileTransferPercent(store.snapshot()[0].files),63);
 op.fail(new Error('Falha em b'));assert.equal(store.snapshot()[0].files[0].phase,'done');assert.equal(store.snapshot()[0].files[1].phase,'error');
});
test('unknown upload total never invents a percentage',()=>{
 const store=createOperationStore(),op=store.begin('Arquivo');op.files([{id:'a',name:'a.pdf',bytes:100}]);op.progress('a',50);
 assert.equal(fileTransferPercent(store.snapshot()[0].files),undefined);
 op.progress('a',200,100);assert.equal(fileTransferPercent(store.snapshot()[0].files),100);
});
test('clearing completed operations retains writes and messages awaiting delivery',()=>{
 const store=createOperationStore(),write=store.begin('Foto'),send=store.begin('Aviso'),done=store.begin('Outra');
 send.sent('message-1');send.complete();done.complete();store.clearFinished();
 assert.deepEqual(store.snapshot().map(row=>row.id),[write.id,send.id]);assert.equal(operationPending(store.snapshot()[1]),true);
 store.delivery('message-1','delivered');assert.equal(operationPending(store.snapshot()[1]),false);store.clearFinished();assert.deepEqual(store.snapshot().map(row=>row.id),[write.id]);
});
test('a provider status updates only the matching outbound message and never means delivered merely because it was accepted',()=>{
 const store=createOperationStore(),a=store.begin('A'),b=store.begin('B');a.sent('a','accepted');a.complete();b.sent('b');b.complete();
 assert.equal(operationPending(store.snapshot()[0]),true);store.delivery('a','read');assert.equal(store.snapshot()[0].delivery?.status,'read');assert.equal(store.snapshot()[1].delivery?.status,'sent');
 store.delivery('b','failed');assert.equal(store.snapshot()[1].state,'error');assert.equal(store.snapshot()[0].state,'done');
});
test('finished history limits never evict active transfers',()=>{
 const store=createOperationStore(),running=store.begin('Em andamento');for(let i=0;i<60;i++)store.begin(String(i)).complete();
 assert.ok(store.snapshot().some(row=>row.id===running.id));assert.ok(store.snapshot().length<=41);
});
test('local draft/cart edits are not reported as server writes',()=>{
 const profile={},whatsapp={},products=[],orders=[],tickets=[];
 assert.equal(isRemoteMutation('account',{profile,whatsapp,draft:{x:1}},{profile,whatsapp,draft:{}}),false);
 assert.equal(isRemoteMutation('shop',{products,orders,cart:{a:1}},{products,orders,cart:{}}),false);
 assert.equal(isRemoteMutation('support',{tickets,draft:{}},{tickets,draft:{a:1}}),false);
});
test('retrying a partial upload repeats only the unconfirmed metadata step',async()=>{
 const task={pushed:false,saved:false};let transfers=0,confirmations=0,fail=true;
 const transfer=async()=>{transfers++;},confirm=async()=>{confirmations++;if(fail)throw Error('metadata');};
 await assert.rejects(confirmCachedUpload(task,transfer,confirm));assert.deepEqual(task,{pushed:true,saved:false});
 fail=false;await confirmCachedUpload(task,transfer,confirm);await confirmCachedUpload(task,transfer,confirm);
 assert.equal(transfers,1);assert.equal(confirmations,2);assert.deepEqual(task,{pushed:true,saved:true});
});
test('a failed network transfer never runs completion or retries by itself',async()=>{
 const task={pushed:false,saved:false};let transfers=0,confirmations=0;
 await assert.rejects(confirmCachedUpload(task,async()=>{transfers++;throw Error('network');},async()=>{confirmations++;}));
 assert.equal(transfers,1);assert.equal(confirmations,0);assert.deepEqual(task,{pushed:false,saved:false});
});
test('dispatch mapping keeps acceptance separate, rejects foreign records and invents no delivery timestamp',()=>{
 const row={id:'1',tenant_id:'own',filho_id:'member',status:'accepted',tipo:'cantina',external_id:'external',created_at:'2026-11-02T03:00:00Z',telefone:'11999990000'};
 const mapped=dispatchesFromServer([row],'own',[{id:'member',name:'Membro'}])[0];
 assert.equal(mapped.externalId,'external');assert.equal(mapped.recipient,'Membro');assert.equal(dispatchStatus(mapped),'accepted');assert.equal(dispatchGroup(dispatchStatus(mapped)),'pending');assert.equal(mapped.statusTimestampUnknown,true);
 assert.equal(serverDispatchStatus('undelivered'),'unknown');assert.equal(serverDispatchStatus('mystery'),'unknown');
 assert.throws(()=>dispatchesFromServer([{...row,tenant_id:'foreign'}],'own'));
 assert.equal(dispatchGroup(dispatchStatus(dispatchesFromServer([{...row,status:'delivered'}],'own')[0])),'success');
});
test('refresh loop permits only one read, pauses while hidden/offline, resumes and backs off after errors',async()=>{
 let available=true,calls=0,finish!:()=>void,scheduled:(()=>void)|undefined,delay=0;
 const loop=createRefreshLoop({available:()=>available,refresh:()=>{calls++;return new Promise<void>(resolve=>{finish=resolve;});},setTimer:(cb,ms)=>{scheduled=cb;delay=ms;return cb;},clearTimer:()=>{scheduled=undefined;}});
 loop.resume();loop.resume();assert.equal(calls,1);available=false;finish();await Promise.resolve();await Promise.resolve();assert.equal(scheduled,undefined);
 loop.resume();assert.equal(calls,1);available=true;loop.resume();assert.equal(calls,2);finish();await Promise.resolve();await Promise.resolve();assert.equal(delay,8000);loop.stop();assert.equal(scheduled,undefined);
 const failing=createRefreshLoop({available:()=>true,refresh:async()=>{throw Error('read');},setTimer:(_cb,ms)=>{delay=ms;return 1;},clearTimer:()=>{}});failing.resume();await Promise.resolve();await Promise.resolve();assert.equal(delay,30000);failing.stop();
});

test('history exposes the last webhook failure reason without adding internal markers to the sent message',()=>{
 const row={id:'1',tenant_id:'own',status:'failed',mensagem:'Aviso da casa\n\n[meta:falha 131026 Message undeliverable]'};
 const mapped=dispatchesFromServer([row],'own')[0];
 assert.equal(mapped.message,'Aviso da casa');assert.equal(mapped.failure?.reason,'131026 Message undeliverable');
});

class FakeXHR {
 upload:any={};headers:Record<string,string>={};onload:any;onerror:any;ontimeout:any;onabort:any;status=200;statusText='OK';responseText='{"ok":true}';timeout=0;withCredentials=false;body:any;sends=0;
 open(_method:string,_url:string,_async:boolean){}setRequestHeader(key:string,value:string){this.headers[key]=value;}getAllResponseHeaders(){return 'content-type: application/json\r\n';}send(body:any){this.body=body;this.sends++;}abort(){this.onabort?.();}
}
test('XHR transport reports measured progress and returns the real response for authenticatedFetch',async()=>{
 const xhr=new FakeXHR(),progress:(number|undefined)[][]=[];
 const promise=xhrUploadTransport((loaded,total)=>progress.push([loaded,total]),()=>xhr as any)('https://unit.invalid/upload',{method:'POST',body:'payload',headers:{Authorization:'Bearer test-token'}});
 xhr.upload.onprogress({loaded:25,total:100,lengthComputable:true});xhr.upload.onload();xhr.onload();
 const response=await promise;assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});assert.deepEqual(progress[0],[25,100]);assert.equal(xhr.headers.authorization,'Bearer test-token');assert.equal(xhr.sends,1);
});
test('XHR network failure rejects without resending and unknown totals remain unknown',async()=>{
 const xhr=new FakeXHR(),progress:any[]=[];const promise=xhrUploadTransport((loaded,total)=>progress.push([loaded,total]),()=>xhr as any)('https://unit.invalid/upload',{method:'PUT',body:'payload'});
 xhr.upload.onprogress({loaded:10,total:0,lengthComputable:false});xhr.onerror();await assert.rejects(promise,/conexão falhou/);assert.equal(progress[0][1],undefined);assert.equal(xhr.sends,1);
});
test('XHR abort and HTTP 401 remain distinguishable so the existing auth flow owns renewal',async()=>{
 const xhr=new FakeXHR(),controller=new AbortController();const pending=xhrUploadTransport(()=>{},()=>xhr as any)('https://unit.invalid/upload',{signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});
 const denied=new FakeXHR();denied.status=401;denied.statusText='Unauthorized';const request=xhrUploadTransport(()=>{},()=>denied as any)('https://unit.invalid/upload',{method:'POST'});denied.onload();assert.equal((await request).status,401);assert.equal(denied.sends,1);
});
