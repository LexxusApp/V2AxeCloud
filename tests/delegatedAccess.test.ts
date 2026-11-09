import test from 'node:test';
import assert from 'node:assert/strict';
import {checkDelegatedApiRequest,cleanDelegatedPermissions} from '../api/lib/delegatedAccess';
import {readDelegatedPilotPermissions} from '../cloudflare/pilot-coadmin-access.js';
import {isManagerIdentity} from '../cloudflare/pilot-interface-policy.js';
const tenant='11111111-1111-4111-8111-111111111111',user={id:'22222222-2222-4222-8222-222222222222'};
const childId='33333333-3333-4333-8333-333333333333';
function fixture(permissions:Record<string,string>={},active=true){
 const entry={tenant_id:tenant,filho_id:childId,user_id:user.id,ativo:active,permissoes:permissions};
 const child={id:childId,user_id:user.id,tenant_id:tenant,status:'Ativo'};
 let entries=[entry];
 const sb:any={from:(table:string)=>{const filters:Record<string,unknown>={};const query:any={select:()=>query,eq:(k:string,v:unknown)=>{filters[k]=v;return query;},maybeSingle:async()=>({data:table==='filhos_de_santo'?child:entry,error:null}),then:(resolve:any,reject:any)=>Promise.resolve({data:entries.filter(e=>Object.entries(filters).every(([k,v])=>(e as any)[k]===v)),error:null}).then(resolve,reject)};return query;}};
 const check=(path:string,method='GET',body?:unknown)=>checkDelegatedApiRequest({sb,user,url:new URL(path,'https://axecloud.com.br'),method,body});
 return {check,child,entry,remove:()=>{entries=[];}};
}
test('each delegated module supports read and write independently in any house',async()=>{
 const paths:Record<string,string>={members:'/api/children',giras:'/api/events',finance:'/api/transactions',cantina:'/api/v1/cantina/data',inventory:'/api/inventory',communications:'/api/v1/chat/admin',gallery:'/api/v1/gallery/admin',library:'/api/v1/library/upload-url',store:'/api/v1/store/orders/action',radar:'/api/v1/settings/directory-profile'};
 for(const [module,path] of Object.entries(paths)){
  const reader=fixture({[module]:'visualizar'}),manager=fixture({[module]:'gerenciar'});
  assert.equal(await reader.check(path+'?tenantId='+tenant),null,module);
  assert.equal((await reader.check(path,'POST',{tenantId:tenant}))?.status,403,module);
  assert.equal(await manager.check(path,'POST',{tenantId:tenant}),null,module);
  assert.equal((await fixture().check(path))?.status,403,module);
 }
});
test('revoked delegation denies all management but preserves personal member actions',async()=>{
 const f=fixture({finance:'gerenciar'},false);
 assert.equal((await f.check('/api/transactions?userRole=admin'))?.status,403);
 for(const path of ['/api/v1/filho/profile','/api/events?scope=calendar','/api/transactions?userRole=filho','/api/v1/preceitos/current'])assert.equal(await f.check(path),null,path);
 assert.equal(await f.check('/api/v1/preceitos/'+childId+'/acknowledge','POST'),null);
});
test('personal routes cannot bypass cross-house checks in query or nested JSON',async()=>{
 const f=fixture({finance:'gerenciar'}),foreign='44444444-4444-4444-8444-444444444444';
 for(const path of ['/api/transactions?userRole=filho&tenantId='+foreign,'/api/v1/filho/profile?tenantId='+tenant+'&tenantId='+foreign])assert.equal((await f.check(path))?.status,403);
 for(const body of [{tenant_id:foreign},{childData:{tenant_id:foreign}},{data:{terreiroId:foreign}},{tenantId:[]},{tenantId:''}])assert.equal((await f.check('/api/v1/filho/profile','PATCH',body))?.status,403);
});
test('inactive or unlinked members lose delegation even when the grant row is active',async()=>{
 const f=fixture({inventory:'gerenciar'});f.child.status='Inativo';assert.equal((await f.check('/api/inventory'))?.status,403);
 f.child.status='Ativo';f.child.user_id=tenant;assert.equal((await f.check('/api/inventory'))?.status,403);
});
test('account ownership, banking, unknown routes and role flags cannot elevate a member',async()=>{
 const f=fixture({finance:'gerenciar',members:'gerenciar'});
 for(const path of ['/api/v1/settings/save','/api/v1/account/delete','/api/v1/subscription/renew','/api/v1/financial/pix-config','/api/unknown'])assert.equal((await f.check(path,'POST'))?.status,403,path);
 assert.equal(isManagerIdentity(user,{tenant_id:tenant,role:'admin',is_co_admin:true}),false);
 assert.deepEqual(cleanDelegatedPermissions({members:'gerenciar',finance:true,owner:'gerenciar'}),{members:'gerenciar'});
});
test('grant reads use the actual house and caller JWT, including non-pilot houses',async()=>{
 const result=await readDelegatedPilotPermissions({user,profile:{tenant_id:tenant,role:'filho'},config:{supabaseUrl:'https://test.supabase.co',supabaseAnonKey:'public'},authorization:'Bearer caller',fetcher:async(url:any,options:any)=>{
  assert.equal(new URL(url).searchParams.get('tenant_id'),'eq.'+tenant);assert.equal(options.headers.Authorization,'Bearer caller');
  return Response.json([{ativo:true,permissoes:{inventory:'visualizar'}}]);
 }});
 assert.deepEqual(result,{tenantId:tenant,permissions:{inventory:'visualizar'}});
});

test('message operations use their originating module without forcing communications access',async()=>{
 for(const [kind,module] of Object.entries({dados_acesso:'members',cobranca_mensalidade:'finance',cobranca_cantina:'cantina',aviso_gira:'giras'})){
  assert.equal(await fixture({[module]:'gerenciar'}).check('/api/whatsapp/send','POST',{tenant_id:tenant,tipo:kind}),null,kind);
  assert.equal((await fixture({[module]:'visualizar'}).check('/api/whatsapp/send','POST',{tenant_id:tenant,tipo:kind}))?.status,403,kind);
 }
 assert.equal((await fixture({communications:'gerenciar'}).check('/api/whatsapp/send','POST',{tenant_id:tenant,tipo:'dados_acesso'}))?.status,403);
});

test('house suspension blocks management and preserves the existing personal access exception for expired subscriptions',async()=>{
 const f=fixture({inventory:'gerenciar'});(f.entry as any).is_blocked=true;
 assert.equal((await f.check('/api/inventory'))?.status,403);
 assert.equal((await f.check('/api/v1/filho/profile'))?.status,403);
 (f.entry as any).access_block_reason='subscription_expired';
 assert.equal(await f.check('/api/v1/filho/profile'),null);
 assert.equal((await f.check('/api/inventory'))?.status,403);
});

