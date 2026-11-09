import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{signedCookie,validCookie} from '../cloudflare/pilot-interface-worker.js';
import {isManagerIdentity,isPilotManager,PILOT_TENANT,PILOT_EMAIL} from '../cloudflare/pilot-interface-policy.js';
import {requirePilotOperationAccess} from '../cloudflare/pilot-operation-access.js';
import {storeImagePath} from '../lib/storeImageReference';
const user={id:PILOT_TENANT,email:PILOT_EMAIL};
const profile={tenant_id:PILOT_TENANT,role:'admin',status:'active'};
const OTHER_MANAGER_ID='11111111-1111-4111-8111-111111111111';
const otherManager={id:OTHER_MANAGER_ID,email:'outro-zelador@example.invalid'};
const otherManagerProfile={tenant_id:OTHER_MANAGER_ID,role:'admin',status:'active'};

test('declared Portuguese financial aliases redirect to the authorized dashboard without serving pilot assets',async()=>{
 for(const path of ['/financeiro','/mensalidades','/financeiro/?source=notice']){
  const response=await worker.fetch(new Request('https://axecloud.com.br'+path),{});
  assert.equal(response.status,301);const target=new URL(response.headers.get('Location')!);
  assert.equal(target.pathname,'/dashboard');assert.equal(target.searchParams.get('tab'),'financial');
  if(path.includes('source'))assert.equal(target.searchParams.get('source'),'notice');
 }
 assert.equal((await worker.fetch(new Request('https://axecloud.com.br/financeiro',{method:'POST'}),{})).status,405);
});
test('pilot requires authenticated owner id, exact email and matching tenant together',()=>{assert.equal(isPilotManager(user,profile),true);for(const [u,p] of [[{...user,id:'other'},profile],[{...user,email:'other@example.invalid'},profile],[user,{...profile,tenant_id:'other'}],[user,{...profile,role:'filho'}],[user,{...profile,status:'blocked'}],[null,profile]])assert.equal(isPilotManager(u,p),false);});
test('manager rollout accepts only a valid manager bound to the same tenant',()=>{
 assert.equal(isPilotManager(otherManager,otherManagerProfile),false);
 assert.equal(isManagerIdentity(otherManager,otherManagerProfile),true);
 assert.equal(isPilotManager(otherManager,otherManagerProfile,'managers'),true);
 for(const invalidProfile of [
  {...otherManagerProfile,tenant_id:PILOT_TENANT},
  {...otherManagerProfile,role:'filho'},
  {...otherManagerProfile,status:'blocked'},
  {...otherManagerProfile,status:'deleted'},
 ])assert.equal(isPilotManager(otherManager,invalidProfile,'managers'),false);
});
test('cookie cannot be forged, moved to a different key or kept past expiry',async()=>{const secret='test-only-key-never-deployed',now=Date.now(),value=await signedCookie(secret,now);assert.equal(await validCookie(value,secret,now),true);assert.equal(await validCookie(value+'a',secret,now),false);assert.equal(await validCookie(value,'other-secret',now),false);assert.equal(await validCookie(value,secret,now+3600001),false);assert.equal(await validCookie('',secret,now),false);});
test('a non-pilot manager cookie stays disabled until manager rollout is explicitly enabled',async()=>{
 const secret='test-only-key-never-deployed',now=Date.now();
 const value=await signedCookie(secret,OTHER_MANAGER_ID,now);
 assert.equal(await validCookie(value,secret,now),false);
 assert.equal(await validCookie(value,secret,now,'managers'),true);
 assert.equal(await validCookie(await signedCookie(secret,'not-a-uuid',now),secret,now,'managers'),false);
});
test('ordinary accounts and query flags cannot receive modern HTML; only the harmless version manifest stays readable',async()=>{let legacy=0,modern=0;const env={PILOT_COOKIE_SECRET:'test-only-secret',CURRENT_APP:{fetch:async()=>{legacy++;return new Response('legacy',{headers:{'content-type':'text/plain'}});}},ASSETS:{fetch:async(request:Request)=>{modern++;return new URL(request.url).pathname==='/pilot-version.json'?Response.json({buildId:'pilot-test'}):new Response('modern');}}};for(const query of ['', '?interface=modern','?pilot=1'])assert.equal(await(await worker.fetch(new Request('https://axecloud.com.br/dashboard'+query),env)).text(),'legacy');assert.equal(modern,0);assert.equal(legacy,3);const response=await worker.fetch(new Request('https://axecloud.com.br/assets/pilot-20261101/assets/main.js'),env);assert.equal(response.status,403);const version=await worker.fetch(new Request('https://axecloud.com.br/assets/pilot-20261101/pilot-version.json'),env);assert.equal(version.status,200);assert.equal((await version.json()).buildId,'pilot-test');assert.equal(modern,1);});
test('signed pilot cookie selects only modern dashboard and keeps an explicit classic fallback',async()=>{const secret='test-only-secret';const env={PILOT_COOKIE_SECRET:secret,CURRENT_APP:{fetch:async()=>new Response('legacy')},ASSETS:{fetch:async()=>new Response('modern')}};const headers={Cookie:'__Host-axecloud-pilot='+await signedCookie(secret)};assert.equal(await(await worker.fetch(new Request('https://axecloud.com.br/dashboard',{headers}),env)).text(),'modern');assert.equal(await(await worker.fetch(new Request('https://axecloud.com.br/dashboard?classic=1',{headers}),env)).text(),'legacy');});
test('pilot endpoint rejects absent bearer and cross-origin calls before contacting services',async()=>{const endpoint='https://axecloud.com.br/api/pilot/interface-access';assert.equal((await worker.fetch(new Request(endpoint,{method:'POST',headers:{Origin:'https://axecloud.com.br'}}),{})).status,401);assert.equal((await worker.fetch(new Request(endpoint,{method:'POST',headers:{Origin:'https://other.invalid',Authorization:'Bearer arbitrary'}}),{})).status,403);});
test('private shop photos persist durable paths without leaking expiring tokens or importing unrelated URLs',()=>{const path=PILOT_TENANT+'/produtos/foto.png';assert.equal(storeImagePath('https://vlaojhfwhqmwudqsumpi.supabase.co/storage/v1/object/public/loja_imagens/'+path),path);assert.equal(storeImagePath('https://vlaojhfwhqmwudqsumpi.supabase.co/storage/v1/object/sign/loja_imagens/'+path+'?token=temporary'),path);assert.equal(storeImagePath(path),path);assert.equal(storeImagePath('https://other.invalid/image.png'),null);});
test('access endpoint signs a cookie only after auth service and tenant service both authorize the exact pilot',async t=>{
 let identity={...user},house={...profile},profileCalls=0;
 t.mock.method(globalThis,'fetch',async()=>Response.json(identity));
 const env={PILOT_COOKIE_SECRET:'test-only-secret',API:{fetch:async(input:any)=>{const url=typeof input==='string'?input:input.url;if(url.includes('public-config'))return Response.json({supabaseUrl:'https://vlaojhfwhqmwudqsumpi.supabase.co',supabaseAnonKey:'test-public-key'});profileCalls++;return Response.json(house);}}};
 const post=()=>worker.fetch(new Request('https://axecloud.com.br/api/pilot/interface-access',{method:'POST',headers:{Origin:'https://axecloud.com.br',Authorization:'Bearer mocked-verified-by-auth-service'}}),env);
 let response=await post();assert.equal((await response.json()).enabled,true);assert.match(response.headers.get('set-cookie')||'',/HttpOnly; Secure; SameSite=Lax/);
 identity={...user,id:'other-account'};profileCalls=0;response=await post();assert.equal((await response.json()).enabled,false);assert.equal(profileCalls,0);assert.match(response.headers.get('set-cookie')||'',/Max-Age=0/);
 identity={...user};house={...profile,tenant_id:'another-house'};response=await post();assert.equal((await response.json()).enabled,false);assert.match(response.headers.get('set-cookie')||'',/Max-Age=0/);
});

