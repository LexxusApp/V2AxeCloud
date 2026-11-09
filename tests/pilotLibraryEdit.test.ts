import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePilotLibrary} from '../cloudflare/pilot-library.js';
import {PILOT_TENANT} from '../cloudflare/pilot-interface-policy.js';
import {MEMBER_PILOT} from '../cloudflare/member-pilot-policy.js';
import {createHash} from 'node:crypto';
const old='00000000-0000-4000-8000-000000000001',next='00000000-0000-4000-8000-000000000002';
const recipient='00000000-0000-4000-8000-000000000099',pdf='%PDF-1.4\nOriginal',replacement='%PDF-1.4\nReplacement';
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const path=(id:string)=>`${PILOT_TENANT}/private/${id}.pdf`;
const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
function fixture(actor=PILOT_TENANT){
 let rows:any[]=[{id:old,tenant_id:PILOT_TENANT,destinatario:MEMBER_PILOT.memberId,titulo:'Original',descricao:'',categoria:'Fundamentos',storage_path:path(old),sha256:sha(pdf),size_bytes:pdf.length,visibilidade:'individual',retired_at:null,previous_id:null}];
 const files=new Map([[path(old),pdf]]),calls:any[]=[];
 let lost=false,storageFail=false,rpcFail=false,ready=true,repeatPage=false;
 const env={API:{fetch:async(req:Request)=>{
  const p=new URL(req.url).pathname;
  if(p==='/api/public-config')return json({supabaseUrl:'https://unit.invalid',supabaseAnonKey:'test-public'});
  if(p==='/api/tenant-info')return json({tenant_id:PILOT_TENANT,role:actor===MEMBER_PILOT.userId?'filho':'admin',status:'active'});
  if(p==='/api/v1/filho/profile')return json({data:{id:MEMBER_PILOT.memberId,user_id:MEMBER_PILOT.userId,tenant_id:PILOT_TENANT,email:MEMBER_PILOT.email,status:'ativo'}});
  return json({data:[]});
 }}};
 const fetcher=async(input:any,init:any={})=>{
  const url=new URL(String(input)),method=init.method||'GET';calls.push({url,method,body:init.body});
  if(url.pathname==='/auth/v1/user')return json({id:actor,email:actor===MEMBER_PILOT.userId?MEMBER_PILOT.email:'vendasmercadolivrev1@gmail.com'});
  if(url.pathname==='/rest/v1/rpc/piloto_biblioteca_revisoes_disponiveis')return ready?json(1):json({},404);
  if(url.pathname==='/rest/v1/piloto_biblioteca_privada'){
   let result=rows;
   for(const key of ['id','storage_path']){const filter=url.searchParams.get(key);if(filter?.startsWith('eq.'))result=result.filter(row=>row[key]===filter.slice(3));if(filter?.startsWith('gt.')&&!repeatPage)result=result.filter(row=>row[key]>filter.slice(3));}
   return json([...result].sort((a,b)=>a.id.localeCompare(b.id)).slice(0,Number(url.searchParams.get('limit'))||1000));
  }
  if(url.pathname==='/rest/v1/rpc/piloto_referencias_membros')return json([{id:recipient}]);
  if(url.pathname.startsWith('/storage/v1/object/piloto_biblioteca_privada/')||url.pathname.startsWith('/storage/v1/object/authenticated/piloto_biblioteca_privada/')){
   const key=decodeURIComponent(url.pathname.split('/piloto_biblioteca_privada/')[1]);
   if(method==='POST'){
     assert.ok(url.pathname.startsWith('/storage/v1/object/piloto_biblioteca_privada/'),'Uploads must not use the authenticated download route');
    assert.equal(init.headers['x-upsert'],'false');
    if(storageFail)return json({},503);
    if(files.has(key))return json({},409);
    files.set(key,new TextDecoder().decode(init.body));return json({});
   }
   assert.ok(url.pathname.startsWith('/storage/v1/object/authenticated/piloto_biblioteca_privada/'),'Private downloads must use object.get_authenticated');
   return files.has(key)?new Response(files.get(key)):json({},404);
  }
  if(url.pathname==='/rest/v1/rpc/piloto_revisar_pdf'){
   const p=JSON.parse(init.body);if(rpcFail)return json({message:'commit refused'},409);
   const existing=rows.find(row=>row.id===p.p_id);
   if(!existing){
    const previous=rows.find(row=>row.id===p.p_previous);
    if(previous?.retired_at)return json({message:'stale revision'},409);
    if(previous)previous.retired_at='2026-11-03T13:00:00Z';
    rows.push({id:p.p_id,previous_id:p.p_previous,tenant_id:PILOT_TENANT,destinatario:p.p_destinatario,titulo:p.p_titulo,descricao:p.p_descricao,categoria:p.p_categoria,sha256:p.p_sha256,size_bytes:p.p_size,storage_path:path(p.p_id),visibilidade:p.p_visibilidade});
   }
   if(lost){lost=false;return json({message:'response lost'},503);}
   return json({id:p.p_id,previous_id:p.p_previous,visibilidade:p.p_visibilidade,replayed:!!existing});
  }
  throw Error('Unexpected mock URL: '+url.pathname);
 };
 const request=(route:string,method='GET',body?:BodyInit)=>new Request('https://axecloud.com.br/api/pilot/library/'+route,{method,headers:{Authorization:'Bearer test-session',Origin:'https://axecloud.com.br'},body});
 const edit=(options:any={})=>{const form=new FormData();Object.entries({id:next,previous:old,visibility:'individual',recipient,title:'Edited',description:'Description',category:'História',...options}).forEach(([key,value])=>{if(key!=='file')form.set(key,String(value));});if(options.file)form.set('file',new File([options.file],'replacement.pdf',{type:'application/pdf'}));return request('revisions','POST',form);};
 return{run:(req:Request)=>handlePilotLibrary(req,env,fetcher),request,edit,calls,files,get rows(){return rows;},setRows:(value:any[])=>rows=value,loseResponse:()=>lost=true,failStorage:()=>storageFail=true,failRpc:()=>rpcFail=true,disable:()=>ready=false,repeatPage:()=>repeatPage=true};
}
test('revision replaces bytes and recipient with one confirmed switch and preserves the old private object',async()=>{
 const f=fixture(),response=await f.run(f.edit({file:replacement}));assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.id,next);assert.equal(body.previous_id,old);
 assert.equal(f.files.get(path(old)),pdf);assert.equal(f.files.get(path(next)),replacement);
 assert.ok(f.rows[0].retired_at);assert.equal(f.rows[1].destinatario,recipient);
 assert.ok(f.calls.findIndex(c=>c.method==='POST'&&c.url.pathname.startsWith('/storage/'))<f.calls.findIndex(c=>c.url.pathname.endsWith('/piloto_revisar_pdf')));
 assert.equal(f.calls.some(c=>c.method==='PATCH'||c.method==='DELETE'),false);
 assert.equal(f.calls.some(c=>c.url.pathname.includes('service_role')||c.url.pathname.includes('biblioteca_estudos')),false);
});
test('metadata or scope revision copies the verified PDF to a new path and does not reuse comments',async()=>{
 const f=fixture(),result=await f.run(f.edit({visibility:'casa',recipient:''}));assert.equal(result.status,200);
 assert.equal(f.files.get(path(next)),pdf);assert.equal(f.rows[1].destinatario,null);assert.equal(f.rows[1].visibilidade,'casa');
 assert.equal(f.calls.some(c=>c.url.pathname.includes('comentarios')),false);
 const listed=await (await f.run(f.request('materials'))).json();assert.equal(listed.data.length,1);assert.equal(listed.data[0].id,next);assert.equal(listed.data[0].visibilidade,'casa');assert.deepEqual(listed.data[0].destinatarios,[]);
 assert.equal((await f.run(f.request('pdf-proxy?path='+encodeURIComponent(path(old))))).status,403);
});
test('failure before finalization never mutates the previous version or publishes unprotected metadata',async()=>{
 const f=fixture();f.failStorage();assert.equal((await f.run(f.edit({file:replacement}))).status,503);assert.equal(f.rows.length,1);assert.equal(f.rows[0].retired_at,null);assert.equal(f.calls.some(c=>c.url.pathname.endsWith('/piloto_revisar_pdf')),false);
 const g=fixture();g.failRpc();assert.equal((await g.run(g.edit({file:replacement}))).status,409);assert.equal(g.rows.length,1);assert.equal(g.rows[0].retired_at,null);assert.equal(g.files.get(path(old)),pdf);
});
test('response loss retries the same committed revision without duplicate storage or audience mutation',async()=>{
 const f=fixture();f.loseResponse();assert.equal((await f.run(f.edit())).status,503);assert.equal((await f.run(f.edit())).status,200);assert.equal(f.rows.length,2);
 assert.equal(f.calls.filter(c=>c.method==='POST'&&c.url.pathname.startsWith('/storage/')).length,1);
 assert.equal((await f.run(f.edit({title:'Changed after response loss'}))).status,409);assert.equal(f.rows[1].titulo,'Edited');
});
test('legacy conversion, unavailable migration, member writes, stale edit and mismatched staged bytes fail closed',async()=>{
 const f=fixture();f.setRows([]);assert.equal((await f.run(f.edit({file:replacement}))).status,409);assert.equal(f.calls.some(c=>c.method==='POST'&&c.url.pathname.startsWith('/storage/')),false);
 const g=fixture();g.disable();assert.equal((await g.run(g.edit())).status,409);assert.equal(g.calls.some(c=>c.url.pathname.includes('/storage/')),false);
 const m=fixture(MEMBER_PILOT.userId);assert.equal((await m.run(m.edit())).status,403);assert.equal(m.calls.some(c=>c.url.pathname.includes('/piloto_biblioteca_privada')||c.url.pathname.startsWith('/storage/')),false);
 const stale=fixture();stale.rows[0].retired_at='retired';assert.equal((await stale.run(stale.edit())).status,409);
 const collision=fixture();collision.files.set(path(next),replacement);assert.equal((await collision.run(collision.edit())).status,503);assert.equal(collision.rows[0].retired_at,null);
});
test('private listing uses a strict cursor across 1,001 rows and rejects repeated pages instead of returning a partial list',async()=>{
 const rows=Array.from({length:1001},(_,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,tenant_id:PILOT_TENANT,storage_path:path(old)}));
 const f=fixture();f.setRows(rows);const result=await (await f.run(f.request('materials'))).json();assert.equal(result.data.length,1001);assert.equal(f.calls.filter(c=>c.url.pathname==='/rest/v1/piloto_biblioteca_privada').length,3);
 const bad=fixture();bad.setRows(rows);bad.repeatPage();const response=await bad.run(bad.request('materials'));assert.equal(response.status,503);assert.equal((await response.json()).data,undefined);
});
test('an account outside the approved pilot cannot access another house private library',async()=>{
 const miriamId='a90db681-e55f-4668-8715-34e23ffbb591';
 const miriamEmail='miriambarbosa222@yahoo.com.br';
 const miriamPath=`${miriamId}/private/${old}.pdf`;
 const rows:any[]=[{id:old,tenant_id:miriamId,destinatario:recipient,titulo:'Miriam Material',descricao:'',categoria:'Fundamentos',storage_path:miriamPath,sha256:sha(pdf),size_bytes:pdf.length,visibilidade:'individual',retired_at:null,previous_id:null}];
 const env={API:{fetch:async(req:Request)=>{
  const u=new URL(req.url);
  if(u.pathname==='/api/public-config')return json({supabaseUrl:'https://unit.invalid',supabaseAnonKey:'test-public'});
  if(u.pathname==='/api/tenant-info')return json({tenant_id:miriamId,id:miriamId,role:'admin',status:'active'});
  if(u.pathname==='/api/v1/library/materials'){
   assert.equal(u.searchParams.get('tenantId'),miriamId);
   return json({data:[{id:'legacy-1',titulo:'Legacy material'}]});
  }
  return json({data:[]});
 }}};
 const fetcher=async(input:any)=>{
  const url=new URL(String(input));
  if(url.pathname==='/auth/v1/user')return json({id:miriamId,email:miriamEmail});
  if(url.pathname==='/rest/v1/rpc/piloto_biblioteca_revisoes_disponiveis')return json(1);
  if(url.pathname==='/rest/v1/piloto_biblioteca_privada'){
   assert.equal(url.searchParams.get('tenant_id'),'eq.'+miriamId);
   return json(rows);
  }
  throw Error('Unexpected mock URL: '+url.pathname);
 };
 const req=new Request('https://axecloud.com.br/api/pilot/library/materials?tenantId='+miriamId,{headers:{Authorization:'Bearer miriam-token',Origin:'https://axecloud.com.br'}});
 const res=await handlePilotLibrary(req,env,fetcher);
 assert.equal(res.status,403);
 assert.equal(rows.length,1);
});
