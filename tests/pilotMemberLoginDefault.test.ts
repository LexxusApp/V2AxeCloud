import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readPersistedFilhoFlag} from '../src/lib/appSessionAnchors';

test('member login marks intent before setSession can fire SIGNED_IN',()=>{
 const source=readFileSync('src/views/Login.tsx','utf8');
 const index=source.indexOf('// A navegação por SIGNED_IN');
 assert.ok(index>0);
 const chunk=source.slice(index,index+600);
 assert.ok(chunk.indexOf('persistFilhoFlag(true);')<chunk.indexOf('supabase.auth.setSession('));
 assert.match(source,/else localStorage.removeItem\(FILHO_FLAG_USER_KEY\)/);
});
test('existing member sessions and new member sign-in navigate explicitly to the member space',()=>{
 const source=readFileSync('src/pages/LoginPage.tsx','utf8');
 assert.match(source,/readPersistedFilhoFlag\(userId\)/);
 assert.match(source,/dashboard\?space=member/);
 assert.match(source,/openSignedInSpace\(data.session.user.id\)/);
 assert.match(source,/openSignedInSpace\(session.user.id\)/);
});
test('member login preference belongs to the current account, not another old account',()=>{
 const storage=new Map<string,string>();
 const original=(globalThis as {localStorage?:unknown}).localStorage;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
  getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,v:string)=>{storage.set(key,v);},
  removeItem:(key:string)=>{storage.delete(key);}
 }});
 try{
  storage.set('axecloud_is_filho','true');
  storage.set('axecloud_is_filho_user_id','11111111-1111-4111-8111-111111111111');
  assert.equal(readPersistedFilhoFlag('22222222-2222-4222-8222-222222222222'),false);
  storage.delete('axecloud_is_filho_user_id');
  assert.equal(readPersistedFilhoFlag('22222222-2222-4222-8222-222222222222'),true);
 }finally{Object.defineProperty(globalThis,'localStorage',{configurable:true,value:original});}
});

test('bootstrap requests an automatic, server-verified space unless mode was explicitly selected',async()=>{
 const {pilotBootstrap}=await import('../cloudflare/pilot-bootstrap.js');
 const code=pilotBootstrap([],true);
 assert.match(code,/targetSpace=explicitSpace==='member'\?'member':explicitSpace==='manager'\?'manager':'auto'/);
 assert.match(code,/interface-access\?space=/);
});
