import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePilotNotices} from '../cloudflare/pilot-notices.js';
import {handlePilotRadar} from '../cloudflare/pilot-radar.js';

const manager='11111111-1111-4111-8111-111111111111';
const foreign='22222222-2222-4222-8222-222222222222';
const json=(value:any,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});

function fixture(role='zelador'){
 const calls:any[]=[];
 const token='mock.'+btoa(JSON.stringify({sub:manager}))+'.mock';
 const env={
  PILOT_OPERATION_ROLLOUT_MODE:'managers',
  API:{fetch:async(request:Request)=>{
   const path=new URL(request.url).pathname;calls.push({api:path});
   if(path==='/api/public-config')return json({supabaseUrl:'https://rollout.invalid',supabaseAnonKey:'public-mock'});
   if(path==='/api/tenant-info')return json({id:manager,tenant_id:manager,role,status:'regular',is_blocked:false});
   throw Error('Unexpected API call: '+path);
  }}
 };
 const fetcher=async(input:any,init:any={})=>{
  const path=new URL(String(input)).pathname,body=init.body?JSON.parse(init.body):null;calls.push({path,body,headers:init.headers});
  if(path==='/auth/v1/user')return json({id:manager,email:'another-manager@example.test'});
  if(path.endsWith('/piloto_comunicados_listar'))return json({data:[]});
  if(path.endsWith('/piloto_radar_ler'))return json({profile:null,revision:0});
  throw Error('Unexpected database call: '+path);
 };
 const request=(path:string)=>new Request('https://axecloud.com.br'+path,{headers:{Authorization:'Bearer '+token,Origin:'https://axecloud.com.br'}});
 return {calls,env,fetcher,request};
}

test('manager operation rollout authorizes another active manager on notices and Radar',async()=>{
 const notices=fixture();
 const noticeResponse=await handlePilotNotices(notices.request('/api/pilot/notices?tenantId='+manager),notices.env,notices.fetcher);
 assert.equal(noticeResponse?.status,200);
 assert.equal(notices.calls.find(call=>call.path?.endsWith('/piloto_comunicados_listar'))?.body.p_tenant,manager);

 const radar=fixture();
 const radarResponse=await handlePilotRadar(radar.request('/api/pilot/radar?tenantId='+manager),radar.env,radar.fetcher);
 assert.equal(radarResponse?.status,200);
 assert.equal(radar.calls.find(call=>call.path?.endsWith('/piloto_radar_ler'))?.body.p_tenant,manager);
});

test('manager operation rollout rejects members and cross-tenant requests before an RPC',async()=>{
 for(const path of ['/api/pilot/notices','/api/pilot/radar']){
  const member=fixture('member');
  const response=path.includes('notices')
   ?await handlePilotNotices(member.request(path),member.env,member.fetcher)
   :await handlePilotRadar(member.request(path),member.env,member.fetcher);
  assert.equal(response?.status,403);
  assert.equal(member.calls.some(call=>call.path?.includes('/rpc/')),false);

  const crossed=fixture();
  const crossedResponse=path.includes('notices')
   ?await handlePilotNotices(crossed.request(path+'?tenantId='+foreign),crossed.env,crossed.fetcher)
   :await handlePilotRadar(crossed.request(path+'?tenantId='+foreign),crossed.env,crossed.fetcher);
  assert.equal(crossedResponse?.status,403);
  assert.equal(crossed.calls.some(call=>call.path?.includes('/rpc/')),false);
 }
});
