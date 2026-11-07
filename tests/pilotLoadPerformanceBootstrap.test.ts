import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {pilotBootstrap} from '../cloudflare/pilot-bootstrap.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve!:(value:Response)=>void;const promise=new Promise<Response>(done=>{resolve=done;});return {promise,resolve};};
function bootstrapFixture(initial:(signal:AbortSignal)=>Promise<Response>) {
  let hint:any={access_token:'fixture-token-a',user:{id:'pilot-user'}},handler=initial,poll!:()=>Promise<void>,requests=0,reloads=0,holding=false;
  const nodes=new Map<string,any>([['#boot-status',{textContent:'Abrindo sua casa…'}],['#boot-progress',{hidden:false}],['#boot-recovery',{hidden:true}],['#boot-retry',{}]]);
  const timers=new Set<()=>void>();
  const document={head:{append(){}},documentElement:{append(){holding=true;}},createElement(){return {remove(){holding=false;},querySelector:(id:string)=>nodes.get(id)};}};
  runInNewContext(pilotBootstrap(['pilot-user','member-user']),{document,localStorage:{getItem:()=>JSON.stringify(hint)},location:{pathname:'/dashboard',search:'',reload(){reloads++;}},window:{addEventListener(){}},URLSearchParams,AbortController,setTimeout:(fn:()=>void)=>{timers.add(fn);return fn;},clearTimeout:(fn:()=>void)=>timers.delete(fn),setInterval:(fn:()=>Promise<void>)=>{poll=fn;},fetch:async(_url:string,init:any)=>{requests++;return handler(init.signal);}});
  return {nodes,timers,poll:()=>poll(),counts:()=>({requests,reloads,holding}),setHandler:(next:typeof handler)=>{handler=next;},setHint:(next:any)=>{hint=next;}};
}

test('a transient bootstrap outage keeps the existing loading feedback and recovers only after authorization',async()=>{
  const f=bootstrapFixture(async()=>Response.json({enabled:false},{status:503}));await tick();assert.equal(f.counts().requests,1);assert.equal(f.counts().holding,true);assert.equal(f.counts().reloads,0);
  assert.equal(f.nodes.get('#boot-status').textContent,'Reconectando sua conta…');assert.equal(f.nodes.get('#boot-progress').hidden,false);assert.equal(f.nodes.get('#boot-recovery').hidden,true);
  f.setHandler(async()=>Response.json({enabled:true}));await f.poll();assert.equal(f.counts().reloads,1);assert.equal(f.counts().requests,2);assert.equal(f.timers.size,0);
});

test('bootstrap retries are bounded; manual retry resets the same feedback and retains one in-flight probe',async()=>{
  const f=bootstrapFixture(async()=>{throw Error('Offline fixture');});await tick();await f.poll();await f.poll();assert.equal(f.counts().requests,3);assert.match(f.nodes.get('#boot-status').textContent,/Não foi possível conectar/);assert.equal(f.nodes.get('#boot-recovery').hidden,false);
  await f.poll();await f.poll();assert.equal(f.counts().requests,3);
  const pending=deferred();f.setHandler(()=>pending.promise);f.nodes.get('#boot-retry').onclick({preventDefault(){}});await tick();assert.equal(f.nodes.get('#boot-progress').hidden,false);assert.equal(f.nodes.get('#boot-recovery').hidden,true);
  await f.poll();assert.equal(f.counts().requests,4);pending.resolve(Response.json({enabled:true}));await tick();assert.equal(f.counts().reloads,1);
});

test('bootstrap timeout is retried as pending before a terminal error, without enabling access',async()=>{
  const f=bootstrapFixture(signal=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Timeout fixture')))));
  for(const timeout of f.timers)timeout();await tick();assert.equal(f.nodes.get('#boot-recovery').hidden,true);assert.equal(f.counts().reloads,0);assert.equal(f.counts().holding,true);
  f.setHandler(async()=>Response.json({enabled:true}));await f.poll();assert.equal(f.counts().reloads,1);
});

test('a confirmed authorization denial releases the cover without repeated requests or a pilot reload',async()=>{
  for(const status of [200,403]){
    const f=bootstrapFixture(async()=>Response.json({enabled:false},{status}));await tick();await f.poll();assert.equal(f.counts().holding,false);assert.equal(f.counts().reloads,0);assert.equal(f.counts().requests,1);
  }
});

test('a late response for an abandoned identity never selects the next account; a changed token retries authorization',async()=>{
  const pending=deferred(),f=bootstrapFixture(()=>pending.promise);f.setHint({access_token:'fixture-token-b',user:{id:'member-user'}});pending.resolve(Response.json({enabled:true}));await tick();assert.equal(f.counts().reloads,0);
  f.setHandler(async()=>Response.json({enabled:true}));await f.poll();assert.equal(f.counts().requests,2);assert.equal(f.counts().reloads,1);
});
