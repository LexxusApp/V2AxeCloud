import test from 'node:test';
import assert from 'node:assert/strict';
import {isDelegatedPilotCoAdmin} from '../cloudflare/pilot-coadmin-access.js';
const TENANT='fad75b91-d2eb-4805-b5a3-c19e8a073bed';
const USER='ab2eef13-604c-4c8f-9d14-f3da41cc5a81';
const base={user:{id:USER},profile:{tenant_id:TENANT,role:'filho',is_co_admin:true},config:{supabaseUrl:'https://example.supabase.co',supabaseAnonKey:'public-anon'},authorization:'Bearer test-jwt'};
const fetcher=(active)=>async(url,opts)=>{
 const parsed=new URL(url);
 assert.equal(parsed.searchParams.get('tenant_id'),'eq.'+TENANT);
 assert.equal(parsed.searchParams.get('user_id'),'eq.'+USER);
 assert.equal(parsed.searchParams.get('ativo'),'eq.true');
 assert.equal(opts.headers.Authorization,base.authorization);
 return {ok:true,json:async()=>active?[{ativo:true,permissoes:{members:'gerenciar'}}]:[]};
};
test('active delegated user is confirmed with authenticated database row',async()=>{
 assert.equal(await isDelegatedPilotCoAdmin({...base,fetcher:fetcher(true)}),true);
});
test('revocation wins over stale is_co_admin profile flag',async()=>{
 assert.equal(await isDelegatedPilotCoAdmin({...base,fetcher:fetcher(false)}),false);
});
test('non-pilot tenants are never elevated',async()=>{
 assert.equal(await isDelegatedPilotCoAdmin({...base,profile:{tenant_id:'6588b6c9-ce84-4140-a69a-f487a0c61dab',is_co_admin:true},fetcher:async()=>{throw Error('must not call')}}),false);
});
test('database errors fail closed',async()=>{
 assert.equal(await isDelegatedPilotCoAdmin({...base,fetcher:async()=>({ok:false})}),false);
});
