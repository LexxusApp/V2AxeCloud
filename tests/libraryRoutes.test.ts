import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { registerLibraryRoutes } from '../api/lib/libraryRoutes.ts';

const house='10000000-0000-4000-8000-000000000001', alias='10000000-0000-4000-8000-000000000002', outside='10000000-0000-4000-8000-000000000003';
const child='20000000-0000-4000-8000-000000000001', sibling='20000000-0000-4000-8000-000000000002', other='20000000-0000-4000-8000-000000000003';
const childAuth='30000000-0000-4000-8000-000000000001', siblingAuth='30000000-0000-4000-8000-000000000002', otherAuth='30000000-0000-4000-8000-000000000003';
async function setup(t:any) {
  const tables:Record<string,any[]>={
    perfil_lider:[{id:house,tenant_id:alias,is_admin_global:false},{id:outside,tenant_id:outside},{id:childAuth,tenant_id:house,is_admin_global:false}],
    filhos_de_santo:[{id:child,user_id:childAuth,tenant_id:alias,lider_id:house},{id:sibling,user_id:siblingAuth,tenant_id:house,lider_id:house},{id:other,user_id:otherAuth,tenant_id:outside,lider_id:outside}],
    biblioteca:[{id:'private',tenant_id:house,titulo:'Privado',categoria:'Fundamentos',storage_path:house+'/private.pdf',arquivo_url:'https://old.invalid/signed.pdf',visibilidade:'individual',destinatarios:[child]}, {id:'shared',tenant_id:house,titulo:'Compartilhado',storage_path:house+'/shared.pdf',arquivo_url:'https://old.invalid/shared.pdf',visibilidade:'casa',destinatarios:[]}],
  };
  const users:any={owner:{id:house,email:'owner@example.invalid'},member:{id:childAuth,email:'member@example.invalid'},sibling:{id:siblingAuth,email:'sibling@example.invalid'},outside:{id:otherAuth,email:'outside@example.invalid'}};
  const tokens=new Map<string,any>(); const headers:any={};
  for(const [role,user] of Object.entries(users)){const token=randomUUID();tokens.set(token,user);headers[role]={authorization:'Bearer '+token,'Content-Type':'application/json'};}
  const calls={downloads:[] as string[],signed:0,removed:0,rpc:[] as any[]};
  let pdfValid=true, rpcResult:any={data:{id:'saved',visibilidade:'individual'},error:null}, removeError:any=null;
  const sb:any={auth:{getUser:async(token:string)=>({data:{user:tokens.get(token)||null},error:null}),admin:{getUserById:async(id:string)=>({data:{user:Object.values(users).find((u:any)=>u.id===id)||null}})}},
    from(table:string){let rows=[...(tables[table]||[])],columns='*',deleting=false;
      const result=()=>rows.map(row=>columns==='*'?row:Object.fromEntries(columns.split(',').map(key=>[key.trim(),row[key.trim()]])));
      const finish=()=>{if(deleting) tables[table]=tables[table].filter(row=>!rows.includes(row));return {data:result(),error:null};};
      const q:any={select:(value:string)=>{columns=value;return q;},eq:(key:string,value:any)=>{rows=rows.filter(row=>row[key]===value);return q;},in:(key:string,values:any[])=>{rows=rows.filter(row=>values.includes(row[key]));return q;},
        or:(value:string)=>{rows=rows.filter(row=>value.split(',').some(part=>{const[key,,val]=part.split('.');return String(row[key])===val;}));return q;},order:()=>q,range:(from:number,to:number)=>{rows=rows.slice(from,to+1);return q;},delete:()=>{deleting=true;return q;},
        maybeSingle:async()=>({data:result()[0]||null,error:null}),then:(resolve:any)=>Promise.resolve(finish()).then(resolve)};return q;},
    storage:{from:()=>({createSignedUploadUrl:async()=>{calls.signed++;return {data:{token:'upload-test'},error:null};},download:async(path:string)=>{calls.downloads.push(path);return {data:new Blob([pdfValid?'%PDF-1.7\nTest-only document':'<html>not a pdf</html>']),error:null};},remove:async()=>{calls.removed++;return {data:[],error:removeError};}})},
    rpc:async(name:string,args:any)=>{calls.rpc.push({name,args});return rpcResult;},
  };
  const app=express();app.use(express.json());registerLibraryRoutes(app,{supabaseAdmin:sb,slugifyStoragePath:value=>String(value).replace(/[^a-zA-Z0-9._-]/g,'-')});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  return {calls,tables,request:(route:string,role='owner',options:RequestInit={})=>fetch(base+route,{...options,headers:headers[role]||{}}),setPdf:(valid:boolean)=>{pdfValid=valid;},setRpc:(value:any)=>{rpcResult=value;},setRemoveError:(value:any)=>{removeError=value;}};
}
const list='/api/v1/library/materials?tenantId='+house;
test('listagem exige sessão/casa e entrega somente materiais autorizados, sem links reutilizáveis nem outros destinatários',async t=>{
  const f=await setup(t);assert.equal((await f.request(list,'anonymous')).status,401);
  let response=await f.request(list,'member');assert.equal(response.status,200);let json=await response.json();
  assert.equal(json.data.length,2);assert.equal(json.capabilities.individualAudience,true);assert.ok(json.data.every((row:any)=>!row.arquivo_url&&!('destinatarios' in row)));
  json=await(await f.request(list,'sibling')).json();assert.deepEqual(json.data.map((row:any)=>row.id),['shared']);
  assert.equal((await f.request(list,'outside')).status,403);assert.equal(f.calls.signed,0);
});
test('proxy entrega o PDF ao destinatário; bloqueia irmão/outra casa, caminho não cadastrado e travessia antes de ler bytes',async t=>{
  const f=await setup(t), endpoint=(path:string,tenant=house)=>'/api/v1/library/pdf-proxy?path='+encodeURIComponent(path)+'&tenantId='+tenant;
  let response=await f.request(endpoint(house+'/private.pdf',alias),'member');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(await response.text(),/^%PDF-/);
  const reads=f.calls.downloads.length;
  for(const [path,role] of [[house+'/private.pdf','sibling'],[house+'/shared.pdf','outside'],[house+'/unknown.pdf','member'],[house+'/../secret.pdf','owner']]) assert.equal((await f.request(endpoint(path),role)).status,403);
  assert.equal(f.calls.downloads.length,reads);
  assert.equal((await f.request(endpoint(house+'/private.pdf',childAuth),'member')).status,200); // legacy tenant cache
});
test('somente gestão prepara upload e exclui material, mesmo quando o membro tem perfil fantasma',async t=>{
  const f=await setup(t), body=JSON.stringify({tenantId:house,fileName:'livro.pdf',contentType:'application/pdf',categoria:'Fundamentos'});
  assert.equal((await f.request('/api/v1/library/upload-url','member',{method:'POST',body})).status,403);
  const response=await f.request('/api/v1/library/upload-url','owner',{method:'POST',body});assert.equal(response.status,200);const data=await response.json();assert.equal(data.audienceVersion,1);assert.match(data.path,/\/acervo\/Fundamentos\/[0-9a-f-]{36}_livro.pdf$/);
  assert.equal((await f.request('/api/v1/library/material/private?tenantId='+house,'member',{method:'DELETE'})).status,403);assert.equal(f.calls.removed,0);
  f.setRemoveError({message:'storage failure'});assert.equal((await f.request('/api/v1/library/material/private?tenantId='+house,'owner',{method:'DELETE'})).status,500);assert.equal(f.tables.biblioteca.length,2);
});
test('finalização valida público e PDF e só confirma quando o banco devolve um registro persistido',async t=>{
  const f=await setup(t), body={tenantId:house,storagePath:house+'/new.pdf',titulo:'Acervo privado',categoria:'Fundamentos',visibilidade:'individual',destinatarios:[child]};
  const post=(changes:any={})=>f.request('/api/v1/library/complete-upload','owner',{method:'POST',body:JSON.stringify({...body,...changes})});
  assert.equal((await post({destinatarios:[]})).status,400);assert.equal((await post({destinatarios:[other]})).status,400);assert.equal(f.calls.rpc.length,0);
  f.setPdf(false);assert.equal((await post()).status,400);f.setPdf(true);
  f.setRpc({data:null,error:null});assert.equal((await post()).status,500);
  f.setRpc({data:null,error:{code:'23505',message:'arquivo já publicado'}});assert.equal((await post()).status,409);
  f.setRpc({data:{id:'saved',visibilidade:'individual'},error:null});const response=await post();assert.equal(response.status,200);assert.equal((await response.json()).id,'saved');
  assert.equal(f.calls.rpc.at(-1).name,'finalizar_material_biblioteca');assert.deepEqual(f.calls.rpc.at(-1).args.p_recipients,[child]);
});
test('material legado com somente URL assinada continua disponível através do proxy autenticado',async t=>{
  const f=await setup(t);
  f.tables.biblioteca.push({id:'legacy',tenant_id:alias,titulo:'Legado',arquivo_url:'https://storage.invalid/storage/v1/object/sign/biblioteca_estudos/'+house+'/legado.pdf?token=old',storage_path:null,visibilidade:'casa'});
  const json=await(await f.request(list,'member')).json();
  const row=json.data.find((item:any)=>item.id==='legacy');assert.equal(row.storage_path,house+'/legado.pdf');assert.equal(row.arquivo_url,'');
  const response=await f.request('/api/v1/library/pdf-proxy?tenantId='+alias+'&path='+encodeURIComponent(row.storage_path),'member');
  assert.equal(response.status,200);assert.match(await response.text(),/^%PDF-/);
});
