import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as pilotLogout from '../lib/pilotLogout';
import PageLoading from '../design-systems/shared/PageLoading';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DashboardResource} from '../design-systems/menu-local-20261029/DashboardResource';
import {loadingMarkup,loadingStyles} from '../cloudflare/pilot-loading.js';
import {fetchAllFinancialTransactions} from '../src/lib/financialTransactions';
import {isPilotMember,MEMBER_PILOT} from '../cloudflare/member-pilot-policy.js';
const require=createRequire(import.meta.url);
function load(file:string,deps:Record<string,unknown>={}){const exports:any={},source=readFileSync(file,'utf8'),code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;runInNewContext(code,{exports,require:(name:string)=>name.endsWith('.css')?{}:deps[name]??(name==='../../../lib/pilotLogout'?pilotLogout:name.endsWith('/shared/PageLoading')?{default:PageLoading}:require(name)),URL,Response,Request,Headers,Error,Date,Promise,AbortController,setInterval:()=>1,document:{visibilityState:'hidden',addEventListener(){}},location:{hostname:'axecloud.com.br',replace(){}},setTimeout,clearTimeout});return exports;}
const deferred=()=>{let resolve!:(value:any)=>void;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const profile={tenant_id:'house',role:'admin',status:'active',nome:'Casa autorizada'};
test('first paint is the panel structure, with no invented data, central loading card or fixed percentage',()=>{
 assert.match(loadingMarkup,/boot-sidebar/);assert.match(loadingMarkup,/boot-topbar/);assert.match(loadingMarkup,/aria-hidden="true"/);assert.doesNotMatch(loadingMarkup,/boot-card\b|R\$|aria-valuenow|[0-9]+%/);assert.match(loadingStyles,/prefers-reduced-motion/);
});
test('each verified dashboard card appears without waiting for unrelated integrations; failures do not look like zero',()=>{
 const states={members:{ready:true,loading:false,error:''},radar:{ready:false,loading:true,error:''}};
 let html=renderToStaticMarkup(createElement(DashboardResource,{states,resources:['members'],label:'Corrente',children:createElement('strong',null,'4 pessoas reais')}));assert.match(html,/4 pessoas reais/);
 html=renderToStaticMarkup(createElement(DashboardResource,{states,resources:['radar'],label:'Radar',children:createElement('strong',null,'0 visitas')}));assert.doesNotMatch(html,/0 visitas/);assert.match(html,/Carregando Radar/);
 html=renderToStaticMarkup(createElement(DashboardResource,{states:{radar:{ready:false,loading:false,error:'offline'}},resources:['radar'],label:'Radar',children:'0 visitas'}));assert.doesNotMatch(html,/0 visitas/);assert.match(html,/Tentar novamente/);
});
test('the actual dashboard shows verified people while finance and agenda are still pending, never fake empty states',()=>{
 const Dashboard=load('design-systems/menu-local-20261029/DashboardPage.tsx',{'./DashboardResource':{DashboardResource},'./giras':{nextGira:()=>undefined,DEMO_TODAY:'2026-11-02'}}).default;
 const resources=Object.fromEntries(['members','finance','giras','preceito','account','pix','dashboardRadar','dashboardWhatsApp'].map(key=>[key,{ready:key==='members',loading:key!=='members',error:''}]));
 const html=renderToStaticMarkup(createElement(Dashboard,{resources,members:[{id:'real',name:'Pessoa real',initials:'PR',color:'sage',paid:false,status:'Ativo',hasApp:true}],paid:[],preceito:false,giras:[],houseName:'Casa autorizada',live:{views7:0,whatsappClicks30:0,directoryClicks30:0,googleViews30:0,sent7:0,failed:0,setup:[],movements:[]},onNavigate(){},onPreceito(){},onNewMovement(){}}));
 assert.match(html,/Bem-vindo, Zelador/);assert.match(html,/1 com acesso/);assert.match(html,/Carregando Mensalidades/);assert.match(html,/Carregando Próxima gira/);assert.doesNotMatch(html,/nenhuma cobrança pendente|Nenhum encontro agendado|Sem data|Em dia|Mariana|Rafael/);
});
test('manager startup reuses the profile already authenticated by the gate rather than querying the house twice',async()=>{
 const calls:string[]=[];
 const api=load('design-systems/menu-local-20261029/remote/session.ts',{'../../../src/lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:'leader',email:'leader@example.invalid'}}}}),onAuthStateChange(){}}}},'../../../src/lib/authenticatedFetch':{authFetch:async(url:string)=>{calls.push(url);return Response.json({enabled:true,profile});}},'../uploadTransport':{}});
 assert.equal(await api.connectPreview(),true);assert.deepEqual(calls,['/api/pilot/interface-access?space=manager']);assert.equal(api.previewSession().profile.nome,profile.nome);
});
test('pilot repeats a failed read once, never repeats a financial write, and keeps access outages out of classic fallback',async()=>{
 let calls=0,status=200;
 const deps={'../../../src/lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:'leader'}}}}),onAuthStateChange(){}}}},'../../../src/lib/authenticatedFetch':{authFetch:async(url:string)=>{
   if(url.startsWith('/api/pilot/interface-access'))return Response.json({enabled:true,profile},{status});
   calls++;return calls===1?new Response('Temporary failure',{status:500}):Response.json({success:true});
 }},'../uploadTransport':{}};
 const api=load('design-systems/menu-local-20261029/remote/session.ts',deps);await api.connectPreview();
 assert.equal((await api.request('/api/inventory')).success,true);assert.equal(calls,2);
 calls=0;await assert.rejects(api.request('/api/transactions','POST',{}),/Confira o registro/);assert.equal(calls,1);
 status=500;await assert.rejects(api.connectPreview(),/temporariamente indisponível/);
});
test('member startup reuses only the server-verified exact member relationship and performs one access request',async()=>{
 const user={id:MEMBER_PILOT.userId,email:MEMBER_PILOT.authEmail},tenant={role:'filho',tenant_id:MEMBER_PILOT.tenantId},member={id:MEMBER_PILOT.memberId,user_id:user.id,tenant_id:tenant.tenant_id,email:MEMBER_PILOT.email,status:'Ativo'},calls:string[]=[];
 const api=load('design-systems/member-pilot-20261102/session.ts',{'../../src/lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user}}}),onAuthStateChange(){}}}},'../../src/lib/authenticatedFetch':{authFetch:async(url:string)=>{calls.push(url);return Response.json({enabled:true,interface:'member',profile:tenant,member});}},'../../cloudflare/member-pilot-policy.js':{isPilotMember}});
 assert.equal(await api.connectMember(new AbortController().signal),true);assert.deepEqual(calls,['/api/pilot/interface-access?space=member']);assert.equal(api.memberSession().member.id,member.id);
});
test('financial history starts concurrently with member reads, but mapping waits for both verified responses',async()=>{
 const members=deferred(),finance=deferred(),started:string[]=[];
 const api=load('design-systems/menu-local-20261029/remote/runtime.tsx',{'../../../src/lib/supabase':{},'./session':{previewSession:()=>({userId:'leader'}),scoped:(url:string)=>url,request:()=>{started.push('members');return members.promise;}},'./readModels':{memberFromServer:(row:any)=>row,financeFromServer:(rows:any,people:any)=>({mapped:{rows,people}})},'./financeRead':{readFinance:()=>{started.push('finance');return finance.promise;}},'../operations':{},'../../../cloudflare/pilot-granular-policy.js':{grantAllows:()=>false}});
 const pending=api.loadResource('finance');await Promise.resolve();await Promise.resolve();assert.deepEqual(started.sort(),['finance','members']);finance.resolve([{id:'real-debt'}]);await Promise.resolve();assert.equal(api.readValue('mapped'),undefined);members.resolve({data:[{id:'real-person'}]});await pending;assert.equal(api.readValue('mapped').people[0].id,'real-person');assert.equal(api.readValue('mapped').rows[0].id,'real-debt');
});
function financeFixture(body:any,status=200){let apiCalls=0,sweeps=0;const rows=[{id:'debt',valor:102}];const builder:any={select(){return this;},or(){return this;},order(){return this;},limit(){return this;},gt(){return this;},then(resolve:any){sweeps++;return Promise.resolve({data:rows,error:null}).then(resolve);}};const api=load('design-systems/menu-local-20261029/remote/financeRead.ts',{'../../../src/lib/supabase':{supabase:{from:()=>builder}},'./session':{previewSession:()=>({tenantId:'own-house'}),scoped:(url:string)=>url+'?tenantId=own-house&userRole=admin'},'../../../src/lib/authenticatedFetch':{authFetch:async()=>{apiCalls++;return Response.json(body,{status});}},'../../../src/lib/financialTransactions':{fetchAllFinancialTransactions}});return {api,calls:()=>apiCalls,sweeps:()=>sweeps};}
test('a complete versioned financial snapshot needs one authorized read, without duplicate database sweeps',async()=>{
 const f=financeFixture({data:[{id:'debt',valor:102}],offset:0,hasMore:false,ledgerRevision:'v1:2'});const rows=await f.api.readFinance();assert.equal(rows.length,1);assert.equal(f.calls(),1);assert.equal(f.sweeps(),0);
});
test('an older financial endpoint still requires the two consistent RLS snapshots, never a truncated balance',async()=>{
 const f=financeFixture({data:[{id:'debt',valor:102}]});await f.api.readFinance();assert.equal(f.calls(),1);assert.equal(f.sweeps(),2);
 const missing=financeFixture({data:[{id:'invisible'}]});await assert.rejects(missing.api.readFinance(),/permissões/);
 const denied=financeFixture({error:'Acesso negado'},403);await assert.rejects(denied.api.readFinance(),/extrato completo/);assert.equal(denied.sweeps(),0);
});
