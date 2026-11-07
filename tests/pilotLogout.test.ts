import test from 'node:test';
import assert from 'node:assert/strict';
import {endPilotSession} from '../lib/pilotLogout';
import worker from '../cloudflare/pilot-interface-worker.js';
test('logout clears both pilot selections before ending the local auth session and navigating',async()=>{
 const calls:string[]=[];
 await endPilotSession({request:async(input,init)=>{assert.equal(input,'/api/pilot/signout');assert.equal(init?.method,'POST');assert.equal(init?.credentials,'same-origin');calls.push('clear');return Response.json({success:true});},endAuth:async()=>{calls.push('local-auth');return {error:null};},navigate:()=>calls.push('login')});
 assert.deepEqual(calls,['clear','local-auth','login']);
});
test('logout failures never navigate or claim that an active session ended',async()=>{
 let ended=0,navigated=0;
 await assert.rejects(endPilotSession({request:async()=>Response.json({success:false},{status:503}),endAuth:async()=>{ended++;return {error:null};},navigate:()=>navigated++}),/seleção da conta/);
 assert.equal(ended,0);assert.equal(navigated,0);
 await assert.rejects(endPilotSession({request:async()=>Response.json({success:true}),endAuth:async()=>({error:Error('Unavailable')}),navigate:()=>navigated++}),/sua sessão/);assert.equal(navigated,0);
});
test('logout expires manager and member cookies only for same-origin POST, without changing other users',async()=>{
 const env={};const response=await worker.fetch(new Request('https://axecloud.com.br/api/pilot/signout',{method:'POST',headers:{Origin:'https://axecloud.com.br'}}),env);
 assert.equal(response.status,200);const cookies=response.headers.get('set-cookie')||'';
 assert.match(cookies,/__Host-axecloud-pilot=;[^,]*HttpOnly; Secure; SameSite=Lax; Max-Age=0/);assert.match(cookies,/__Host-axecloud-member-pilot=;[^,]*HttpOnly; Secure; SameSite=Lax; Max-Age=0/);
 assert.equal((await worker.fetch(new Request('https://axecloud.com.br/api/pilot/signout'),env)).status,403);
 assert.equal((await worker.fetch(new Request('https://axecloud.com.br/api/pilot/signout',{method:'POST',headers:{Origin:'https://other.invalid'}}),env)).status,403);
});
