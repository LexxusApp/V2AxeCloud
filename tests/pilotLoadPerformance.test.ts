import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import PageLoading from '../design-systems/shared/PageLoading';
import {renderToStaticMarkup} from 'react-dom/server';

const require=createRequire(import.meta.url);
const deferred=<T=any>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function load(file:string,deps:Record<string,any>,globals:Record<string,any>={}) {
  const exports:any={};
  const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  runInNewContext(code,{exports,require:(name:string)=>{
    if(name in deps)return deps[name];
    if(name==='react/jsx-runtime')return require(name);
    throw Error(`Unexpected dependency: ${name}`);
  },Promise,Error,Response,Headers,AbortController,Date,...globals});
  return exports;
}
function sessionFixture() {
  let now=100_000,user={id:'leader',email:'leader@example.invalid'},profile:any={tenant_id:'own-house',role:'admin',status:'active'};
  let authHandler:any,subscriptions=0,unsubscribed=0,getSessions=0,accessReads=0;
  const redirects:string[]=[],timers=new Set<()=>void>(),visibility=new Set<()=>void>(),calls:string[]=[];
  let getSession=async()=>({data:{session:{user}}});
  let access=async()=>Response.json({enabled:true,profile});
  let endpoint=async(_url:string,_init:any)=>Response.json({data:[{id:'real'}]});
  const api=load('design-systems/menu-local-20261029/remote/session.ts',{
    '../../../src/lib/supabase':{supabase:{auth:{getSession:()=>{getSessions++;return getSession();},onAuthStateChange:(handler:any)=>{subscriptions++;authHandler=handler;return {data:{subscription:{unsubscribe(){unsubscribed++;}}}};}}}},
    '../../../src/lib/authenticatedFetch':{authFetch:(url:string,init:any)=>{calls.push(url);if(url.startsWith('/api/pilot/interface-access')){accessReads++;return access();}return endpoint(url,init);}},
    '../uploadTransport':{},'../../../lib/pilotLogout':{},
  },{Date:class extends Date{static now(){return now;}},setInterval:(fn:()=>void)=>{timers.add(fn);return fn;},clearInterval:(fn:()=>void)=>timers.delete(fn),document:{visibilityState:'visible',addEventListener:(_event:string,fn:()=>void)=>visibility.add(fn),removeEventListener:(_event:string,fn:()=>void)=>visibility.delete(fn)},location:{hostname:'axecloud.com.br',replace:(url:string)=>redirects.push(url)}});
  return {api,calls,redirects,timers,visibility,advance:(ms:number)=>{now+=ms;},counts:()=>({subscriptions,unsubscribed,getSessions,accessReads}),event:(event:string,next:any)=>authHandler(event,next),setUser:(next:typeof user)=>{user=next;},setProfile:(next:any)=>{profile=next;},setAccess:(next:typeof access)=>{access=next;},setGetSession:(next:typeof getSession)=>{getSession=next;},setEndpoint:(next:typeof endpoint)=>{endpoint=next;}};
}
function runtimeFixture(sessionApi?:any) {
  let now=100_000;
  const effects:Array<()=>void>=[],listeners=new Set<()=>void>();
  const session=sessionApi||{previewSession:()=>({userId:'leader',tenantId:'own-house',email:'leader@example.invalid',profile:{}}),onPreviewSessionChange:(listener:()=>void)=>listeners.add(listener)};
  let request=async(_url:string)=>({data:[]}),readFinance=async()=>[];
  const api=load('design-systems/menu-local-20261029/remote/runtime.tsx',{
    '../../shared/PageLoading':{default:PageLoading},react:{useEffect:(effect:()=>void)=>effects.push(effect),useSyncExternalStore:(_subscribe:any,snapshot:()=>unknown)=>snapshot()},
    './session':{...session,request:(url:string)=>request(url),scoped:(url:string)=>url},
    './readModels':{memberFromServer:(row:any)=>row,financeFromServer:(rows:any,people:any)=>({mapped:{rows,people}})},
    './financeRead':{readFinance:()=>readFinance()},'../operations':{},
    '../../../src/lib/supabase':{supabase:{}},'../../../cloudflare/pilot-granular-policy.js':{grantAllows:()=>false},
  },{Date:class extends Date{static now(){return now;}}});
  return {api,effects,advance:(ms:number)=>{now+=ms;},setRequest:(next:any)=>{request=next;},setFinance:(next:any)=>{readFinance=next;},status:(key:string)=>api.useResourceStatus([key])[key],gate:(tab:string)=>renderToStaticMarkup(api.RemotePageGate({tab,children:'AUTHORIZED DATA'}))};
}

