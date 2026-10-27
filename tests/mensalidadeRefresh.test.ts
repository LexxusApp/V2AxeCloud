import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshMensalidadesWithoutBlocking, synchronizeMensalidadesOnce, withMensalidadeDeadline} from '../src/lib/mensalidadeRefresh.ts';
function deferred<T>() {let resolve!: (value:T)=>void;let reject!: (reason:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}

test('lista aparece e libera carregamento antes de uma sincronização lenta terminar',async()=>{
  const sync=deferred<{created:number}>();let rows:any=null,loaded=false,done=false,reads=0;
  const work=refreshMensalidadesWithoutBlocking({read:async()=>{reads++;return [{valor:102}];},sync:()=>sync.promise,
    onData:data=>{rows=data;},onReadDone:()=>{loaded=true;},onSyncDone:()=>{done=true;},onError:assert.fail});
  await new Promise(r=>setImmediate(r));
  assert.deepEqual(rows,[{valor:102}]);assert.equal(loaded,true);assert.equal(done,false);
  sync.resolve({created:0});await work;assert.equal(done,true);assert.equal(reads,1);
});
test('atualiza a lista após criação, remoção ou alteração de valor sem perder a primeira leitura',async()=>{
  for(const result of [{created:1},{removed:1},{revalued:1}]){
    let reads=0;const versions:number[]=[];
    await refreshMensalidadesWithoutBlocking({read:async()=>++reads,sync:async()=>result,
      onData:data=>{versions.push(data);},onReadDone:()=>{},onSyncDone:()=>{},onError:assert.fail});
    assert.deepEqual(versions,[1,2]);
  }
});
test('falha na sincronização conserva a lista e libera estado de atualização',async()=>{
  let rows=[102],done=false;const errors:unknown[]=[];
  await refreshMensalidadesWithoutBlocking({read:async()=>[102],sync:async()=>{throw Error('offline');},
    onData:data=>{rows=data;},onReadDone:()=>{},onSyncDone:()=>{done=true;},onError:e=>{errors.push(e);}});
  assert.deepEqual(rows,[102]);assert.equal(errors.length,1);assert.equal(done,true);
});
test('falha de leitura não substitui as cobranças já exibidas por lista vazia',async()=>{
  let rows=[102],loaded=false;
  await refreshMensalidadesWithoutBlocking({read:async()=>{throw Error('503');},onData:data=>{rows=data as number[];},
    onReadDone:()=>{loaded=true;},onSyncDone:()=>{},onError:()=>{}});
  assert.deepEqual(rows,[102]);assert.equal(loaded,true);
});
test('compartilha sync simultânea por usuário/terreiro, isola contas e permite tentar novamente',async()=>{
  const gate=deferred<{created:number}>();let calls=0;
  const task=()=>{calls++;return gate.promise;};
  const a=synchronizeMensalidadesOnce('A',task),b=synchronizeMensalidadesOnce('A',task),c=synchronizeMensalidadesOnce('B',task);
  assert.equal(a,b);assert.notEqual(a,c);await Promise.resolve();assert.equal(calls,2);gate.resolve({created:0});await Promise.all([a,b,c]);
  await assert.rejects(synchronizeMensalidadesOnce('A',async()=>{throw Error('fail');}));
  assert.deepEqual(await synchronizeMensalidadesOnce('A',async()=>({created:2})),{created:2});
});
test('interrompe solicitação de rede travada e libera a tentativa seguinte',async()=>{
  await assert.rejects(withMensalidadeDeadline(signal=>new Promise((_,reject)=>{
    signal.addEventListener('abort',()=>reject(Error('timeout')),{once:true});
  }),10),/timeout/);
  assert.equal(await withMensalidadeDeadline(async()=>42),42);
});
