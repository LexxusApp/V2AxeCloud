import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handlePilotLibrary} from '../cloudflare/pilot-library.js';
import {PILOT_EMAIL,PILOT_TENANT} from '../cloudflare/pilot-interface-policy.js';
import {MEMBER_PILOT} from '../cloudflare/member-pilot-policy.js';
import {memberPresentationPlugin} from '../scripts/build-member-pilot.mjs';
const id='cda9b504-35d5-4c99-a48a-f72e382e34fe';
const path=PILOT_TENANT+'/private/'+id+'.pdf',pdf='%PDF-1.4\ntechnical test';
const json=(value:any,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function fixture(actor=PILOT_TENANT){
 const calls:any[]=[];let base:any={data:[]},rows:any[]=[],storageFailures=0,finalizeFail=false;
 const env={API:{fetch:async(request:Request)=>{const url=new URL(request.url);calls.push({service:url.pathname});if(url.pathname==='/api/public-config')return json({supabaseUrl:'https://test.invalid',supabaseAnonKey:'public-test-key'});if(url.pathname==='/api/tenant-info')return json(actor===MEMBER_PILOT.userId?{tenant_id:PILOT_TENANT,role:'filho'}:{tenant_id:PILOT_TENANT,role:'admin',status:'active'});if(url.pathname==='/api/v1/filho/profile')return json({data:{id:MEMBER_PILOT.memberId,user_id:MEMBER_PILOT.userId,tenant_id:PILOT_TENANT,email:MEMBER_PILOT.email,status:'Ativo'}});if(url.pathname==='/api/v1/library/materials')return json(base);return new Response('legacy-pdf');}}};
 const fetcher=async(input:any,init:any={})=>{
  const url=new URL(String(input)),method=init.method||'GET';calls.push({path:url.pathname,method,body:init.body});
  if(url.pathname==='/auth/v1/user')return json({id:actor,email:actor===MEMBER_PILOT.userId?MEMBER_PILOT.email:PILOT_EMAIL});
  if(url.pathname==='/rest/v1/filhos_de_santo')return json([{id:MEMBER_PILOT.memberId}]);
  if(url.pathname==='/rest/v1/piloto_biblioteca_privada'){
   if(method==='DELETE'){rows=[];return json([]);}return json(rows);
  }
  if(url.pathname==='/rest/v1/rpc/piloto_finalizar_pdf'){
   const input=JSON.parse(init.body);rows=[{id,tenant_id:PILOT_TENANT,destinatario:input.p_destinatario,titulo:input.p_titulo,descricao:input.p_descricao,categoria:input.p_categoria,sha256:input.p_sha256,storage_path:path,size_bytes:pdf.length}];
   if(finalizeFail){finalizeFail=false;return json({message:'Response lost after commit'},503);}return json({id,visibilidade:'individual'});
  }
  if(url.pathname.startsWith('/storage/v1/object/')){if(storageFailures>0){storageFailures--;return json({error:'Storage failed'},500);}return method==='GET'?new Response(pdf):json({});}
  throw Error('Unexpected request: '+url.pathname);
 };
 const run=(request:Request)=>handlePilotLibrary(request,env,fetcher);
 const request=(route:string,method='GET',body?:BodyInit)=>new Request('https://axecloud.com.br/api/pilot/library/'+route,{method,headers:{Authorization:'Bearer fixture-only',Origin:'https://axecloud.com.br'},body});
 const upload=(text=pdf)=>{const form=new FormData();form.set('id',id);form.set('recipient',MEMBER_PILOT.memberId);form.set('title','Private test');form.set('description','Technical description');form.set('category','Fundamentos');form.set('file',new File([text],'test.pdf',{type:'application/pdf'}));return request('private','POST',form);};
 return {run,request,upload,calls,setRows:(value:any[])=>rows=value,setBase:(value:any)=>base=value,setStorageFail:()=>storageFailures=100,setTransientStorageFail:()=>storageFailures=1,setFinalizeFail:()=>finalizeFail=true};
}
test('private library requires a verified pilot identity and the exact house before data access',async()=>{
 const f=fixture();assert.equal((await f.run(new Request('https://axecloud.com.br/api/pilot/library/materials'))).status,401);assert.equal(f.calls.length,0);
 const other=fixture('another-user');assert.equal((await other.run(other.request('materials'))).status,403);
 assert.equal((await f.run(f.request('materials?tenantId=another-house'))).status,403);
 assert.equal(f.calls.some(c=>c.path?.includes('piloto_biblioteca_privada')),false);
});
test('private library merges actual rows, preserves the public acervo and omits recipient identities from member responses',async()=>{
 const f=fixture(MEMBER_PILOT.userId);f.setBase({data:[{id:'public',titulo:'Original material'}]});f.setRows([{id,tenant_id:PILOT_TENANT,destinatario:MEMBER_PILOT.memberId,titulo:'Private',storage_path:path}]);
 const response=await f.run(f.request('materials?tenantId='+PILOT_TENANT)),body=await response.json();assert.equal(response.status,200);assert.equal(body.data.length,2);assert.equal(body.data[0].visibilidade,'individual');assert.equal(body.data[0].destinatarios,undefined);assert.equal(body.data[1].id,'public');assert.equal(body.capabilities.privatePilot,true);
 f.setBase({data:{}});assert.equal((await f.run(f.request('materials'))).status,503);
});
test('private upload validates PDF signature and server confirmation, retries without overwriting or duplicating',async()=>{
 const f=fixture();assert.equal((await f.run(f.upload('not a PDF'))).status,400);assert.equal(f.calls.some(c=>c.path?.startsWith('/storage/')),false);
 f.setFinalizeFail();assert.equal((await f.run(f.upload())).status,503);
 const retry=await f.run(f.upload());assert.equal(retry.status,200);assert.equal((await retry.json()).id,id);
 assert.equal(f.calls.filter(c=>c.path?.startsWith('/storage/')&&c.method==='POST').length,1);
 const mismatch=await f.run(f.upload(pdf+'different'));assert.equal(mismatch.status,409);assert.equal(f.calls.filter(c=>c.path?.startsWith('/storage/')&&c.method==='POST').length,1);
});
test('private download checks row authorization and never reuses the legacy bucket for a private PDF',async()=>{
 const f=fixture(MEMBER_PILOT.userId);assert.equal((await f.run(f.request('pdf-proxy?path='+encodeURIComponent(path)))).status,403);
 f.setRows([{id,titulo:'Private test',storage_path:path}]);const response=await f.run(f.request('pdf-proxy?path='+encodeURIComponent(path)));assert.equal(response.status,200);assert.equal(await response.text(),pdf);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Content-Length'),String(pdf.length));assert.match(response.headers.get('Content-Disposition')||'',/Private%20test\.pdf/);
 assert.ok(f.calls.some(c=>c.path?.includes('/piloto_biblioteca_privada/')));assert.equal(f.calls.some(c=>c.service==='/api/v1/library/pdf-proxy'),false);
 await f.run(f.request('pdf-proxy?path=public-house/acervo/file.pdf'));assert.equal(f.calls.at(-1).service,'/api/v1/library/pdf-proxy');
});
test('private PDF download retries one transient storage failure before showing an error',async()=>{
 const f=fixture();f.setRows([{id,titulo:'Private test',storage_path:path}]);f.setTransientStorageFail();
 const response=await f.run(f.request('pdf-proxy?path='+encodeURIComponent(path)));
 assert.equal(response.status,200);assert.equal(await response.text(),pdf);
 assert.equal(f.calls.filter(c=>c.path?.includes('/piloto_biblioteca_privada/')).length,2);
});
test('private deletion is manager-only and does not remove the row if storage deletion is unconfirmed',async()=>{
 const member=fixture(MEMBER_PILOT.userId);assert.equal((await member.run(member.request('private/'+id,'DELETE'))).status,403);
 const f=fixture();f.setRows([{id,storage_path:path}]);f.setStorageFail();assert.equal((await f.run(f.request('private/'+id,'DELETE'))).status,503);assert.equal(f.calls.some(c=>c.path==='/rest/v1/piloto_biblioteca_privada'&&c.method==='DELETE'),false);
 const good=fixture();good.setRows([{id,storage_path:path}]);assert.equal((await good.run(good.request('private/'+id,'DELETE'))).status,200);assert.equal((await good.run(good.request('private/'+id,'DELETE'))).status,200);assert.equal(good.calls.filter(c=>c.path==='/storage/v1/object/piloto_biblioteca_privada'&&c.method==='DELETE').length,1);
});
test('only the member pilot build rewrites the actual library list and authenticated PDF sources',()=>{
 const plugin=memberPresentationPlugin();
 for(const file of ['src/views/Library.tsx','src/components/library/AuthenticatedPdfFrame.tsx','src/lib/libraryDownload.ts']){
  const original=readFileSync(file,'utf8'),transformed=plugin.transform(original,file);assert.ok(transformed?.includes('/api/pilot/library/pdf-proxy'));assert.ok(!transformed?.includes('/api/v1/library/pdf-proxy'));
 }
 assert.equal(plugin.transform("fetch('/api/v1/library/materials')",'src/views/Other.tsx'),undefined);
});