test('manager rollout endpoint authorizes another valid manager but rejects member and tenant mismatch',async t=>{
 let identity={...otherManager},house={...otherManagerProfile};
 t.mock.method(globalThis,'fetch',async()=>Response.json(identity));
 const env={INTERFACE_ROLLOUT_MODE:'managers',PILOT_COOKIE_SECRET:'test-only-secret',API:{fetch:async(input:any)=>{
  const url=typeof input==='string'?input:input.url;
  if(url.includes('public-config'))return Response.json({supabaseUrl:'https://vlaojhfwhqmwudqsumpi.supabase.co',supabaseAnonKey:'test-public-key'});
  return Response.json(house);
 }}};
 const post=()=>worker.fetch(new Request('https://axecloud.com.br/api/pilot/interface-access',{method:'POST',headers:{Origin:'https://axecloud.com.br',Authorization:'Bearer mocked-verified-by-auth-service'}}),env);
 let response=await post();
 assert.equal((await response.json()).enabled,true);
 const cookie=response.headers.get('set-cookie')||'';
 assert.match(cookie,/__Host-axecloud-pilot=/);
 assert.equal(await validCookie(cookie.match(/__Host-axecloud-pilot=([^;]+)/)?.[1]||'',env.PILOT_COOKIE_SECRET,Date.now(),'managers'),true);

 house={...otherManagerProfile,role:'filho'};
 response=await post();assert.equal((await response.json()).enabled,false);
 house={...otherManagerProfile,tenant_id:PILOT_TENANT,role:'admin'};
 response=await post();assert.equal((await response.json()).enabled,false);
 identity={...otherManager,id:'not-a-uuid'};house={tenant_id:'not-a-uuid',role:'admin',status:'active'};
 response=await post();assert.equal((await response.json()).enabled,false);
});

