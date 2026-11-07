import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePilotNotices,handlePilotNoticesLegacy} from '../cloudflare/pilot-notices.js';
import {PILOT_TENANT} from '../cloudflare/pilot-interface-policy.js';
import {MEMBER_PILOT} from '../cloudflare/member-pilot-policy.js';

const id='aa111111-1111-4111-8111-111111111111',key='bb222222-2222-4222-8222-222222222222',attempt='cc333333-3333-4333-8333-333333333333';
const other='dd444444-4444-4444-8444-444444444444';
const json=(value:any,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const notice=(extra:any={})=>({id,title:'Technical notice',body:'Technical content — no external delivery in tests.',audience:'selected',memberIds:[MEMBER_PILOT.memberId],giraId:'',status:'published',category:'Doutrina',expires:'',revision:1,updated:'2026-11-03T12:00:00Z',publishedAt:'2026-11-03T12:00:00Z',delivery:'none',...extra});
function fixture(actor=PILOT_TENANT){
 const calls:any[]=[],rows=[notice()];let claimed=false,providerStatus=200,provider:any={success:true,externalId:'mock-receipt'},lost=false,auditFail=false,skip=false,rpcError:any=null;
 const token='mock.'+btoa(JSON.stringify({sub:actor}))+'.mock';
 const env={API:{fetch:async(request:Request)=>{
  const path=new URL(request.url).pathname,body=request.method==='POST'?await request.json():null;calls.push({service:path,body});
  if(path==='/api/public-config')return json({supabaseUrl:'https://notices.invalid',supabaseAnonKey:'public-mock'});
  if(path==='/api/whatsapp/send'){if(lost)throw Error('Mock lost response');return json(provider,providerStatus);}
  if(path==='/api/v1/filho/home')return json({child:{id:MEMBER_PILOT.memberId},financialStatus:'pago',notices:[{id:'legacy-must-be-replaced'}]});
  if(path==='/api/v1/dashboard/core')return json({schemaVersion:1,resources:{children:{data:[]},transactions:{data:[]},events:{data:[]},notices:{data:[{id:'legacy-must-be-replaced'}]}}});
  throw Error('Unexpected API call: '+path);
 }}};
 const fetcher=async(input:any,init:any={})=>{
  const path=new URL(String(input)).pathname,body=init.body?JSON.parse(init.body):null;calls.push({path,body,headers:init.headers});
  if(path==='/auth/v1/user')return json({id:actor});
  if(rpcError)return json(rpcError,400);
  const rpc=path.split('/').at(-1);
  if(rpc==='piloto_comunicados_listar')return json({data:rows});
  if(rpc==='piloto_comunicados_salvar'){rows[0]=notice({...body.p_notice,revision:(body.p_expected||0)+1});return json(rows[0]);}
  if(rpc==='piloto_comunicados_excluir')return json({id:body.p_id,revision:body.p_expected+1,deleted:true});
  if(rpc==='piloto_comunicados_restaurar')return json(notice({revision:body.p_expected+1}));
  if(rpc==='piloto_comunicados_iniciar_envio'){
   if(claimed)return json({id,send:false,notice:rows[0],recipients:[]});
   claimed=true;rows[0].delivery='sending';return json({id,send:true,recipients:[MEMBER_PILOT.memberId]});
  }
  if(rpc==='piloto_comunicados_assumir_destinatario')return json(skip?{id,send:false}:{id,send:true,attempt,payload:{tipo:'mural_aviso',filhoId:MEMBER_PILOT.memberId,forcePhone:'never-forward',variables:{titulo_aviso:rows[0].title,conteudo_aviso:rows[0].body,comunicado:rows[0].body}}});
  if(rpc==='piloto_comunicados_finalizar_envio'){
   if(auditFail)return json({error:'mock unavailable'},503);
   rows[0].delivery=body.p_state;return json({id,state:body.p_state});
  }
  throw Error('Unexpected database call: '+path);
 };
 const request=(method='GET',body:any=undefined,path='/api/pilot/notices')=>new Request('https://axecloud.com.br'+path,{method,headers:{Authorization:'Bearer '+token,Origin:'https://axecloud.com.br','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {calls,rows,request,run:(r:Request)=>handlePilotNotices(r,env,fetcher),legacy:(r:Request)=>handlePilotNoticesLegacy(r,env,fetcher),
  provider:(value:any,status=200)=>{provider=value;providerStatus=status;},lose:()=>lost=true,failAudit:()=>auditFail=true,skip:()=>skip=true,error:(value:any)=>rpcError=value};
}
const sendRequest=(f:ReturnType<typeof fixture>,data:any={expected:1,key})=>f.request('POST',data,`/api/pilot/notices/${id}/notify`);
const sends=(f:ReturnType<typeof fixture>)=>f.calls.filter(call=>call.service==='/api/whatsapp/send');

test('notices never intercept unrelated routes or unauthenticated requests',async()=>{
 const f=fixture();assert.equal(await f.run(new Request('https://axecloud.com.br/api/other')),null);
 assert.equal((await f.run(new Request('https://axecloud.com.br/api/pilot/notices'))).status,401);assert.equal(f.calls.length,0);
});
test('only the two existing pilot accounts can use the new endpoint',async()=>{
 const f=fixture(other);assert.equal((await f.run(f.request())).status,403);assert.equal(f.calls.some(call=>call.path?.includes('/rpc/')),false);
 const m=fixture(MEMBER_PILOT.userId);assert.equal((await m.run(m.request())).status,200);
 assert.equal((await m.run(m.request('POST',{notice:notice()}))).status,403);assert.equal(sends(m).length,0);
});
test('tenant tampering and cross-site writes are refused before database mutation',async()=>{
 const f=fixture();assert.equal((await f.run(f.request('GET',undefined,'/api/pilot/notices?tenantId='+other))).status,403);
 const request=f.request('POST',{notice:notice()});request.headers.set('Origin','https://outside.invalid');assert.equal((await f.run(request)).status,403);
 assert.equal(f.calls.some(call=>call.path?.includes('/rpc/')),false);
});
test('database access carries only the caller JWT and public API key, with no service role',async()=>{
 const f=fixture(),response=await f.run(f.request());assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 const read=f.calls.find(call=>call.path?.endsWith('piloto_comunicados_listar'));assert.equal(read.headers.apikey,'public-mock');assert.match(read.headers.Authorization,/^Bearer mock\./);assert.equal(read.body.p_tenant,PILOT_TENANT);
});
test('draft, selected audience, category, expiration and gira are saved without any notifications',async()=>{
 const f=fixture(),row=notice({status:'draft',giraId:other,expires:'2026-12-10'}),response=await f.run(f.request('POST',{notice:row}));
 assert.equal(response.status,200);const saved=(await response.json()).notice;for(const key of ['status','audience','category','expires','giraId','memberIds'])assert.deepEqual(saved[key],row[key]);assert.equal(sends(f).length,0);
});
test('deletion and restoration require confirmed server revisions and never send',async()=>{
 const f=fixture(),removed=await(await f.run(f.request('DELETE',{expected:1},`/api/pilot/notices/${id}`))).json();assert.equal(removed.revision,2);
 const restored=await(await f.run(f.request('POST',{expected:2},`/api/pilot/notices/${id}/restore`))).json();assert.equal(restored.notice.revision,3);assert.equal(sends(f).length,0);
 assert.equal((await f.run(f.request('DELETE',{},`/api/pilot/notices/${id}`))).status,409);
});
test('malformed data, invalid revisions, body limits and unsupported methods fail closed',async()=>{
 const f=fixture();assert.equal((await f.run(f.request('POST',{notice:notice(),expected:-1}))).status,400);
 assert.equal((await f.run(f.request('POST',null))).status,400);
 assert.equal((await f.run(f.request('PUT',{}))).status,405);
 assert.equal((await f.run(f.request('POST',{data:'x'.repeat(32001)}))).status,413);
 const bad=f.request('POST',{});const raw=new Request(bad.url,{method:'POST',headers:bad.headers,body:'not-json'});assert.equal((await f.run(raw)).status,400);assert.equal(sends(f).length,0);
});
test('database denial/conflict/validation errors remain private and never fall back to legacy',async()=>{
 for(const [code,status] of [['42501',403],['23505',409],['22023',400]]){
  const f=fixture();f.error({code,message:'sensitive SQL implementation detail'});const response=await f.run(f.request());assert.equal(response.status,status);assert.doesNotMatch(JSON.stringify(await response.json()),/sensitive SQL/);assert.equal(sends(f).length,0);
 }
});
test('only an explicit notify call uses the server-authorized targeted WhatsApp endpoint',async()=>{
 const f=fixture();assert.equal((await f.run(sendRequest(f))).status,200);assert.equal(sends(f).length,1);
 const sent=sends(f)[0].body;assert.equal(sent.filhoId,MEMBER_PILOT.memberId);assert.equal(sent.tipo,'mural_aviso');assert.equal(sent.forcePhone,undefined);assert.equal(sent.variables.comunicado,f.rows[0].body);
 const final=f.calls.find(call=>call.path?.endsWith('piloto_comunicados_finalizar_envio'));assert.equal(final.body.p_attempt,attempt);assert.equal(final.body.p_external,'mock-receipt');assert.equal(final.body.p_state,'confirmed');
});
test('simultaneous clicks and fresh request keys cannot repeat the same notice revision',async()=>{
 const f=fixture();const responses=await Promise.all([f.run(sendRequest(f)),f.run(sendRequest(f,{expected:1,key:other}))]);assert.ok(responses.every(response=>response.status===200));assert.equal(sends(f).length,1);
 assert.equal((await(await f.run(sendRequest(f))).json()).replayed,true);assert.equal(sends(f).length,1);
});
test('missing idempotency key never creates a campaign',async()=>{
 const f=fixture();assert.equal((await f.run(sendRequest(f,{expected:1}))).status,400);assert.equal(f.calls.some(call=>call.path?.endsWith('piloto_comunicados_iniciar_envio')),false);
});
test('a recipient that became inactive after the initial snapshot is not sent a message',async()=>{
 const f=fixture();f.skip();assert.equal((await f.run(sendRequest(f))).status,200);assert.equal(sends(f).length,0);
});
test('lost response and missing service receipt are uncertain and never automatically retried',async()=>{
 for(const mode of ['lost','missing','server']){
  const f=fixture();if(mode==='lost')f.lose();else f.provider(mode==='missing'?{success:true}:{error:'mock upstream'},mode==='server'?503:200);
  const response=await f.run(sendRequest(f));assert.equal((await response.json()).notice.delivery,'uncertain');await f.run(sendRequest(f,{expected:1,key:other}));assert.equal(sends(f).length,1);
 }
});
test('explicit refusal is recorded without pretending the notice publication failed',async()=>{
 const f=fixture();f.provider({error:'mock rejection'},429);const response=await f.run(sendRequest(f));assert.equal(response.status,200);assert.equal((await response.json()).notice.delivery,'failed');
});
test('lost receipt persistence reports audit pending and cannot trigger a duplicate',async()=>{
 const f=fixture();f.failAudit();const result=await(await f.run(sendRequest(f))).json();assert.equal(result.auditPending,true);await f.run(sendRequest(f));assert.equal(sends(f).length,1);
});
test('legacy adapter keeps unrelated accounts untouched without consulting pilot services',async()=>{
 const f=fixture(other);assert.equal(await f.legacy(f.request('GET',undefined,'/api/notices')),null);assert.equal(f.calls.length,0);
});
test('legacy pilot reads map published notices without exposing draft content or recipients',async()=>{
 const f=fixture();f.rows.push(notice({id:other,status:'draft',body:'private draft'}));const response=await f.legacy(f.request('GET',undefined,'/api/notices'));
 const result=await response.json();assert.equal(result.data.length,1);assert.equal(result.data[0].titulo,f.rows[0].title);assert.equal(result.data[0].memberIds,undefined);assert.doesNotMatch(JSON.stringify(result),/private draft/);
 assert.equal((await f.legacy(f.request('POST',{notice:notice()},'/api/notices'))).status,409);assert.equal(sends(f).length,0);
});
test('legacy member home and dashboard core replace the service-role list completely',async()=>{
 const f=fixture(MEMBER_PILOT.userId);
 for(const path of ['/api/v1/filho/home','/api/v1/dashboard/core']){
  const response=await f.legacy(f.request('GET',undefined,path)),result=await response.json();assert.doesNotMatch(JSON.stringify(result),/legacy-must-be-replaced/);
  const rows=result.notices||result.resources.notices.data;assert.equal(rows.length,1);assert.equal(rows[0].id,id);
 }
});
test('inactive pilot member read denial does not expose the upstream legacy list',async()=>{
 const f=fixture(MEMBER_PILOT.userId);f.error({code:'42501'});const response=await f.legacy(f.request('GET',undefined,'/api/v1/filho/home'));assert.equal(response.status,403);assert.equal(f.calls.some(call=>call.service==='/api/v1/filho/home'),false);
});