test('concurrent startup verifies auth and pilot once; retry keeps one timer, listener and subscription',async()=>{
  const f=sessionFixture(),pending=deferred<Response>();f.setAccess(()=>pending.promise);
  const stages:string[]=[],first=f.api.connectPreview({onStage:(stage:string)=>stages.push(stage)}),second=f.api.connectPreview();
  await tick();assert.throws(()=>f.api.previewSession(),/Entre/);assert.equal(f.counts().getSessions,1);assert.equal(f.counts().accessReads,1);
  pending.resolve(Response.json({enabled:true,profile:{tenant_id:'own-house',role:'admin'}}));
  assert.deepEqual(await Promise.all([first,second]),[true,true]);assert.ok(stages.includes('house'));assert.equal(f.timers.size,1);assert.equal(f.visibility.size,1);
  f.setAccess(async()=>Response.json({enabled:true,profile:{tenant_id:'own-house',role:'admin'}}));await f.api.connectPreview();
  assert.equal(f.timers.size,1);assert.equal(f.visibility.size,1);assert.equal(f.counts().subscriptions,1);
});

test('one canceled startup caller does not cancel another; abandoned startup never authorizes data',async()=>{
  const f=sessionFixture(),gate=deferred<Response>();f.setAccess(()=>gate.promise);
  const controller=new AbortController(),first=f.api.connectPreview({signal:controller.signal}),second=f.api.connectPreview();
  const canceled=assert.rejects(first);controller.abort();await canceled;
  gate.resolve(Response.json({enabled:true,profile:{tenant_id:'own-house',role:'admin'}}));assert.equal(await second,true);
  const alone=sessionFixture(),slow=deferred<Response>();alone.setAccess(()=>slow.promise);const abort=new AbortController(),connection=alone.api.connectPreview({signal:abort.signal});
  await tick();const rejected=assert.rejects(connection);abort.abort();await rejected;slow.resolve(Response.json({enabled:true,profile:{tenant_id:'own-house',role:'admin'}}));await tick();assert.throws(()=>alone.api.previewSession(),/Entre/);assert.equal(alone.timers.size,0);
});

test('simultaneous exact GETs share one authorized read, with no settled cache or write deduplication',async()=>{
  const f=sessionFixture();await f.api.connectPreview();const gate=deferred<Response>();let reads=0,writes=0;
  f.setEndpoint(async(_url,init)=>{if(init.method==='GET'){reads++;return gate.promise;}writes++;return Response.json({success:true});});
  const first=f.api.request('/api/events'),second=f.api.request('/api/events','get');await tick();assert.equal(reads,1);
  gate.resolve(Response.json({data:[{id:'event'}]}));assert.equal((await first).data[0].id,'event');await second;
  f.setEndpoint(async(_url,init)=>{if(init.method==='GET')reads++;else writes++;return Response.json({success:true});});
  await f.api.request('/api/events');assert.equal(reads,2);await Promise.all([f.api.request('/api/events','POST',{}),f.api.request('/api/events','POST',{})]);assert.equal(writes,2);
});

test('different queries remain independent; failed reads coalesce their single retry and mutations never retry',async()=>{
  const f=sessionFixture();await f.api.connectPreview();let calls=0;
  f.setEndpoint(async()=>{calls++;return calls===1?Response.json({error:'temporary'},{status:503}):Response.json({success:true});});
  await Promise.all([f.api.request('/api/events'),f.api.request('/api/events')]);assert.equal(calls,2);
  await Promise.all([f.api.request('/api/events?from=a'),f.api.request('/api/events?from=b')]);assert.equal(calls,4);
  f.setEndpoint(async()=>{calls++;return Response.json({error:'rejected'},{status:503});});
  await assert.rejects(f.api.request('/api/transactions','POST',{}),/rejected/);assert.equal(calls,5);
});

test('GET sharing never crosses the start or completion of a mutation',async()=>{
  const f=sessionFixture();await f.api.connectPreview();const before=deferred<Response>(),during=deferred<Response>(),write=deferred<Response>();let reads=0;
  f.setEndpoint(async(_url,init)=>{if(init.method!=='GET')return write.promise;reads++;return reads===1?before.promise:reads===2?during.promise:Response.json({revision:'after'});});
  const old=f.api.request('/api/events');await tick();const mutation=f.api.request('/api/events','PATCH',{}),overlap=f.api.request('/api/events');await tick();assert.equal(reads,2);
  write.resolve(Response.json({success:true}));await mutation;const fresh=await f.api.request('/api/events');assert.equal(reads,3);assert.equal(fresh.revision,'after');
  before.resolve(Response.json({revision:'before'}));during.resolve(Response.json({revision:'during'}));await Promise.all([old,overlap]);
});