test('operation authorization remains pilot-only by default and becomes tenant-bound in manager rollout',async()=>{
 let house={...otherManagerProfile};
 const api={fetch:async(input:any)=>{
  const url=new URL(typeof input==='string'?input:input.url);
  if(url.pathname==='/api/public-config')return Response.json({supabaseUrl:'https://supabase.example.invalid',supabaseAnonKey:'test-public-key'});
  if(url.pathname==='/api/tenant-info')return Response.json(house);
  throw Error('Unexpected API route: '+url.pathname);
 }};
 const fetcher=async()=>Response.json(otherManager);
 const request=(tenant=OTHER_MANAGER_ID)=>new Request('https://axecloud.com.br/api/pilot/library/materials?tenantId='+tenant,{headers:{Authorization:'Bearer operation-fixture'}});
 await assert.rejects(()=>requirePilotOperationAccess(request(),{API:api},fetcher),/Acesso negado/);
 await assert.rejects(()=>requirePilotOperationAccess(request(),{API:api,INTERFACE_ROLLOUT_MODE:'managers'},fetcher),/Acesso negado/);
 const access=await requirePilotOperationAccess(request(),{API:api,PILOT_OPERATION_ROLLOUT_MODE:'managers'},fetcher);
 assert.equal(access.manager,true);assert.equal(access.tenantId,OTHER_MANAGER_ID);assert.equal(access.rollout,'managers');
 await assert.rejects(()=>requirePilotOperationAccess(request(PILOT_TENANT),{API:api,PILOT_OPERATION_ROLLOUT_MODE:'managers'},fetcher),/Acesso negado/);
 house={...otherManagerProfile,role:'filho'};
 await assert.rejects(()=>requirePilotOperationAccess(request(),{API:api,PILOT_OPERATION_ROLLOUT_MODE:'managers'},fetcher),/não concedeu permissão/);
});

test('pilot routes dispatch notices and radar to their secure handlers', async () => {
  const env = { PILOT_COOKIE_SECRET: 'test-only-secret', API: { fetch: async () => new Response('{}') } };
  const noticesResponse = await worker.fetch(new Request('https://axecloud.com.br/api/pilot/notices', { method: 'POST', body: '{}' }), env);
  assert.equal(noticesResponse.status, 401);
  const radarResponse = await worker.fetch(new Request('https://axecloud.com.br/api/pilot/radar', { method: 'PUT', body: '{}' }), env);
  assert.equal(radarResponse.status, 401);
});

test('version check uses authenticated account access and refresh clears only cached assets',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json(user));
 const env={
  PILOT_COOKIE_SECRET:'test-only-secret',
  API:{fetch:async(input:any)=>{const url=new URL(typeof input==='string'?input:input.url);if(url.pathname==='/api/public-config')return Response.json({supabaseUrl:'https://supabase.example.invalid',supabaseAnonKey:'test-public-key'});if(url.pathname==='/api/tenant-info')return Response.json(profile);throw Error('Unexpected API route: '+url.pathname);}},
  ASSETS:{fetch:async(request:Request)=>{assert.equal(new URL(request.url).pathname,'/pilot-version.json');return Response.json({buildId:'pilot-new'});}},
 };
 const endpoint='https://axecloud.com.br/api/pilot/version';
 assert.equal((await worker.fetch(new Request(endpoint),env)).status,401);
 const version=await worker.fetch(new Request(endpoint,{headers:{Authorization:'Bearer current-session'}}),env);
 assert.equal(version.status,200);assert.equal((await version.json()).buildId,'pilot-new');assert.match(version.headers.get('cache-control')||'',/no-store/);
 const refresh=await worker.fetch(new Request('https://axecloud.com.br/api/pilot/refresh',{method:'POST',headers:{Origin:'https://axecloud.com.br',Authorization:'Bearer current-session'}}),env);
 assert.equal(refresh.status,200);assert.equal(refresh.headers.get('clear-site-data'),'"cache"');
});

test('pilot response contains CSP allowing Cloudflare Web Analytics and Efí',async()=>{
 const secret='test-only-secret';
 const env={PILOT_COOKIE_SECRET:secret,ASSETS:{fetch:async()=>new Response('modern')}};
 const headers={Cookie:'__Host-axecloud-pilot='+await signedCookie(secret)};
 const response=await worker.fetch(new Request('https://axecloud.com.br/dashboard',{headers}),env);
 assert.equal(response.status,200);
 const csp=response.headers.get('content-security-policy')||'';
 assert.match(csp,/static\.cloudflareinsights\.com/);
 assert.match(csp,/https:\/\/cloudflareinsights\.com/);
});
