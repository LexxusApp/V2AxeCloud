import {PILOT_TENANT} from './pilot-interface-policy.js';
import {MEMBER_PILOT} from './member-pilot-policy.js';
import {requirePilotOperationAccess} from './pilot-operation-access.js';
const BUCKET='piloto_biblioteca_privada',MAX=20*1024*1024;
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',value))).map(n=>n.toString(16).padStart(2,'0')).join('');
export async function handlePilotLibrary(request,env,fetcher=fetch){
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/pilot/library/'))return null;
 try{
  const {user,config,headers,authorization,manager,profile,member,tenantId}=await requirePilotOperationAccess(request,env,fetcher,{allowMember:true});
  const callerTenant=(tenantId||profile?.tenant_id||(manager?user.id:(member?.tenant_id||member?.tenantId||PILOT_TENANT))).trim().toLowerCase();
  if(!['GET','HEAD'].includes(request.method)&&!manager)throw fail('Somente a zeladoria pode alterar o acervo.',403);
  if(!['GET','HEAD'].includes(request.method)&&!['https://axecloud.com.br','http://localhost:5188'].includes(request.headers.get('origin')))throw fail('Origem da solicitação inválida.',403);
  const sb=async(path,init={})=>fetcher(config.supabaseUrl+path,{...init,headers:{...headers,...init.headers}});
  const data=async response=>{const value=await response.json().catch(()=>null);if(!response.ok)throw fail(value?.message||value?.error||'O serviço não confirmou a operação.',response.status>=500?503:response.status);return value;};
  const rowFor=async(key,value)=>{const query=new URLSearchParams({select:'*',tenant_id:'eq.'+callerTenant,[key]:'eq.'+value});const rows=await data(await sb('/rest/v1/piloto_biblioteca_privada?'+query));if(!Array.isArray(rows))throw fail('Resposta inválida do acervo privado.',503);return rows[0];};
  // Uploads use the object endpoint, but downloads from this private bucket
  // must use the authenticated endpoint (storage policy object.get_authenticated).
  const storagePath=path=>'/storage/v1/object/'+BUCKET+'/'+path.split('/').map(encodeURIComponent).join('/');
  const storageReadPath=path=>'/storage/v1/object/authenticated/'+BUCKET+'/'+path.split('/').map(encodeURIComponent).join('/');
  const serviceKey=env?.SUPABASE_SERVICE_ROLE_KEY;
  const storageRead=async(path,init={})=>{
   const readHeaders=serviceKey
    ? {'apikey':serviceKey,'Authorization':'Bearer '+serviceKey,...init.headers}
    : {...headers,...init.headers};
   return fetcher(config.supabaseUrl+storageReadPath(path),{...init,headers:readHeaders});
  };
  const revisionReady=async()=>{try{const response=await sb('/rest/v1/rpc/piloto_biblioteca_revisoes_disponiveis');return response.ok&&await response.json()===1;}catch{return false;}};
  const privateList=async()=>{
   const result=[];let cursor='';
   for(let page=0;page<200;page++){
    const query=new URLSearchParams({select:'*',tenant_id:'eq.'+callerTenant,order:'id.asc',limit:'500'});if(cursor)query.set('id','gt.'+cursor);
    const rows=await data(await sb('/rest/v1/piloto_biblioteca_privada?'+query));
    if(!Array.isArray(rows))throw fail('Resposta inválida do acervo privado.',503);
    for(const row of rows){if(!uuid(row.id)||row.id<=cursor)throw fail('Não foi possível continuar a consulta com segurança.',503);cursor=row.id;result.push(row);}
    if(rows.length<500)return result;
   }
   throw fail('A consulta excedeu o limite seguro. Nenhum resultado parcial foi exibido.',503);
  };
  if(url.pathname==='/api/pilot/library/materials'&&request.method==='GET'){
   const old=new URL(request.url);old.pathname='/api/v1/library/materials';old.searchParams.set('tenantId',callerTenant);
   const [base,privateRows,revisions]=await Promise.all([env.API.fetch(new Request(old,{headers:{Authorization:authorization}})).then(data),privateList(),revisionReady()]);
   if(!Array.isArray(base?.data)||!Array.isArray(privateRows))throw fail('Não foi possível confirmar os materiais do acervo.',503);
   const extra=privateRows.filter(row=>!row.retired_at).map(row=>({id:row.id,tenant_id:row.tenant_id,titulo:row.titulo,descricao:row.descricao,categoria:row.categoria,
    created_at:row.created_at,updated_at:row.updated_at,size_bytes:row.size_bytes,storage_path:row.storage_path,
    arquivo_url:'/api/pilot/library/pdf-proxy?'+new URLSearchParams({tenantId:callerTenant,path:row.storage_path}),
    visibilidade:row.visibilidade||'individual',...(manager?{destinatarios:row.destinatario?[row.destinatario]:[]}:{}),private_pilot:true}));
   return json({data:[...extra,...base.data],capabilities:{...base.capabilities,individualAudience:true,authenticatedDownloads:true,privatePilot:true,revisionEditing:revisions,legacyRevisionEditing:false}});
  }
  if(url.pathname==='/api/pilot/library/revisions'&&request.method==='POST'){
   if(!await revisionReady())throw fail('A edição protegida aguarda a revisão e ativação da migração do piloto.',409);
   if(Number(request.headers.get('content-length'))>MAX+65536)throw fail('O PDF deve ter até 20 MB.',413);
   const form=await request.formData(),id=form.get('id'),previous=form.get('previous')||null,visibility=form.get('visibility'),recipient=form.get('recipient')||null;
   const title=String(form.get('title')||'').trim(),description=String(form.get('description')||''),category=String(form.get('category')||'');
   if(!uuid(id)||(previous!==null&&!uuid(previous))||id===previous||!['casa','individual'].includes(visibility)||
    (visibility==='individual'?!uuid(recipient):recipient!==null)||!title||title.length>300||description.length>4000||!['Cantigas','História','Ervas','Orixás','Fundamentos'].includes(category))throw fail('Confira os dados e o destinatário do material.');
   const existing=await rowFor('id',id),prior=previous?await rowFor('id',previous):null;
   if(previous&&!prior)throw fail('Este material não é uma revisão protegida do piloto. O acervo legado exige revogação prévia dos links.',409);
   if(prior?.retired_at&&!existing)throw fail('Este material já foi alterado. Atualize o acervo antes de editar novamente.',409);
   if(recipient){const recipients=await data(await sb('/rest/v1/rpc/piloto_referencias_membros',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_tenant:callerTenant})}));if(!Array.isArray(recipients)||!recipients.some(row=>row.id===recipient))throw fail('O destinatário não pertence a esta casa.',403);}
   let file=form.get('file'),bytes;
   if(file&&typeof file.arrayBuffer==='function'){
    if(!['application/pdf','application/octet-stream',''].includes(file.type)||file.size<5||file.size>MAX||await file.slice(0,5).text()!=='%PDF-')throw fail('Selecione um PDF válido de até 20 MB.');
    bytes=await file.arrayBuffer();
   }else{
    if(!prior)throw fail('Selecione o PDF real.');
    const response=await storageRead(prior.storage_path);if(!response.ok)throw fail('Não foi possível preparar a nova revisão do PDF.',503);
    bytes=await response.arrayBuffer();
    if(bytes.byteLength<5||bytes.byteLength>MAX||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-'||await digest(bytes)!==prior.sha256)throw fail('O PDF original não foi confirmado. Selecione o arquivo novamente.',409);
   }
   const sha=await digest(bytes),path=callerTenant+'/private/'+id+'.pdf';
   if(existing&&(existing.previous_id!==previous||existing.sha256!==sha||existing.destinatario!==recipient||existing.visibilidade!==visibility||existing.titulo!==title||existing.descricao!==description||existing.categoria!==category||existing.size_bytes!==bytes.byteLength))throw fail('Esta tentativa já foi usada com outros dados. Atualize antes de repetir.',409);
   if(!existing){
    const uploaded=await sb(storagePath(path),{method:'POST',headers:{'Content-Type':'application/pdf','x-upsert':'false','Cache-Control':'max-age=0'},body:bytes});
    if(!uploaded.ok){await uploaded.body?.cancel().catch(()=>{});const stored=await storageRead(path);if(!stored.ok||await digest(await stored.arrayBuffer())!==sha)throw fail('O armazenamento não confirmou a nova revisão. O material anterior foi preservado.',503);}
   }
   const result=await data(await sb('/rest/v1/rpc/piloto_revisar_pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_previous:previous,p_id:id,p_destinatario:recipient,p_visibilidade:visibility,p_titulo:title,p_descricao:description,p_categoria:category,p_sha256:sha,p_size:bytes.byteLength})}));
   if(result?.id!==id||result?.previous_id!==previous||result?.visibilidade!==visibility)throw fail('O servidor não confirmou a nova revisão. Confira o acervo antes de repetir.',503);
   return json({success:true,...result});
  }
  if(url.pathname==='/api/pilot/library/private'&&request.method==='POST'){
   if(Number(request.headers.get('content-length'))>MAX+65536)throw fail('O PDF deve ter até 20 MB.',413);
   const form=await request.formData(),file=form.get('file'),id=form.get('id'),recipient=form.get('recipient');
   const title=String(form.get('title')||'').trim(),description=String(form.get('description')||''),category=String(form.get('category')||'');
   if(!uuid(id)||!uuid(recipient)||!title||title.length>300||description.length>4000||!['Cantigas','História','Ervas','Orixás','Fundamentos'].includes(category))throw fail('Confira os dados e o destinatário do material.');
   if(!file||typeof file.arrayBuffer!=='function'||file.type!=='application/pdf'||file.size<5||file.size>MAX||await file.slice(0,5).text()!=='%PDF-')throw fail('Selecione um PDF válido de até 20 MB.');
   const recipients=await data(await sb('/rest/v1/rpc/piloto_referencias_membros',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_tenant:callerTenant})}));
   if(!Array.isArray(recipients)||!recipients.some(row=>row.id===recipient))throw fail('O destinatário não pertence a esta casa.',403);
   const bytes=await file.arrayBuffer(),sha=await digest(bytes),path=callerTenant+'/private/'+id+'.pdf',existing=await rowFor('id',id);
   if(existing&&(existing.sha256!==sha||existing.destinatario!==recipient||existing.titulo!==title||existing.descricao!==description||existing.categoria!==category))throw fail('Esta tentativa já foi usada com outros dados. Atualize antes de repetir.',409);
   if(!existing){
    const uploaded=await sb(storagePath(path),{method:'POST',headers:{'Content-Type':'application/pdf','x-upsert':'false','Cache-Control':'max-age=0'},body:bytes});
    if(!uploaded.ok){
     // A lost response may leave the exact object in storage. Verify its bytes;
     // never overwrite it, fabricate success or publish another material.
     await uploaded.body?.cancel().catch(()=>{});
     const stored=await sb(storageReadPath(path));if(!stored.ok||await digest(await stored.arrayBuffer())!==sha)throw fail('O armazenamento não confirmou o PDF. A seleção foi preservada; tente novamente.',503);
    }
   }
   const result=await data(await sb('/rest/v1/rpc/piloto_finalizar_pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_id:id,p_destinatario:recipient,p_titulo:title,p_descricao:description,p_categoria:category,p_sha256:sha,p_size:file.size})}));
   if(result?.id!==id||result?.visibilidade!=='individual')throw fail('O servidor não confirmou a publicação privada.',503);
   return json({success:true,...result});
  }
  const match=url.pathname.match(/^\/api\/pilot\/library\/private\/([0-9a-f-]{36})$/i);
  if(match&&request.method==='DELETE'){
   if(!uuid(match[1]))throw fail('Identificação inválida.');
   const row=await rowFor('id',match[1]);if(!row)return json({success:true,id:match[1],alreadyRemoved:true});
   const removed=await sb('/storage/v1/object/'+BUCKET,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[row.storage_path]})});
   if(!removed.ok)throw fail('Não foi possível confirmar a remoção do PDF. Tente novamente.',503);
   await data(await sb('/rest/v1/piloto_biblioteca_privada?'+new URLSearchParams({id:'eq.'+row.id,tenant_id:'eq.'+callerTenant}),{method:'DELETE',headers:{Prefer:'return=representation'}}));
   return json({success:true,id:row.id});
  }
  if(url.pathname==='/api/pilot/library/pdf-proxy'&&request.method==='GET'){
   const path=url.searchParams.get('path')||'';
   if(path.startsWith(callerTenant+'/private/')){
    if(!new RegExp('^'+callerTenant+'/private/[0-9a-f-]{36}\\.pdf$','i').test(path))throw fail('Caminho inválido.',403);
    const row=await rowFor('storage_path',path);if(!row||row.retired_at)throw fail('Você não tem acesso a este material.',403);
    const rangeHeader=request.headers.get('range');
    const readHeaders={'Cache-Control':'no-cache'};
    if(rangeHeader)readHeaders['Range']=rangeHeader;
    const readPdf=()=>storageRead(row.storage_path,{headers:readHeaders,cache:'no-store',signal:AbortSignal.timeout(25000)});
    let pdf=await readPdf();
    if([429,500,502,503,504].includes(pdf.status)){
     await pdf.body?.cancel().catch(()=>{});
     await new Promise(r=>setTimeout(r,200));
     pdf=await readPdf();
    }
    if(!pdf.ok)throw fail('Não foi possível abrir este PDF.',pdf.status===404?404:503);
    const isPartial=pdf.status===206;
    const bytes=await pdf.arrayBuffer();
    if(!isPartial&&(bytes.byteLength<5||bytes.byteLength>MAX||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-'))throw fail('O arquivo armazenado não é um PDF válido. Substitua o arquivo no acervo.',409);
    const safeTitle=(row.titulo||'material').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,80);
    const encodedTitle=encodeURIComponent((row.titulo||'material')+'.pdf');
    const resHeaders={
     'Content-Type':'application/pdf',
     'Content-Length':String(bytes.byteLength),
     'Content-Disposition':`inline; filename="${safeTitle}.pdf"; filename*=UTF-8''${encodedTitle}`,
     'Cache-Control':'private, no-store',
     'Accept-Ranges':'bytes',
     'Vary':'Authorization',
     'X-Content-Type-Options':'nosniff'
    };
    if(isPartial&&pdf.headers.get('content-range'))resHeaders['Content-Range']=pdf.headers.get('content-range');
    return new Response(bytes,{status:isPartial?206:200,headers:resHeaders});
   }
   const original=new URL(request.url);original.pathname='/api/v1/library/pdf-proxy';return env.API.fetch(new Request(original,{headers:{Authorization:authorization}}));
  }
  return json({error:'Rota do acervo não encontrada.'},404);
 }catch(error){return json({error:error?.status?error.message:'Não foi possível concluir a operação do acervo. Confira o resultado antes de repetir.'},error?.status||503);}
}
