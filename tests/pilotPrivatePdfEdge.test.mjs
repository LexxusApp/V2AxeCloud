import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePilotPrivatePdfEdge} from '../cloudflare/pilot-private-pdf-edge.js';
const tenant='fad75b91-d2eb-4805-b5a3-c19e8a073bed',id='a1ad0338-e32e-4205-a95a-3998c5841157';
const path=tenant+'/private/'+id+'.pdf';
const env={VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_ANON_KEY:'public-anon',SUPABASE_SERVICE_ROLE_KEY:'private-service'};
const req=(params=path,method='GET',authorization='Bearer verified-user-token')=>new Request('https://axecloud.com.br/api/v1/_pilot_private_pdf_fetch?tenantId='+tenant+'&path='+encodeURIComponent(params),{method,headers:{Authorization:authorization}});
const proxyReq=(params=path,method='GET',authorization='Bearer verified-user-token')=>new Request('https://axecloud.com.br/api/v1/library/pdf-proxy?tenantId='+tenant+'&path='+encodeURIComponent(params),{method,headers:{Authorization:authorization}});
const bytes=new TextEncoder().encode('%PDF-1.7\nprivate-pdf-fixture');
function deps({allowed=true,rows=true,storageOk=true,validUser=true}={}){
 const counters={meta:0,permission:0,download:0};
 const mockClient=(base,key,options)=>{
  if(key==='private-service')return{auth:{getUser:async()=>({data:{user:validUser?{id:'user'}:null},error:validUser?null:{message:'invalid'}})}};
  assert.equal(key,'public-anon');assert.equal(options.global.headers.Authorization,'Bearer verified-user-token');
  return{from:()=>({select:()=>({eq:()=>({eq:()=>({limit:async()=>{counters.meta++;return {data:rows?[{id,titulo:'Grimorium',storage_path:path,retired_at:null}]:[],error:null}}})})})}),
   rpc:async()=>{counters.permission++;return {data:allowed,error:null}}};
 };
 const fetcher=async(url,opts)=>{
  counters.download++;
  assert.equal(opts.headers.Authorization,'Bearer private-service');
  assert.ok(url.includes('/storage/v1/object/authenticated/piloto_biblioteca_privada/'));
  return storageOk?new Response(bytes,{status:200,headers:{'content-length':String(bytes.length)}}):new Response('missing',{status:400});
 };
 return {mockClient,fetcher,counters};
}
test('authorized member can retrieve only their checked PDF through server-side credential',async()=>{
 const t=deps();
 const r=await handlePilotPrivatePdfEdge(req(),env,t.mockClient,t.fetcher);
 assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/pdf');
 assert.equal(r.headers.get('cache-control'),'private,no-store');
 assert.equal(r.headers.get('x-axecloud-pdf-source'),'authorized-storage');
 assert.equal((await r.arrayBuffer()).byteLength,bytes.length);
 assert.deepEqual(t.counters,{meta:1,permission:1,download:1});
});
test('v1 pdf-proxy edge handler transparently serves pilot private pdf',async()=>{
 const t=deps();
 const r=await handlePilotPrivatePdfEdge(proxyReq(),env,t.mockClient,t.fetcher);
 assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/pdf');
 assert.equal(r.headers.get('accept-ranges'),'bytes');
 assert.equal(r.headers.get('x-axecloud-pdf-source'),'authorized-storage');
 assert.deepEqual(t.counters,{meta:1,permission:1,download:1});
});
test('v1 pdf-proxy returns null for non-pilot paths so container can handle them',async()=>{
 const t=deps();
 const r=await handlePilotPrivatePdfEdge(new Request('https://axecloud.com.br/api/v1/library/pdf-proxy?tenantId='+tenant+'&path=other/biblioteca/doc.pdf',{headers:{Authorization:'Bearer verified-user-token'}}),env,t.mockClient,t.fetcher);
 assert.equal(r,null);
 assert.equal(t.counters.download,0);
});
test('unauthorized document cannot reach Storage service credential',async()=>{
 const t=deps({allowed:false});
 const r=await handlePilotPrivatePdfEdge(req(),env,t.mockClient,t.fetcher);
 assert.equal(r.status,403);assert.equal(t.counters.download,0);
});
test('member with no accessible metadata cannot reach Storage',async()=>{
 const t=deps({rows:false});
 const r=await handlePilotPrivatePdfEdge(req(),env,t.mockClient,t.fetcher);
 assert.equal(r.status,403);assert.equal(t.counters.download,0);
});
test('missing login or invalid tenant/path is rejected before service access',async()=>{
 for(const request of [
  req(path,'GET',''),req('other/private/file.pdf'),
  new Request('https://axecloud.com.br/api/v1/_pilot_private_pdf_fetch?tenantId='+tenant+'&tenantId='+tenant+'&path='+encodeURIComponent(path),{headers:{Authorization:'Bearer verified-user-token'}}),
  req(path,'POST')
 ]){
  const t=deps();
  const r=await handlePilotPrivatePdfEdge(request,env,t.mockClient,t.fetcher);
  assert.ok([401,403,405].includes(r.status));
  assert.equal(t.counters.download,0);
 }
});
test('invalid JWT is rejected before metadata read',async()=>{
 const t=deps({validUser:false});
 const r=await handlePilotPrivatePdfEdge(req(),env,t.mockClient,t.fetcher);
 assert.equal(r.status,401);assert.equal(t.counters.meta,0);assert.equal(t.counters.download,0);
});