test('logout while body or request is pending discards the response, clears runtime and prevents a retry',async()=>{
  const f=sessionFixture();await f.api.connectPreview();const r=runtimeFixture(f.api);r.api.publishValue('private',{balance:100});
  const body=deferred(),response=deferred<Response>();let requests=0;
  f.setEndpoint(async(url)=>{requests++;if(url==='/api/body')return {status:200,ok:true,headers:new Headers({'content-type':'application/json'}),json:()=>body.promise} as Response;return response.promise;});
  const first=f.api.request('/api/body'),second=f.api.request('/api/retry');const rejected=Promise.all([assert.rejects(first),assert.rejects(second)]);await tick();
  f.event('SIGNED_OUT',null);body.resolve({balance:100});response.resolve(Response.json({error:'temporary'},{status:503}));await rejected;
  assert.equal(requests,2);assert.equal(f.timers.size,0);assert.equal(f.visibility.size,0);assert.equal(f.counts().unsubscribed,1);assert.throws(()=>r.api.readValue('private'),/Entre/);assert.equal(await f.api.connectPreview(),false);
});

test('same-user tenant changes and auth identity changes invalidate the document before further data',async()=>{
  const f=sessionFixture();await f.api.connectPreview();f.setProfile({tenant_id:'other-house',role:'admin'});assert.equal(await f.api.connectPreview(),false);assert.throws(()=>f.api.previewSession(),/Entre/);assert.deepEqual(f.redirects,['/entrar']);
  const other=sessionFixture();await other.api.connectPreview();other.event('SIGNED_IN',{user:{id:'another-user'}});assert.throws(()=>other.api.previewSession(),/Entre/);assert.equal(other.timers.size,0);
});

test('visibility bursts coalesce renewal and skip recently verified access; revocation clears the session',async()=>{
  const f=sessionFixture();await f.api.connectPreview();for(const fn of f.visibility)fn();await tick();assert.equal(f.counts().accessReads,1);
  f.advance(60_001);const gate=deferred<Response>();f.setAccess(()=>gate.promise);for(let i=0;i<5;i++)for(const fn of f.visibility)fn();for(const fn of f.timers)fn();await tick();assert.equal(f.counts().accessReads,2);
  gate.resolve(Response.json({enabled:false},{status:403}));await tick();assert.throws(()=>f.api.previewSession(),/Entre/);assert.deepEqual(f.redirects,['/dashboard?space=member']);
});

test('outage with non-JSON content remains a retryable access error without authorizing or redirecting',async()=>{
  const f=sessionFixture();f.setAccess(async()=>new Response('Unavailable',{status:503}));await assert.rejects(f.api.connectPreview(),/temporariamente indisponível/);assert.equal(f.redirects.length,0);assert.throws(()=>f.api.previewSession(),/Entre/);
});

test('data cannot start before pilot authorization; signout during initial auth prevents late activation',async()=>{
  const f=sessionFixture(),auth=deferred();f.setGetSession(()=>auth.promise);const connection=f.api.connectPreview();await tick();
  await assert.rejects(f.api.request('/api/children'),/Entre/);assert.equal(f.calls.length,0);
  const rejected=assert.rejects(connection);f.event('SIGNED_OUT',null);auth.resolve({data:{session:{user:{id:'leader'}}}});await rejected;
  assert.throws(()=>f.api.previewSession(),/Entre/);assert.equal(f.counts().accessReads,0);assert.equal(f.timers.size,0);
});

test('a member role or blocked profile cannot retain an existing manager session',async()=>{
  for(const profile of [{tenant_id:'own-house',role:'filho'},{tenant_id:'own-house',role:'admin',status:'blocked'}]){
    const f=sessionFixture();await f.api.connectPreview();f.setProfile(profile);await assert.rejects(f.api.connectPreview());assert.throws(()=>f.api.previewSession(),/Entre/);assert.equal(f.timers.size,0);
  }
});

test('delegated management renewal keeps explicit manager mode and permission changes reload without logging out',async()=>{
 const f=sessionFixture();f.setProfile({tenant_id:'own-house',role:'admin',status:'active',is_co_admin:true,permissoes:{inventory:'visualizar'}});
 assert.equal(await f.api.connectPreview(),true);f.advance(60_001);for(const fn of f.visibility)fn();await tick();
 assert.equal(f.api.previewSession().profile.role,'admin');assert.deepEqual(f.redirects,[]);
 assert.ok(f.calls.every(path=>path==='/api/pilot/interface-access?space=manager'));
 f.advance(60_001);f.setProfile({tenant_id:'own-house',role:'admin',status:'active',is_co_admin:true,permissoes:{inventory:'gerenciar'}});for(const fn of f.timers)fn();await tick();
 assert.deepEqual(f.redirects,['/dashboard?space=manager']);
});

