import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{signedCookie,validCookie} from '../cloudflare/pilot-interface-worker.js';
import {canUseMemberInterface,isPilotMember,MEMBER_PILOT,MEMBER_PREFIX} from '../cloudflare/member-pilot-policy.js';
import {signedMemberCookie,validMemberCookie,MEMBER_COOKIE} from '../cloudflare/member-pilot-cookie.js';
import {memberTab,memberTabs,matchesMemberTab} from '../design-systems/member-pilot-20261102/navigation';
const identity={id:MEMBER_PILOT.userId,email:MEMBER_PILOT.authEmail};
const tenant={role:'filho',tenant_id:MEMBER_PILOT.tenantId};
const member={id:MEMBER_PILOT.memberId,user_id:MEMBER_PILOT.userId,tenant_id:MEMBER_PILOT.tenantId,email:MEMBER_PILOT.email,status:'Ativo'};
test('only a verified active member and house relationship qualify, including shadow login accounts',()=>{
 assert.equal(isPilotMember(identity,tenant,member),true);assert.equal(isPilotMember({...identity,email:MEMBER_PILOT.email},tenant,member),true);
 assert.equal(isPilotMember(identity,tenant,{...member,email:''}),true);
 assert.equal(isPilotMember(identity,tenant,{...member,email:null}),true);
 assert.equal(isPilotMember({...identity,email:'email-updated@example.invalid'},tenant,member),true,'the verified user_id binding survives a contact email update');
 for(const [user,house,child] of [[null,tenant,member],[{...identity,id:'someone-else'},tenant,member],[identity,{...tenant,role:'admin'},member],[identity,{...tenant,tenant_id:'different'},member],[identity,tenant,{...member,id:'different'}],[identity,tenant,{...member,user_id:'different'}],[identity,tenant,{...member,tenant_id:'different'}],[identity,tenant,{...member,status:'Inativo'}]])assert.equal(isPilotMember(user,house,child),false);
 const another={user:{id:'11111111-1111-4111-8111-111111111111',email:'new.member@example.com'},tenant:{role:'filho',tenant_id:'22222222-2222-4222-8222-222222222222'},member:{id:'33333333-3333-4333-8333-333333333333',user_id:'11111111-1111-4111-8111-111111111111',tenant_id:'22222222-2222-4222-8222-222222222222',email:'new.member@example.com',status:'Ativo'}};
 assert.equal(isPilotMember(another.user,another.tenant,another.member),true);
 assert.equal(canUseMemberInterface(another.user,another.tenant,another.member,'pilot'),false);
 assert.equal(canUseMemberInterface(another.user,another.tenant,another.member,'members'),true);
});
test('member and manager cookies are cryptographically separated; expired, changed and foreign-key cookies fail',async()=>{
 const now=Date.now(),secret='unit-test-only',cookie=await signedMemberCookie(secret,now);
 assert.equal(await validMemberCookie(cookie,secret,now),true);assert.equal(await validMemberCookie(cookie,secret,now+3600001),false);assert.equal(await validMemberCookie(cookie+'a',secret,now),false);assert.equal(await validMemberCookie(cookie,'other',now),false);
 assert.equal(await validCookie(cookie,secret,now),false);assert.equal(await validMemberCookie(await signedCookie(secret,now),secret,now),false);
});
test('member assets and document require the member cookie, while manager assets remain independently protected',async()=>{
 const secret='unit-test-only',seen:string[]=[];
 const env={PILOT_COOKIE_SECRET:secret,CURRENT_APP:{fetch:async()=>new Response('original')},ASSETS:{fetch:async(request:Request)=>{seen.push(new URL(request.url).pathname);return new Response('member assets');}}};
 const headers={Cookie:`${MEMBER_COOKIE}=${await signedMemberCookie(secret)}`};
 const document=await worker.fetch(new Request('https://axecloud.com.br/dashboard',{headers}),env);
 assert.equal(document.headers.get('X-AxeCloud-Interface'),'member-pilot');assert.deepEqual(seen,['/member/index.html']);
 const asset=await worker.fetch(new Request('https://axecloud.com.br'+MEMBER_PREFIX+'assets/main.js',{headers}),env);assert.equal(asset.status,200);assert.equal(seen.at(-1),'/member/assets/main.js');
 assert.equal((await worker.fetch(new Request('https://axecloud.com.br'+MEMBER_PREFIX+'assets/main.js'),env)).status,403);
 assert.equal((await worker.fetch(new Request('https://axecloud.com.br/assets/pilot-20261101/assets/main.js',{headers}),env)).status,403);
 assert.equal(await(await worker.fetch(new Request('https://axecloud.com.br/dashboard?classic=1',{headers}),env)).text(),'original');
 for(const query of ['?member=1','?interface=member','?email=lucasteste@gmail.com'])assert.equal(await(await worker.fetch(new Request('https://axecloud.com.br/dashboard'+query),env)).text(),'original');
});
test('gate checks the real member profile as well as auth and tenant before signing the exclusive cookie',async t=>{
 let user={...identity},child={...member},house={...tenant},profileReads=0;
 t.mock.method(globalThis,'fetch',async()=>Response.json(user));
 const env={PILOT_COOKIE_SECRET:'unit-test-only',API:{fetch:async(input:string|Request)=>{const url=typeof input==='string'?input:input.url;if(url.includes('public-config'))return Response.json({supabaseUrl:'https://vlaojhfwhqmwudqsumpi.supabase.co',supabaseAnonKey:'public-unit-key'});if(url.includes('filho/profile')){profileReads++;return Response.json({data:child});}return Response.json(house);}}};
 const post=()=>worker.fetch(new Request('https://axecloud.com.br/api/pilot/interface-access',{method:'POST',headers:{Origin:'https://axecloud.com.br',Authorization:'Bearer unit-auth-service-verified'}}),env);
 let response=await post(),result=await response.json();assert.equal(result.enabled,true);assert.equal(result.interface,'member');assert.equal(profileReads,1);assert.match(response.headers.get('set-cookie')||'',/__Host-axecloud-member-pilot=.*HttpOnly; Secure; SameSite=Lax/);
 child={...member,user_id:'different'};response=await post();assert.equal((await response.json()).enabled,false);assert.match(response.headers.get('set-cookie')||'',/__Host-axecloud-member-pilot=;.*Max-Age=0/);
 child={...member};house={...tenant,role:'admin'};response=await post();assert.equal((await response.json()).enabled,false);
 house={...tenant};user={...identity,id:'another-member'};profileReads=0;response=await post();assert.equal((await response.json()).enabled,false);assert.equal(profileReads,1);
});
test('members rollout issues a cookie bound to any valid active member, not the former test account',async t=>{
 const user={id:'11111111-1111-4111-8111-111111111111',email:'new.member@example.com'},house={role:'filho',tenant_id:'22222222-2222-4222-8222-222222222222'},child={id:'33333333-3333-4333-8333-333333333333',user_id:user.id,tenant_id:house.tenant_id,email:user.email,status:'Ativo'};
 t.mock.method(globalThis,'fetch',async()=>Response.json(user));
 const served:string[]=[];
 const env={PILOT_COOKIE_SECRET:'unit-test-only',MEMBER_INTERFACE_ROLLOUT_MODE:'members',MEMBER_OPERATION_ROLLOUT_MODE:'members',API:{fetch:async(input:string|Request)=>{const url=typeof input==='string'?input:input.url;if(url.includes('public-config'))return Response.json({supabaseUrl:'https://vlaojhfwhqmwudqsumpi.supabase.co',supabaseAnonKey:'public-unit-key'});if(url.includes('filho/profile'))return Response.json({data:child});return Response.json(house);}},ASSETS:{fetch:async(input:Request)=>{served.push(new URL(input.url).pathname);return Response.json({buildId:'member-release'});}},CURRENT_APP:{fetch:async()=>new Response('classic')}};
 const response=await worker.fetch(new Request('https://axecloud.com.br/api/pilot/interface-access',{method:'POST',headers:{Origin:'https://axecloud.com.br',Authorization:'Bearer verified'}}),env),body=await response.json();
 assert.equal(body.enabled,true);assert.equal(body.interface,'member');assert.equal(body.tenantId,house.tenant_id);assert.equal(body.memberId,child.id);
 const cookie=(response.headers.get('set-cookie')||'').match(/__Host-axecloud-member-pilot=([^;]+)/)?.[1]||'';
 assert.equal(await validMemberCookie(cookie,env.PILOT_COOKIE_SECRET),true);
 const document=await worker.fetch(new Request('https://axecloud.com.br/dashboard',{headers:{Cookie:`${MEMBER_COOKIE}=${cookie}`}}),env);assert.equal(document.headers.get('x-axecloud-interface'),'member-pilot');assert.equal(served.at(-1),'/member/index.html');
 const version=await worker.fetch(new Request('https://axecloud.com.br/api/pilot/version',{headers:{Authorization:'Bearer verified'}}),env);assert.equal(version.status,200);assert.equal(served.at(-1),'/member/pilot-version.json');
});
test('missing and invalid auth clear stale member selection; logout only accepts same-origin POST',async t=>{
 const env={PILOT_COOKIE_SECRET:'unit-test-only',API:{fetch:async()=>Response.json({supabaseUrl:'https://unit.invalid',supabaseAnonKey:'public-unit-key'})}};
 const missing=await worker.fetch(new Request('https://axecloud.com.br/api/pilot/interface-access',{method:'POST',headers:{Origin:'https://axecloud.com.br'}}),env);assert.equal(missing.status,401);assert.match(missing.headers.get('set-cookie')||'',/__Host-axecloud-member-pilot=;/);
 t.mock.method(globalThis,'fetch',async()=>new Response('',{status:401}));const invalid=await worker.fetch(new Request('https://axecloud.com.br/api/pilot/interface-access',{method:'POST',headers:{Origin:'https://axecloud.com.br',Authorization:'Bearer invalid'}}),env);assert.equal(invalid.status,401);
 const logout=()=>worker.fetch(new Request('https://axecloud.com.br/api/pilot/member-signout',{method:'POST',headers:{Origin:'https://axecloud.com.br'}}),env);assert.equal((await logout()).status,200);
 assert.equal((await worker.fetch(new Request('https://axecloud.com.br/api/pilot/member-signout'),env)).status,403);
 assert.equal((await worker.fetch(new Request('https://axecloud.com.br/api/pilot/member-signout',{method:'POST',headers:{Origin:'https://unrelated.invalid'}}),env)).status,403);
});
test('legacy member links keep their destinations and managerial routes cannot enter the member navigation',()=>{
 assert.equal(memberTab('#profile'),'home');assert.equal(memberTab('perfil'),'home');assert.equal(memberTab('financial-cantina'),'financial');assert.equal(memberTab('obligations'),'obrigacoes');for(const tab of memberTabs)assert.equal(memberTab('#'+tab),tab);
 for(const manager of ['children','inventory','radar','subscription','settings','admin'])assert.equal(memberTab(manager),'home');
});
test('member search understands familiar module names and accents',()=>{
 assert.equal(matchesMemberTab('financial','Minhas contribuições','mensalidade'),true);assert.equal(matchesMemberTab('obrigacoes','Minha caminhada','obrigações'),true);assert.equal(matchesMemberTab('library','Biblioteca de estudos','PDF'),true);assert.equal(matchesMemberTab('meu-perfil','Meu perfil','instalar'),true);assert.equal(matchesMemberTab('store','Loja da casa','apagar usuário'),false);
});
