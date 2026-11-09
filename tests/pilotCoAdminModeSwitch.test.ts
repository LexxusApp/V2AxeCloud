import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/pilot-interface-worker.js';
import {isPilotMember,MEMBER_PILOT} from '../cloudflare/member-pilot-policy.js';
import {validMemberCookie,MEMBER_COOKIE} from '../cloudflare/member-pilot-cookie.js';

const user={id:MEMBER_PILOT.userId,email:MEMBER_PILOT.authEmail};
const tenant={role:'admin',tenant_id:MEMBER_PILOT.tenantId,status:'active',is_co_admin:true};
const child={id:MEMBER_PILOT.memberId,user_id:user.id,tenant_id:MEMBER_PILOT.tenantId,email:MEMBER_PILOT.email,status:'Ativo'};
const secret='switch-test-private-secret';
const endpoint='https://axecloud.com.br/api/pilot/interface-access?space=';
const request=(space:string)=>new Request(endpoint+space,{method:'POST',headers:{Origin:'https://axecloud.com.br',Authorization:'Bearer verified-test-session'}});
test('co-admin can switch to member and back using distinct signed cookies and the same JWT',async t=>{
 const requests:string[]=[];
 t.mock.method(globalThis,'fetch',async(input:any)=>{
   const url=new URL(typeof input==='string'?input:input.url);requests.push(url.pathname);
   if(url.pathname.endsWith('/auth/v1/user'))return Response.json(user);
   if(url.pathname.endsWith('/rest/v1/piloto_coadministradores'))return Response.json([{ativo:true,permissoes:{members:'gerenciar',giras:'gerenciar',cantina:'gerenciar'}}]);
   throw new Error('Unexpected request '+url.pathname);
 });
 const env={PILOT_COOKIE_SECRET:secret,INTERFACE_ROLLOUT_MODE:'managers',MEMBER_INTERFACE_ROLLOUT_MODE:'members',API:{fetch:async(input:any)=>{
   const url=new URL(typeof input==='string'?input:input.url);
   if(url.pathname==='/api/public-config')return Response.json({supabaseUrl:'https://supabase.example.test',supabaseAnonKey:'unit-test-public'});
   if(url.pathname==='/api/tenant-info')return Response.json(tenant);
   if(url.pathname==='/api/v1/filho/profile')return Response.json({data:child});
   throw new Error('Unexpected API route '+url.pathname);
 }},ASSETS:{fetch:async(input:Request)=>new Response(new URL(input.url).pathname)},CURRENT_APP:{fetch:async()=>new Response('classic')}};
 const automaticResponse=await worker.fetch(request('auto'),env);
 const automaticResult=await automaticResponse.json();
 assert.equal(automaticResponse.status,200);
 assert.equal(automaticResult.interface,'member');
 assert.equal(automaticResult.profile.role,'filho');
 const managerResponse=await worker.fetch(request('manager'),env);
 const managerResult=await managerResponse.json();
 assert.equal(managerResult.interface,'manager');
 assert.equal(managerResult.profile.role,'admin');
 const memberResponse=await worker.fetch(request('member'),env);
 const memberResult=await memberResponse.json();
 assert.equal(memberResponse.status,200);
 assert.equal(memberResult.enabled,true);
 assert.equal(memberResult.interface,'member');
 assert.equal(memberResult.profile.role,'filho');
 assert.equal(memberResult.profile.is_co_admin,true);
 assert.equal(isPilotMember(user,memberResult.profile,memberResult.member),true);
 const memberCookie=(memberResponse.headers.get('set-cookie')||'').match(/__Host-axecloud-member-pilot=([^;]+)/)?.[1]||'';
 const managerCookie=(memberResponse.headers.get('set-cookie')||'').match(/__Host-axecloud-pilot=([^;]+)/)?.[1]||'';
 assert.equal(await validMemberCookie(memberCookie,secret),true);
 assert.ok(managerCookie);
 const cookieHeader={Cookie:`${MEMBER_COOKIE}=${memberCookie}; __Host-axecloud-pilot=${managerCookie}`};
 const memberDoc=await worker.fetch(new Request('https://axecloud.com.br/dashboard?space=member',{headers:cookieHeader}),env);
 assert.equal(memberDoc.headers.get('X-AxeCloud-Interface'),'member-pilot');
 assert.equal(await memberDoc.text(),'/member/index.html');
 const managerDoc=await worker.fetch(new Request('https://axecloud.com.br/dashboard?space=manager',{headers:cookieHeader}),env);
 assert.equal(managerDoc.headers.get('X-AxeCloud-Interface'),'pilot-5188');
 assert.equal(await managerDoc.text(),'/index.html');
 const versionRequest=(referer:string,cookie=CookieHeader)=>worker.fetch(new Request('https://axecloud.com.br/api/pilot/version',{
  headers:{Authorization:'Bearer verified-test-session',Referer:referer,Cookie:cookie},
 }),env);
 const CookieHeader=cookieHeader.Cookie;
 const memberVersion=await versionRequest('https://axecloud.com.br/dashboard?space=member');
 assert.equal(memberVersion.status,200);
 assert.equal(await memberVersion.text(),'/member/pilot-version.json');
 assert.match(memberVersion.headers.get('vary')||'',/Referer/);
 const managerVersion=await versionRequest('https://axecloud.com.br/dashboard?space=manager');
 assert.equal(await managerVersion.text(),'/pilot-version.json');
 const noMemberCookie=await versionRequest('https://axecloud.com.br/dashboard?space=member','__Host-axecloud-pilot='+managerCookie);
 assert.equal(await noMemberCookie.text(),'/pilot-version.json');
 const defaultDoc=await worker.fetch(new Request('https://axecloud.com.br/dashboard',{headers:cookieHeader}),env);
 assert.equal(defaultDoc.headers.get('X-AxeCloud-Interface'),'member-pilot');
 assert.equal(await defaultDoc.text(),'/member/index.html');
 const managerOnly={Cookie:'__Host-axecloud-pilot='+managerCookie};
 const pendingMember=await worker.fetch(new Request('https://axecloud.com.br/dashboard?space=member',{headers:managerOnly}),env);
 assert.equal(await pendingMember.text(),'classic');
 const managerOnlyDoc=await worker.fetch(new Request('https://axecloud.com.br/dashboard',{headers:managerOnly}),env);
 assert.equal(await managerOnlyDoc.text(),'/index.html');
 assert.ok(requests.includes('/rest/v1/piloto_coadministradores'));
});
test('inactive member cannot obtain member cookie even with an active co-admin delegation',async t=>{
 t.mock.method(globalThis,'fetch',async(input:any)=>{
   const url=new URL(typeof input==='string'?input:input.url);
   if(url.pathname.endsWith('/auth/v1/user'))return Response.json(user);
   if(url.pathname.endsWith('/rest/v1/piloto_coadministradores'))return Response.json([{ativo:true,permissoes:{members:'gerenciar',giras:'gerenciar',cantina:'gerenciar'}}]);
   return new Response('unavailable',{status:404});
 });
 const env={PILOT_COOKIE_SECRET:secret,MEMBER_INTERFACE_ROLLOUT_MODE:'members',API:{fetch:async(input:any)=>{
   const url=new URL(typeof input==='string'?input:input.url);
   if(url.pathname==='/api/public-config')return Response.json({supabaseUrl:'https://supabase.example.test',supabaseAnonKey:'unit-test-public'});
   if(url.pathname==='/api/tenant-info')return Response.json(tenant);
   return Response.json({data:{...child,status:'Inativo'}});
 }}};
 const response=await worker.fetch(request('member'),env);
 assert.equal(response.status,403);
 assert.equal((await response.json()).enabled,false);
 assert.equal(response.headers.get('set-cookie'),null);
});