test('gate remounts and concurrent readers reuse a fresh resource; expiry and explicit refresh read again',async()=>{
  const f=runtimeFixture();let reads=0;f.api.registerLoader('qa',async()=>{reads++;f.api.publishValue('qa',{real:true});});
  await Promise.all([f.api.loadResource('qa'),f.api.loadResource('qa')]);assert.equal(reads,1);assert.equal(f.gate('qa'),'AUTHORIZED DATA');f.effects.pop()!();await tick();assert.equal(reads,1);
  f.advance(29_999);await f.api.loadResource('qa');assert.equal(reads,1);await f.api.refreshResource('qa');assert.equal(reads,2);
  f.advance(30_000);f.gate('qa');f.effects.pop()!();await tick();assert.equal(reads,3);
});

test('finance publishes only full snapshots; failed refresh hides stale values and retry recovers',async()=>{
  const f=runtimeFixture(),members=deferred(),ledger=deferred();const started:string[]=[];
  f.setRequest(()=>{started.push('members');return members.promise;});f.setFinance(()=>{started.push('finance');return ledger.promise;});
  const pending=f.api.loadResource('finance');await tick();assert.deepEqual(started.sort(),['finance','members']);ledger.resolve([{id:'debt'}]);await tick();assert.equal(f.api.readValue('mapped'),undefined);assert.match(f.gate('financial'),/axe-loading/);
  members.resolve({data:[{id:'person'}]});await pending;assert.equal(f.api.readValue('mapped').people[0].id,'person');assert.equal(f.status('finance').ready,true);
  const refresh=deferred();f.setFinance(()=>refresh.promise);const updating=f.api.refreshResource('finance');await tick();assert.equal(f.status('finance').loading,true);assert.equal(f.api.readValue('mapped').rows[0].id,'debt');
  f.setFinance(async()=>{throw Error('Ledger incomplete');});refresh.resolve([{id:'debt-updated'}]);await updating;
  await assert.rejects(f.api.refreshResource('finance'),/Ledger incomplete/);assert.equal(f.status('finance').ready,false);assert.match(f.gate('financial'),/Não foi possível carregar/);
  f.setFinance(async()=>[{id:'verified'}]);await f.api.refreshResource('finance');assert.equal(f.api.readValue('mapped').rows[0].id,'verified');
});

test('account fallback starts independent status and configuration reads together',async()=>{
  const f=runtimeFixture(),status=deferred(),config=deferred(),started:string[]=[];
  f.setRequest((url:string)=>{started.push(url);return url.endsWith('/status')?status.promise:config.promise;});const pending=f.api.loadResource('account');await tick();assert.deepEqual(started.sort(),['/api/whatsapp/config','/api/whatsapp/status']);assert.equal(f.api.readValue('account'),undefined);
  config.resolve({preferences:{}});status.resolve({status:'CONNECTED'});await pending;assert.equal(f.api.readValue('account').whatsapp.connected,true);
});

test('refresh after a mutation waits for a new snapshot instead of confirming a read started before it',async()=>{
  const f=runtimeFixture(),old=deferred(),updated=deferred();let reads=0;
  f.api.registerLoader('qa',async()=>{reads++;const snapshot=await (reads===1?old.promise:updated.promise);f.api.publishValue('qa',snapshot);});
  const initial=f.api.loadResource('qa');await tick();const first=f.api.refreshResource('qa'),second=f.api.refreshResource('qa');let confirmed=false;void first.then(()=>{confirmed=true;});
  old.resolve({revision:'before-mutation'});await initial;await tick();assert.equal(reads,2);assert.equal(confirmed,false);assert.equal(f.status('qa').loading,true);
  updated.resolve({revision:'after-mutation'});await Promise.all([first,second]);assert.equal(reads,2);assert.equal(f.api.readValue('qa').revision,'after-mutation');assert.equal(f.status('qa').ready,true);
});

test('a later mutation during the queued read gets its own subsequent snapshot',async()=>{
  const f=runtimeFixture(),snapshots=[deferred(),deferred(),deferred()];let reads=0;
  f.api.registerLoader('qa',async()=>{const value=await snapshots[reads++].promise;f.api.publishValue('qa',value);});
  const initial=f.api.loadResource('qa');await tick();const first=f.api.refreshResource('qa');snapshots[0].resolve('old');await initial;await tick();assert.equal(reads,2);
  const later=f.api.refreshResource('qa'),dependent=f.api.ensureResource('qa');const firstResult=first.catch(()=>{});snapshots[1].resolve('first-mutation');await tick();assert.equal(reads,3);
  snapshots[2].resolve('second-mutation');await Promise.all([firstResult,later,dependent]);assert.equal(f.api.readValue('qa'),'second-mutation');assert.equal(f.status('qa').ready,true);
});
