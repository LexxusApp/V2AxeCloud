import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import worker,{signedCookie,validCookie} from '../cloudflare/pilot-interface-worker.js';
import {PILOT_TENANT,PILOT_EMAIL,isPilotManager,PILOT_PREFIX} from '../cloudflare/pilot-interface-policy.js';
import {MEMBER_PILOT,MEMBER_PREFIX,isPilotMember} from '../cloudflare/member-pilot-policy.js';
import {signedMemberCookie,validMemberCookie} from '../cloudflare/member-pilot-cookie.js';
import {handlePilotLibrary} from '../cloudflare/pilot-library.js';
import {handlePilotSupport} from '../cloudflare/pilot-support.js';
import {registerLibraryRoutes} from '../api/lib/libraryRoutes';
import {registerCantinaRoutes} from '../api/lib/cantinaRoutes';
import {resolveTenantAccessForUser} from '../api/lib/tenantAccess';
import {pilotBootstrap} from '../cloudflare/pilot-bootstrap.js';

// Everything below is in memory. No listener, HTTP client or production client is created.
const ORIGIN='https://axecloud.com.br';
const OTHER='10000000-0000-4000-8000-000000000099';
const PDF_ID='20000000-0000-4000-8000-000000000001';
const PEER='20000000-0000-4000-8000-000000000002';
const PATH=PILOT_TENANT+'/private/'+PDF_ID+'.pdf';
const SECRET='audit-fixture-only-not-a-deployed-key';
const OWNER={id:PILOT_TENANT,email:PILOT_EMAIL};
const PROFILE={tenant_id:PILOT_TENANT,role:'admin',status:'active'};
const MEMBER={id:MEMBER_PILOT.memberId,user_id:MEMBER_PILOT.userId,tenant_id:PILOT_TENANT,email:MEMBER_PILOT.email,status:'Ativo'};
const publicConfig={supabaseUrl:'https://audit.invalid',supabaseAnonKey:'fixture-public-key'};
const request=(path:string,method='GET',body?:unknown)=>new Request(ORIGIN+path,{method,headers:{Origin:ORIGIN,Authorization:'Bearer audit-synthetic-session','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
beforeEach(t=>{t.mock.method(globalThis,'fetch',async()=>{throw Error('Network is forbidden in the isolation audit');});});

function edgeFixture(identity:any=OWNER,profile:any=PROFILE,member:any=MEMBER){
 const calls:{path:string;method:string;query:URLSearchParams}[]=[];
 const api={fetch:async(input:any)=>{
  const url=new URL(typeof input==='string'?input:input.url);calls.push({path:url.pathname,method:input.method||'GET',query:url.searchParams});
  if(url.pathname==='/api/public-config')return Response.json(publicConfig);
  if(url.pathname==='/api/tenant-info')return Response.json(profile);
  if(url.pathname==='/api/v1/filho/profile')return Response.json({data:member});
  if(url.pathname==='/api/v1/library/materials')return Response.json({data:[]});
  if(url.pathname==='/api/v1/library/pdf-proxy')return Response.json({error:'denied by legacy handler'},{status:403});
  throw Error('Unexpected service call: '+url.pathname);
 }};
 const fetcher=async(input:any,init:any={})=>{
  const url=new URL(String(input));calls.push({path:url.pathname,method:init.method||'GET',query:url.searchParams});
  if(url.pathname==='/auth/v1/user')return Response.json(identity);
  // These reads model the actual owner-ID predicates in the checked-in RLS.
  if(url.pathname==='/rest/v1/piloto_suporte_chamados')return Response.json(identity.id===PILOT_TENANT?[{id:PDF_ID,tenant_id:PILOT_TENANT,dados:{subject:'Fixture history'},status:'open',envio_estado:'confirmed',created_at:'2026-11-03T12:00:00Z'}]:[]);
  if(url.pathname==='/rest/v1/piloto_suporte_complementos')return Response.json([]);
  if(url.pathname==='/rest/v1/piloto_biblioteca_privada')return Response.json(identity.id===PILOT_TENANT?[{id:PDF_ID,tenant_id:PILOT_TENANT,destinatario:MEMBER_PILOT.memberId,storage_path:PATH,titulo:'Fixture private PDF'}]:[]);
  if(url.pathname.startsWith('/storage/v1/object/'))return new Response('%PDF-1.4\nprivate fixture');
  throw Error('Unexpected mocked fetch: '+url.pathname);
 };
 return {env:{PILOT_COOKIE_SECRET:SECRET,API:api},fetcher,calls};
}

test('audit: auth+tenant+email+member binding are all required before issuing either cookie',async t=>{
 for(const [identity,profile,member] of [
  [{...OWNER,id:OTHER},PROFILE,MEMBER],
  [{...OWNER,email:'changed@example.invalid'},PROFILE,MEMBER],
  [OWNER,{...PROFILE,tenant_id:OTHER},MEMBER],
  [OWNER,{...PROFILE,status:'blocked'},MEMBER],
  [OWNER,{...PROFILE,role:'filho'},MEMBER],
  [{id:MEMBER_PILOT.userId,email:MEMBER_PILOT.authEmail},{tenant_id:PILOT_TENANT,role:'filho'},{...MEMBER,user_id:OTHER}],
  [{id:MEMBER_PILOT.userId,email:MEMBER_PILOT.email},{tenant_id:OTHER,role:'filho'},MEMBER],
  [{id:MEMBER_PILOT.userId,email:MEMBER_PILOT.email},{tenant_id:PILOT_TENANT,role:'filho'},{...MEMBER,status:'Inativo'}],
 ] as any[]){
  const f=edgeFixture(identity,profile,member);const mock=t.mock.method(globalThis,'fetch',f.fetcher as any);
  const response=await worker.fetch(request('/api/pilot/interface-access','POST'),f.env);
  assert.equal((await response.json()).enabled,false);assert.match(response.headers.get('set-cookie')||'',/Max-Age=0/);mock.mock.restore();
 }
});

test('audit: valid member session receives only the member cookie and exact returned binding',async t=>{
 const identity={id:MEMBER_PILOT.userId,email:MEMBER_PILOT.authEmail};const f=edgeFixture(identity,{tenant_id:PILOT_TENANT,role:'filho'},MEMBER);
 t.mock.method(globalThis,'fetch',f.fetcher as any);
 const response=await worker.fetch(request('/api/pilot/interface-access','POST'),f.env),body=await response.json();
 assert.equal(body.enabled,true);assert.equal(body.interface,'member');assert.equal(body.memberId,MEMBER_PILOT.memberId);
 assert.match(response.headers.get('set-cookie')||'',/__Host-axecloud-member-pilot=.+HttpOnly; Secure; SameSite=Lax/);
 assert.match(response.headers.get('set-cookie')||'',/__Host-axecloud-pilot=;[^,]*Max-Age=0/);
 assert.equal(isPilotMember(identity,body.profile,body.member),true);
});

test('audit: unavailable auth/profile cannot issue a positive cookie',async t=>{
 const f=edgeFixture();t.mock.method(globalThis,'fetch',async()=>new Response('',{status:503}));
 let response=await worker.fetch(request('/api/pilot/interface-access','POST'),f.env);assert.equal((await response.json()).enabled,false);
 t.mock.restoreAll();t.mock.method(globalThis,'fetch',f.fetcher as any);
 f.env.API.fetch=async(input:any)=>String(typeof input==='string'?input:input.url).includes('public-config')?Response.json(publicConfig):new Response('',{status:503});
 response=await worker.fetch(request('/api/pilot/interface-access','POST'),f.env);assert.equal(response.status,503);assert.equal((await response.json()).enabled,false);
});

test('audit: signed cookie roles cannot be interchanged or extended past their one-hour lifetime',async()=>{
 const now=Date.now(),manager=await signedCookie(SECRET,now),member=await signedMemberCookie(SECRET,now);
 assert.equal(await validCookie(member,SECRET,now),false);assert.equal(await validMemberCookie(manager,SECRET,now),false);
 for(const [value,verify] of [[manager,validCookie],[member,validMemberCookie]] as const){
  assert.equal(await verify(value,SECRET,now),true);assert.equal(await verify(value,SECRET,now+3600000),false);
  assert.equal(await verify(value,SECRET+'wrong',now),false);assert.equal(await verify(value+'tampered',SECRET,now),false);
 }
});

test('audit: wrong-role cookies and public flags cannot cross the two asset prefixes; old assets stay on CURRENT_APP',async()=>{
 const paths:string[]=[],env={PILOT_COOKIE_SECRET:SECRET,ASSETS:{fetch:async(input:Request)=>{paths.push('pilot:'+new URL(input.url).pathname);return new Response('pilot');}},CURRENT_APP:{fetch:async(input:Request)=>{paths.push('current:'+new URL(input.url).pathname);return new Response('old asset',{headers:{'Content-Type':'application/javascript','Cache-Control':'public, max-age=31536000, immutable'}});}}};
 const manager='__Host-axecloud-pilot='+await signedCookie(SECRET),member='__Host-axecloud-member-pilot='+await signedMemberCookie(SECRET);
 for(const [prefix,cookie] of [[PILOT_PREFIX,member],[MEMBER_PREFIX,manager],[PILOT_PREFIX,''],[MEMBER_PREFIX,'']]){
  assert.equal((await worker.fetch(new Request(ORIGIN+prefix+'assets/main.js?pilot=1',{headers:{Cookie:cookie}}),env)).status,403);
 }
 assert.deepEqual(paths,[]);
 const old=await worker.fetch(new Request(ORIGIN+'/assets/old-hash.js',{headers:{Cookie:manager}}),env);
 assert.equal(await old.text(),'old asset');assert.equal(old.headers.get('cache-control'),'public, max-age=31536000, immutable');assert.deepEqual(paths,['current:/assets/old-hash.js']);
 const response=await worker.fetch(new Request(ORIGIN+'/dashboard',{headers:{Cookie:member}}),env);assert.equal(response.headers.get('x-axecloud-interface'),'member-pilot');assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(paths.at(-1),'pilot:/member/index.html');
});

test('audit: cookies alone do not authorize library or support, and foreign tenant query stops before private reads',async()=>{
 for(const handler of [handlePilotLibrary,handlePilotSupport]){
  const path=handler===handlePilotLibrary?'/api/pilot/library/materials':'/api/pilot/support';const f=edgeFixture();
  const anonymous=await handler(new Request(ORIGIN+path,{headers:{Cookie:'__Host-axecloud-pilot='+await signedCookie(SECRET)}}),f.env,f.fetcher);assert.equal(anonymous.status,401);assert.equal(f.calls.length,0);
  assert.equal((await handler(request(path+'?tenantId='+OTHER),f.env,f.fetcher)).status,403);
  assert.equal(f.calls.some(call=>call.path.startsWith('/rest/')&&call.path!=='/rest/v1/piloto_coadministradores'),false);
 }
});

test('audit: member cannot mutate private PDFs or access manager support, even with manager cookie',async()=>{
 const f=edgeFixture({id:MEMBER_PILOT.userId,email:MEMBER_PILOT.email});
 for(const [path,method] of [['/api/pilot/library/private','POST'],['/api/pilot/library/private/'+PDF_ID,'DELETE'],['/api/pilot/support','GET']]){
  const input=request(path,method);input.headers.set('Cookie','__Host-axecloud-pilot='+await signedCookie(SECRET));
  const response=await (path.includes('library')?handlePilotLibrary:handlePilotSupport)(input,f.env,f.fetcher);assert.equal(response.status,403);
 }
 assert.equal(f.calls.some(call=>call.path.startsWith('/rest/')&&call.path!=='/rest/v1/piloto_coadministradores'),false);
});

test('audit: RLS-empty private PDF lookup never reads Storage; foreign prefix is delegated to legacy authorization',async()=>{
 const f=edgeFixture({id:MEMBER_PILOT.userId,email:MEMBER_PILOT.email},{tenant_id:PILOT_TENANT,role:'filho'},MEMBER);
 const response=await handlePilotLibrary(request('/api/pilot/library/pdf-proxy?path='+encodeURIComponent(PATH)),f.env,f.fetcher);assert.equal(response.status,403);assert.equal(f.calls.some(call=>call.path.startsWith('/storage/')),false);
 const foreign=await handlePilotLibrary(request('/api/pilot/library/pdf-proxy?tenantId='+PILOT_TENANT+'&path='+encodeURIComponent(OTHER+'/private/'+PDF_ID+'.pdf')),f.env,f.fetcher);assert.equal(foreign.status,403);assert.equal(f.calls.some(call=>call.path==='/api/v1/library/pdf-proxy'),true);
});

test('audit: revoked manager email is denied interface, support and private PDF access',async t=>{
 const revoked={...OWNER,email:'changed@example.invalid'},f=edgeFixture(revoked);t.mock.method(globalThis,'fetch',f.fetcher as any);
 assert.equal(isPilotManager(revoked,PROFILE),false);
 const gate=await worker.fetch(request('/api/pilot/interface-access','POST'),f.env);assert.equal((await gate.json()).enabled,false);
 const support=await handlePilotSupport(request('/api/pilot/support'),f.env,f.fetcher);assert.equal(support.status,403);
 const pdf=await handlePilotLibrary(request('/api/pilot/library/pdf-proxy?path='+encodeURIComponent(PATH)),f.env,f.fetcher);assert.equal(pdf.status,403);
 assert.equal(f.calls.some(call=>call.path.startsWith('/storage/')),false);
});

// Invoke real registered handlers directly; mutations below affect fixture arrays only.
function routeFixture(actor:any=OWNER,phantom=false){
 const tables:Record<string,any[]>={
  perfil_lider:[{id:PILOT_TENANT,tenant_id:PILOT_TENANT,is_admin_global:false},{id:OTHER,tenant_id:OTHER,is_admin_global:false},...(phantom?[{id:MEMBER_PILOT.userId,tenant_id:PILOT_TENANT,is_admin_global:false}]:[])],
  filhos_de_santo:[{...MEMBER,lider_id:PILOT_TENANT,nome:'Fixture member'}, {id:PEER,tenant_id:PILOT_TENANT,lider_id:PILOT_TENANT,nome:'Fixture peer',limite_lojinha:100}, {id:OTHER,user_id:OTHER,tenant_id:OTHER,lider_id:OTHER}],
  financeiro:[{id:PDF_ID,tenant_id:PILOT_TENANT,lider_id:PILOT_TENANT,filho_id:PEER,categoria:'Cantina',status:'pendente',valor:10,data:'2026-11-03',created_at:'2026-11-03T12:00:00Z'}],produtos:[],
  cantina_cardapio:[{id:PDF_ID,tenant_id:PILOT_TENANT,nome:'Fixture coffee',preco:2,ativo:true,updated_at:'v1'},{id:OTHER,tenant_id:OTHER,nome:'Other house item',preco:9,ativo:true,updated_at:'v1'}],
  biblioteca:[{id:PDF_ID,tenant_id:OTHER,storage_path:OTHER+'/other.pdf',visibilidade:'casa'}],
 };
 const effects:{table:string;kind:string;ids:any[]}[]=[],storageCalls:string[]=[],rpcCalls:any[]=[],routes=new Map<string,any>();
 const sb:any={auth:{getUser:async()=>({data:{user:actor},error:null})},from:(table:string)=>{
  let rows=[...(tables[table]||[])],update:any,remove=false;
  const finish=()=>{if(update){rows.forEach(row=>Object.assign(row,update));effects.push({table,kind:'update',ids:rows.map(row=>row.id)});}if(remove){tables[table]=tables[table].filter(row=>!rows.includes(row));effects.push({table,kind:'delete',ids:rows.map(row=>row.id)});}return {data:structuredClone(rows),error:null};};
  const single=async()=>{const result=finish();return {...result,data:result.data[0]||null};};
  const q:any={select:()=>q,order:()=>q,eq:(key:string,value:any)=>{rows=rows.filter(row=>row[key]===value);return q;},in:(key:string,values:any[])=>{rows=rows.filter(row=>values.includes(row[key]));return q;},or:(filter:string)=>{rows=rows.filter(row=>filter.split(',').some(clause=>{const[key,,value]=clause.split('.');return String(row[key])===value;}));return q;},range:(a:number,b:number)=>{rows=rows.slice(a,b+1);return q;},limit:(n:number)=>{rows=rows.slice(0,n);return q;},update:(data:any)=>{update=data;return q;},delete:()=>{remove=true;return q;},maybeSingle:single,single,then:(resolve:any,reject:any)=>Promise.resolve(finish()).then(resolve,reject)};return q;
 },storage:{from:()=>({remove:async()=>{storageCalls.push('remove');return {error:null};},download:async()=>{storageCalls.push('download');return {data:new Blob(['%PDF-']),error:null};}})},rpc:async(name:string,args:any)=>{rpcCalls.push({name,args});return {data:0,error:null};}};
 const app:any={};for(const method of ['get','post','patch','delete'])app[method]=(path:string,handler:any)=>routes.set(method.toUpperCase()+' '+path,handler);
 registerLibraryRoutes(app,{supabaseAdmin:sb,slugifyStoragePath:value=>value});registerCantinaRoutes(app,{supabaseAdmin:sb,resolveLeaderId:async value=>value});
 const invoke=async(method:string,path:string,{query={},body={},params={},anonymous=false}:any={})=>{
  const result:any={statusCode:200,body:null};const res:any={status:(status:number)=>{result.statusCode=status;return res;},json:(body:any)=>{result.body=body;return res;},send:(body:any)=>{result.body=body;return res;},set:()=>res,setHeader:()=>res};
  const req:any={headers:anonymous?{}:{authorization:'Bearer '+randomUUID()},query,body,params};const handler=routes.get(method+' '+path);assert.ok(handler,'Registered handler exists');await handler(req,res);return result;
 };
 return {sb,tables,effects,storageCalls,rpcCalls,invoke};
}

test('audit: real legacy PDF/delete routes reject foreign material IDs before touching Storage',async()=>{
 const f=routeFixture();
 let response=await f.invoke('DELETE','/api/v1/library/material/:id',{params:{id:PDF_ID},query:{tenantId:PILOT_TENANT}});assert.equal(response.statusCode,403);
 response=await f.invoke('GET','/api/v1/library/pdf-proxy',{query:{tenantId:PILOT_TENANT,path:OTHER+'/other.pdf'}});assert.equal(response.statusCode,403);
 assert.deepEqual(f.storageCalls,[]);assert.deepEqual(f.effects,[]);
});

test('audit: own tenant query cannot mutate foreign menu ID; member without stale leader profile cannot write',async()=>{
 const owner=routeFixture();const patch={tenantId:PILOT_TENANT,nome:'Attempted edit',preco:1,expectedUpdatedAt:'v1'};
 const response=await owner.invoke('PATCH','/api/v1/cantina/cardapio/:id',{params:{id:OTHER},body:patch});assert.equal(response.statusCode,409);assert.equal(owner.tables.cantina_cardapio[1].preco,9);
 const member=routeFixture({id:MEMBER_PILOT.userId,email:MEMBER_PILOT.authEmail});
 assert.equal((await member.invoke('PATCH','/api/v1/cantina/cardapio/:id',{params:{id:PDF_ID},body:patch})).statusCode,403);assert.deepEqual(member.effects,[]);
 assert.equal((await owner.invoke('GET','/api/v1/cantina/data',{query:{tenantId:OTHER,userRole:'admin'}})).statusCode,403);
});

test('audit: stale leader profile cannot expose peer debt or change peer credit limit',async()=>{
 const actor={id:MEMBER_PILOT.userId,email:MEMBER_PILOT.authEmail},f=routeFixture(actor,true);
 assert.equal((await resolveTenantAccessForUser(f.sb,actor.id,actor.email)).role,'filho');
 const list=await f.invoke('GET','/api/v1/cantina/data',{query:{tenantId:PILOT_TENANT,userRole:'filho'}});assert.equal(list.statusCode,403);
 const edit=await f.invoke('PATCH','/api/v1/cantina/limite',{body:{tenantId:PILOT_TENANT,filhoId:PEER,limite_lojinha:999,bloquear_fiado_loja:false}});assert.equal(edit.statusCode,403);assert.equal(f.tables.filhos_de_santo.find(row=>row.id===PEER).limite_lojinha,100);
 assert.equal(f.rpcCalls.length,0,'No permissive mock RPC is needed: real route directly updates the peer row');
});

function cantinaWriter(){
 const writers:Record<string,any>={},calls:any[]=[],values=new Map<string,any>(),exports={};
 const modules:Record<string,any>={
  './reminders':{sendAutomaticCantinaNotice:async()=>{throw Error('No notification expected');}},
  './runtime':{registerLoader:()=>{},registerWriter:(name:string,writer:any)=>writers[name]=writer,ensureResource:async()=>{},refreshResource:async(name:string)=>calls.push({refresh:name}),readValue:(name:string)=>values.get(name),publishValue:(name:string,value:any)=>values.set(name,value)},
  './session':{previewSession:()=>({tenantId:PILOT_TENANT,userId:PILOT_TENANT}),scoped:(value:string)=>value,request:async()=>{throw Error('Legacy API must not settle pilot books');}},
  '../../../src/lib/supabase':{supabase:{rpc:async(name:string,args:any)=>{calls.push({name,args});return {data:{memberId:args.p_filho,status:'pago',count:args.p_transacoes.length,ids:args.p_transacoes.map((row:any)=>row.id),totalCents:args.p_transacoes.reduce((sum:number,row:any)=>sum+Math.round(row.valor*100),0)},error:null};}}},
  './helpers':{checked:async(value:any)=>{const result=await value;if(result.error)throw Error(result.error.message);return result.data;}},
 };
 const source=ts.transpileModule(readFileSync('design-systems/menu-local-20261029/remote/cantina.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(source,{exports,require:(name:string)=>{assert.ok(name in modules,'Explicit mocked module: '+name);return modules[name];},crypto,Error,Map,Set,Promise});return {run:writers.cantina,calls,values};
}

function book(){const sale={id:PDF_ID,memberId:MEMBER_PILOT.memberId,lines:[{id:'line',name:'Coffee',cents:350,quantity:2}],settled:false,createdAt:1};return {products:[],cart:{},memberId:MEMBER_PILOT.memberId,sales:[sale],receipts:[]};}

test('audit: new pilot settlement sends only exact IDs/amounts to new RPC; no legacy liquidation',async()=>{
 const h=cantinaWriter(),before=book(),requestId=randomUUID();const after={...before,sales:before.sales.map(row=>({...row,settled:true})),receipts:[{id:'receipt-'+requestId,saleIds:[PDF_ID],cents:700}]};
 await h.run(after,before);const rpc=h.calls.find(call=>call.name);assert.equal(rpc.name,'piloto_liquidar_cantina');assert.equal(rpc.args.p_tenant,PILOT_TENANT);assert.equal(rpc.args.p_filho,MEMBER_PILOT.memberId);assert.equal(rpc.args.p_request,requestId);assert.equal(JSON.stringify(rpc.args.p_transacoes),JSON.stringify([{id:PDF_ID,valor:7}]));
});

test('audit: stale receipt IDs or amounts stop before any settlement RPC',async()=>{
 for(const receipt of [{id:'receipt-'+randomUUID(),saleIds:[OTHER],cents:700},{id:'receipt-'+randomUUID(),saleIds:[PDF_ID],cents:1},{id:'invalid',saleIds:[PDF_ID],cents:700}]){
  const h=cantinaWriter(),before=book();await assert.rejects(h.run({...before,sales:before.sales.map(row=>({...row,settled:true})),receipts:[receipt]},before));assert.equal(h.calls.length,0);
 }
});

test('audit: unsent cart draft is memory state and performs neither RPC nor API call',async()=>{
 const h=cantinaWriter(),before=book(),after={...before,cart:{coffee:2}};await h.run(after,before);assert.equal(h.calls.length,0);assert.equal(h.values.get('cantina'),after);
});

test('audit: forged local bootstrap hint only probes authorization; denied server response releases cover without reload',async()=>{
 let probes=0,reloads=0,removed=0;const nodes=new Map<string,any>();
 const document={head:{append(){}},documentElement:{append(){}},createElement:()=>({remove(){removed++;},querySelector:(id:string)=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}})};
 runInNewContext(pilotBootstrap([PILOT_TENANT,MEMBER_PILOT.userId]),{
  document,localStorage:{getItem:()=>JSON.stringify({access_token:'fixture-forged-local-hint',user:{id:PILOT_TENANT}})},location:{pathname:'/dashboard',search:'',reload(){reloads++;}},window:{addEventListener(){}},URLSearchParams,AbortController,
  setTimeout:()=>1,clearTimeout(){},setInterval(){},fetch:async()=>{probes++;return Response.json({enabled:false});},
 });
 await new Promise(resolve=>setImmediate(resolve));assert.equal(probes,1);assert.equal(reloads,0);assert.equal(removed,2);
});
