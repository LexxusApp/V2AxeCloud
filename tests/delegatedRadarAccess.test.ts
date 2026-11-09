import test from 'node:test';
import assert from 'node:assert/strict';
import {registerDirectoryProfilePublicationsRoutes} from '../api/lib/directoryProfilePublicationsRoutes';
import {registerTerreiroServicosRoutes} from '../api/lib/terreiroServicosRoutes';

const tenant='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',child='33333333-3333-4333-8333-333333333333';
for(const [register,path] of [[registerDirectoryProfilePublicationsRoutes,'/api/v1/settings/directory-publicacoes'],[registerTerreiroServicosRoutes,'/api/v1/settings/terreiro-servicos']] as const){
 test('Radar visualizar never creates a missing directory profile: '+path,async()=>{
  let mutations=0;const routes=new Map<string,Function>();
  const app:any={};for(const method of ['get','post','patch','delete'])app[method]=(route:string,...handlers:Function[])=>routes.set(method+' '+route,handlers.at(-1)!);
  const sb:any={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},from:(table:string)=>{
   const value=table==='piloto_coadministradores'?{tenant_id:tenant,filho_id:child,user_id:user,ativo:true,permissoes:{radar:'visualizar'}}:
    table==='filhos_de_santo'?{id:child,user_id:user,tenant_id:tenant,status:'Ativo'}:table==='perfil_lider'?{id:tenant}:null;
   const query:any={};for(const method of ['select','eq','order','limit'])query[method]=()=>query;
   query.maybeSingle=async()=>({data:value,error:null});
   for(const method of ['insert','update','delete'])query[method]=()=>{mutations++;throw Error('A read-only request attempted a write');};
   return query;
  }};
  register(app,{supabaseAdmin:sb});
  let status=200,payload:any;const res:any={status:(n:number)=>{status=n;return res;},json:(body:any)=>{payload=body;return res;}};
  const handler=routes.get('get '+path);assert.ok(handler,'settings route registered');
  await handler({headers:{authorization:'Bearer radar-read-'+path},params:{},query:{}},res);
  assert.equal(status,200);assert.equal(payload.claimed,false);assert.equal(mutations,0);
 });
}
