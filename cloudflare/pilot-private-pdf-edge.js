// Server-only, pilot-scoped private PDF transport.
// The caller JWT and the PDF-level RLS function are checked BEFORE using
// the API Worker's existing service key for the physical Storage read.
const BUCKET='piloto_biblioteca_privada';
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const PATH=new RegExp('^'+UUID+'/private/'+UUID+'\\.pdf$','i');
const failure=(message,status)=>Response.json({error:message},{status,headers:{'Cache-Control':'private,no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'}});
export async function handlePilotPrivatePdfEdge(request,env,createClientFn,fetcher=fetch){
 const url=new URL(request.url);
 const isFetchPath=url.pathname==='/api/v1/_pilot_private_pdf_fetch';
 const isProxyPath=url.pathname==='/api/v1/library/pdf-proxy';
 if(!isFetchPath&&!isProxyPath)return null;
 if(request.method!=='GET')return failure('Método não permitido.',405);
 const tenants=url.searchParams.getAll('tenantId'),paths=url.searchParams.getAll('path');
 if(isProxyPath&&(!paths.length||!PATH.test(paths[0]))){
  return null;
 }
 if(tenants.length!==1||paths.length!==1||!PATH.test(paths[0])||paths[0].split('/')[0]!==tenants[0])
  return failure('Caminho do documento não autorizado.',403);
 const authorization=request.headers.get('Authorization')||'';
 if(!/^Bearer \S+$/i.test(authorization))return failure('Autenticação necessária.',401);
 const base=String(env.VITE_SUPABASE_URL||env.SUPABASE_URL||'').trim();
 const anon=String(env.VITE_SUPABASE_ANON_KEY||'').trim();
 const service=String(env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
 if(!base||!anon||!service)return failure('Serviço de documentos indisponível.',503);
 let origin;
 try{const parsed=new URL(base);if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash)throw Error();origin=parsed.origin;}catch{return failure('Configuração de documentos inválida.',503);}
 try{
  const admin=createClientFn(origin,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:userError}=await admin.auth.getUser(authorization.slice(7));
  if(userError||!identity?.user?.id)return failure('Sessão inválida.',401);
  const caller=createClientFn(origin,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
  const result=await caller.from('piloto_biblioteca_privada')
   .select('id,titulo,storage_path,retired_at')
   .eq('tenant_id',tenants[0]).eq('storage_path',paths[0]).limit(1);
  if(result.error)return failure('Não foi possível validar o material.',503);
  if(!Array.isArray(result.data)||result.data.length!==1||result.data[0].retired_at)return failure('Material não autorizado.',403);
  const row=result.data[0];
  if(row.storage_path!==paths[0]||!new RegExp('^'+UUID+'$','i').test(String(row.id)))return failure('Material não autorizado.',403);
  const permission=await caller.rpc('piloto_pode_ler_pdf',{p_id:row.id});
  if(permission.error)return failure('Não foi possível verificar o acesso ao PDF.',503);
  if(permission.data!==true)return failure('Acesso ao PDF não autorizado.',403);
  const encoded=paths[0].split('/').map(encodeURIComponent).join('/');
  const storageHeaders={apikey:service,Authorization:'Bearer '+service,'Cache-Control':'no-cache'};
  if(request.headers.has('range'))storageHeaders['Range']=request.headers.get('range');
  const storage=await fetcher(origin+'/storage/v1/object/authenticated/'+BUCKET+'/'+encoded,{
   method:'GET',headers:storageHeaders,
   cache:'no-store',signal:AbortSignal.timeout(20000)
  });
  if(!storage.ok){await storage.body?.cancel().catch(()=>{});return failure('O armazenamento não entregou o PDF.',storage.status===404?404:503);}
  const isPartial=storage.status===206;
  const declared=Number(storage.headers.get('content-length')||0);
  if(declared>20*1024*1024){await storage.body?.cancel().catch(()=>{});return failure('Documento excede o limite permitido.',413);}
  const bytes=await storage.arrayBuffer();
  if(!isPartial){
   const signature=new TextDecoder().decode(bytes.slice(0,5));
   if(bytes.byteLength<5||bytes.byteLength>20*1024*1024||signature!=='%PDF-')return failure('Arquivo armazenado inválido.',502);
  }
  const safeTitle=(row.titulo||'material').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,80);
  const resHeaders={
   'Content-Type':'application/pdf','Content-Length':String(bytes.byteLength),
   'Content-Disposition':"inline; filename=\""+safeTitle+".pdf\"; filename*=UTF-8''"+encodeURIComponent(String(row.titulo||'material')+'.pdf'),
   'Cache-Control':'private,no-store','Accept-Ranges':'bytes','Vary':'Authorization','X-Content-Type-Options':'nosniff',
   'X-Axecloud-PDF-Source':'authorized-storage'
  };
  if(isPartial&&storage.headers.get('content-range'))resHeaders['Content-Range']=storage.headers.get('content-range');
  return new Response(bytes,{status:isPartial?206:200,headers:resHeaders});
 }catch{return failure('O serviço de documentos não respondeu.',503);}
}
