import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePilotSupport} from '../cloudflare/pilot-support.js';
import {PILOT_TENANT} from '../cloudflare/pilot-interface-policy.js';
const id='56c97c06-2fd6-4821-9166-1dbd7d4ba568',attempt='109d48da-4d7b-470f-af44-d6709c4d9173';
const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
function fixture(actor=PILOT_TENANT){
 const calls:any[]=[],payload={nomeZelador:'Technical',nomeTerreiro:'Technical',whatsapp:'11900000000',mensagem:'Technical - mock only'};
 let claim:any={id,send:true,attempt,payload},result:any={ok:true,messageId:'mock-only'},status=200,lost=false,finalizeFail=false;
 const env={API:{fetch:async(request:Request)=>{const url=new URL(request.url);calls.push({service:url.pathname,body:request.method==='POST'?await request.json():null});if(url.pathname==='/api/public-config')return json({supabaseUrl:'https://support.invalid',supabaseAnonKey:'public-mock'});if(url.pathname==='/api/tenant-info')return json({tenant_id:PILOT_TENANT,role:'admin',status:'active'});if(url.pathname==='/api/v1/support'){if(lost)throw Error('Lost response');return json(result,status);}throw Error('Unexpected service');}}};
 const fetcher=async(input:any,init:any={})=>{const url=new URL(String(input));calls.push({path:url.pathname,query:url.search,body:init.body?JSON.parse(init.body):null});if(url.pathname==='/auth/v1/user')return json({id:actor,email:'vendasmercadolivrev1@gmail.com'});if(url.pathname.endsWith('piloto_suporte_iniciar'))return json(claim);if(url.pathname.endsWith('piloto_suporte_finalizar'))return finalizeFail?json({error:'Unavailable'},503):json({id,state:JSON.parse(init.body).p_state});if(url.pathname.endsWith('piloto_suporte_situacao'))return json({id,status:JSON.parse(init.body).p_status});if(url.pathname.endsWith('piloto_suporte_chamados'))return json([{id,dados:{subject:'Saved technical request'},status:'open',envio_estado:'sending',created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z'}]);if(url.pathname.endsWith('piloto_suporte_complementos'))return json([{id:attempt,chamado_id:id,texto:'Saved complement',envio_estado:'confirmed',created_at:'2026-01-01T00:00:00Z'}]);throw Error('Unexpected path');};
 const request=(method='POST',data:any={id,data:{text:'Technical mock only'}})=>new Request('https://axecloud.com.br/api/pilot/support',{method,headers:{Authorization:'Bearer technical-mock',Origin:'https://axecloud.com.br','Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(data)})});
 return {calls,payload,request,run:(r:Request)=>handlePilotSupport(r,env,fetcher),setClaim:(v:any)=>claim=v,setProvider:(v:any,s=200)=>{result=v;status=s;},lose:()=>lost=true,failAudit:()=>finalizeFail=true};
}
test('support denies unsigned users, other accounts, origins and houses before any send',async()=>{
 const f=fixture();assert.equal((await f.run(new Request('https://axecloud.com.br/api/pilot/support'))).status,401);assert.equal(f.calls.length,0);
 const member=fixture('ab2eef13-604c-4c8f-9d14-f3da41cc5a81');assert.equal((await member.run(member.request('GET'))).status,403);assert.equal(member.calls.some(c=>c.service==='/api/v1/support'),false);
 const invalid=f.request();invalid.headers.set('Origin','https://another.invalid');assert.equal((await f.run(invalid)).status,403);
 const other=new Request('https://axecloud.com.br/api/pilot/support?tenantId=other',{headers:{Authorization:'Bearer technical-mock'}});assert.equal((await f.run(other)).status,403);
});
test('support forwards only the server-authorized payload and requires a real service receipt',async()=>{
 const f=fixture(),result=await f.run(f.request());assert.equal(result.status,200);assert.equal((await result.json()).delivery,'confirmed');assert.deepEqual(f.calls.find(c=>c.service==='/api/v1/support').body,f.payload);assert.equal(f.calls.find(c=>c.path?.endsWith('piloto_suporte_finalizar')).body.p_attempt,attempt);
 const bad=fixture();bad.setProvider({ok:true});const body=await (await bad.run(bad.request())).json();assert.equal(body.delivery,'uncertain');
});
test('duplicate claims never forward another email, even on explicit retry',async()=>{
 for(const state of ['confirmed','uncertain','sending']){const f=fixture();f.setClaim({id,send:false,state});const body=await(await f.run(f.request('POST',{id,retry:true,data:{}}))).json();assert.equal(body.delivery,state);assert.equal(body.replayed,true);assert.equal(f.calls.some(c=>c.service==='/api/v1/support'),false);}
});
test('network and upstream failures are uncertain, while an explicit validation rejection is retryable',async()=>{
 for(const status of [500,502,503,504]){const f=fixture();f.setProvider({error:'Upstream response unavailable'},status);assert.equal((await(await f.run(f.request())).json()).delivery,'uncertain');}
 const lost=fixture();lost.lose();assert.equal((await(await lost.run(lost.request())).json()).delivery,'uncertain');
 const rejected=fixture();rejected.setProvider({error:'Rate limited'},429);const body=await(await rejected.run(rejected.request())).json();assert.equal(body.delivery,'failed');assert.equal(body.deliveryError,'Rate limited');
});
test('a confirmed email is not reported failed when recording its receipt fails',async()=>{
 const f=fixture();f.failAudit();const body=await(await f.run(f.request())).json();assert.equal(body.delivery,'confirmed');assert.equal(body.auditPending,true);assert.equal(f.calls.filter(c=>c.service==='/api/v1/support').length,1);
});
test('persistent history includes delivery states and complements without inventing staff replies',async()=>{
 const f=fixture(),response=await f.run(f.request('GET')),body=await response.json();assert.equal(body.tickets.length,1);assert.equal(body.tickets[0].delivery,'uncertain');assert.equal(body.tickets[0].messages[0].text,'Saved complement');assert.equal(body.tickets[0].messages[0].delivery,'confirmed');assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(f.calls.some(c=>c.service==='/api/v1/support'),false);
});
test('closing an owner tracking record does not notify the support service',async()=>{
 const f=fixture();const result=await(await f.run(f.request('PATCH',{id,status:'closed',before:'open'}))).json();assert.equal(result.status,'closed');assert.equal(f.calls.some(c=>c.service==='/api/v1/support'),false);
});
