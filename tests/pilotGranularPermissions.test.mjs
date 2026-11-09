import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPilotDelegatedOperation,grantAllows,PILOT_MODULE_KEYS} from '../cloudflare/pilot-granular-policy.js';
import {readDelegatedPilotPermissions} from '../cloudflare/pilot-coadmin-access.js';
const base={user:{id:'ab2eef13-604c-4c8f-9d14-f3da41cc5a81'},profile:{tenant_id:'fad75b91-d2eb-4805-b5a3-c19e8a073bed'},config:{supabaseUrl:'https://example.supabase.co',supabaseAnonKey:'anon'},authorization:'Bearer token'};
test('each module is explicit; missing and unknown rights never authorize',()=>{
 for(const key of PILOT_MODULE_KEYS){
  assert.equal(grantAllows({[key]:'visualizar'},key,'visualizar'),true);
  assert.equal(grantAllows({[key]:'visualizar'},key,'gerenciar'),false);
  assert.equal(grantAllows({[key]:'gerenciar'},key,'visualizar'),true);
  assert.equal(grantAllows({[key]:'gerenciar'},key,'gerenciar'),true);
  assert.equal(grantAllows({},key,'visualizar'),false);
 }
 assert.equal(grantAllows({billing:'gerenciar'},'billing','gerenciar'),false);
});
test('module paths require write permission for mutations, not just read',()=>{
 const paths=[
  ['/api/children','members'],['/api/events','giras'],['/api/transactions','finance'],
  ['/api/v1/cantina/cardapio','cantina'],['/api/inventory','inventory'],
  ['/api/notices','communications'],['/api/v1/gallery/assets','gallery'],
  ['/api/v1/library/materials','library'],['/api/v1/store/products','store'],['/api/v1/radar/profile','radar'],
 ];
 for(const [path,key] of paths){
  assert.deepEqual(classifyPilotDelegatedOperation(path,'GET'),{type:'module',module:key,level:'visualizar'});
  assert.deepEqual(classifyPilotDelegatedOperation(path,'POST'),{type:'module',module:key,level:'gerenciar'});
 }
});
test('Radar directory settings require Radar rights, other account settings remain owner-only',()=>{
 assert.deepEqual(classifyPilotDelegatedOperation('/api/v1/settings/directory-profile','PATCH'),{type:'module',module:'radar',level:'gerenciar'});
 assert.equal(classifyPilotDelegatedOperation('/api/v1/settings/save','PATCH').type,'blocked');
});
test('exclusive account, subscription, Pix, and unknown endpoints fail closed',()=>{
 for(const path of ['/api/v1/settings/portal-consulente','/api/v1/subscription/plan','/api/v1/financial/pix-config','/api/admin/users','/api/unknown-manager-action']){
  assert.equal(classifyPilotDelegatedOperation(path,'GET').type,'blocked',path);
 }
 assert.equal(classifyPilotDelegatedOperation('/api/v1/filho/profile','GET').type,'personal');
 assert.equal(classifyPilotDelegatedOperation('/api/tenant-info','GET').type,'public');
});
test('delegation requires an active row with actual permissions, not a stale profile',async()=>{
 const active=await readDelegatedPilotPermissions({...base,fetcher:async()=>({ok:true,json:async()=>[{ativo:true,permissoes:{members:'visualizar',finance:'invalid'}}]})});
 assert.deepEqual(active.permissions,{members:'visualizar'});
 const disabled=await readDelegatedPilotPermissions({...base,fetcher:async()=>({ok:true,json:async()=>[{ativo:false,permissoes:{members:'gerenciar'}}]})});
 assert.equal(disabled,null);
 const empty=await readDelegatedPilotPermissions({...base,fetcher:async()=>({ok:true,json:async()=>[{ativo:true,permissoes:{}}]})});
 assert.equal(empty,null);
 const fail=await readDelegatedPilotPermissions({...base,fetcher:async()=>({ok:false,status:500})});
 assert.equal(fail,null);
});
test('another tenant is never interpreted as the pilot even if the role is manager',async()=>{
 const invalid=await readDelegatedPilotPermissions({...base,profile:{tenant_id:'6588b6c9-ce84-4140-a69a-f487a0c61dab',is_co_admin:true},fetcher:async()=>{throw Error('must not call')}});
 assert.equal(invalid,null);
});
