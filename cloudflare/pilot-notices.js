import {PILOT_TENANT, PILOT_MANAGERS} from './pilot-interface-policy.js';
import {MEMBER_PILOT} from './member-pilot-policy.js';
import {operationRolloutMode,requirePilotOperationAccess} from './pilot-operation-access.js';

const ROOT='/api/pilot/notices';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const revision=value=>Number.isSafeInteger(value)&&value>0;
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Authorization, Cookie','X-Content-Type-Options':'nosniff'}});
const legacyRows=(rows,t=PILOT_TENANT)=>rows.filter(row=>row.status==='published').map(row=>({id:row.id,tenant_id:t,titulo:row.title,conteudo:row.body,categoria:row.category,expiracao:row.expires||null,data_publicacao:row.publishedAt,updated_at:row.updated,gira_id:row.giraId||null}));

// The primary Worker must call this before its generic /api proxy. No service
// credentials are used: every database operation carries the caller's JWT.
export async function handlePilotNotices(request,env,fetcher=fetch){
 const path=new URL(request.url).pathname;
 if(path!==ROOT&&!path.startsWith(ROOT+'/'))return null;
 return run(request,env,fetcher,false);
}

// Compatibility for current member/manager readers. Return null for other
// accounts, preserving the existing application. Pilot legacy writes fail closed
// because they have neither an optimistic revision nor an idempotency key.
export async function handlePilotNoticesLegacy(request,env,fetcher=fetch){
 const path=new URL(request.url).pathname;
 if(path!=='/api/notices'&&!path.startsWith('/api/notices/')&&path!=='/api/v1/filho/home'&&path!=='/api/v1/dashboard/core')return null;
 // A routing hint only: skipping to the original authenticated API cannot grant
 // pilot access. Matching hints still require /auth/v1/user + database guards.
 try{
  const payload=(request.headers.get('authorization')||'').split(' ')[1]?.split('.')[1];
  const hint=JSON.parse(atob(payload.replaceAll('-','+').replaceAll('_','/')));
  if(![...PILOT_MANAGERS.map(m=>m.id),MEMBER_PILOT.userId].includes(hint.sub))return null;
 }catch{return null;}
 return run(request,env,fetcher,true);
}

async function run(request,env,fetcher,legacy){
 const url=new URL(request.url),path=url.pathname,authorization=request.headers.get('authorization');
 try{
  if(!/^Bearer \S+$/.test(authorization||'')){if(legacy)return null;throw fail('Entre na sua conta para acessar os comunicados.',401);}
  let config,headers,manager,tenant;
  if(operationRolloutMode(env)==='managers'){
   let access;
   try{access=await requirePilotOperationAccess(request,env,fetcher,{allowMember:true});}
   catch(error){if(legacy&&[401,403].includes(error?.status))return null;throw error;}
   ({config,headers,manager,tenantId:tenant}=access);
  }else{
   const configuration=await env.API.fetch(new Request('https://axecloud.com.br/api/public-config'));
   if(!configuration.ok)throw fail('O serviço do mural está temporariamente indisponível.',503);
   config=await configuration.json();if(!config.supabaseUrl||!config.supabaseAnonKey)throw fail('Configuração do mural indisponível.',503);
   headers={apikey:config.supabaseAnonKey,Authorization:authorization};
   const userResponse=await fetcher(config.supabaseUrl+'/auth/v1/user',{headers});
   if(!userResponse.ok){if(legacy)return null;throw fail('Sua sessão precisa ser renovada.',401);}
   const user=await userResponse.json();manager=PILOT_MANAGERS.some(m=>m.id===user.id);tenant=manager?user.id:MEMBER_PILOT.tenantId;
   if(!manager&&user.id!==MEMBER_PILOT.userId){if(legacy)return null;throw fail('Conta não autorizada no piloto.',403);}
   if(url.searchParams.has('tenantId')&&!PILOT_MANAGERS.some(m=>m.id===url.searchParams.get('tenantId'))&&url.searchParams.get('tenantId')!==MEMBER_PILOT.tenantId)throw fail('Acesso negado a esta casa.',403);
  }
  if(request.method!=='GET'&&!manager)throw fail('Somente a zeladoria pode alterar o mural.',403);
  if(request.method!=='GET'&&!['https://axecloud.com.br','http://localhost:5188'].includes(request.headers.get('origin')))throw fail('Origem da solicitação inválida.',403);
  const data=async response=>{
   const body=await response.json().catch(()=>null);
   if(!response.ok){const status=body?.code==='42501'?403:body?.code==='23505'?409:body?.code==='22023'?400:response.status>=500?503:response.status;
    // Do not expose SQL details, relation names or arbitrary upstream errors.
    throw fail(status===403?'Você não tem acesso a este comunicado ou o vínculo está inativo.':status===409?'O comunicado mudou ou já está em processamento. Atualize o mural antes de repetir.':status===400?'Confira os dados, a gira e os destinatários ativos do comunicado.':'O serviço do mural não confirmou a operação.',status);}
   return body;
  };
  const rpc=async(name,args={})=>data(await fetcher(config.supabaseUrl+'/rest/v1/rpc/'+name,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_tenant:tenant,...args})}));
  const list=async()=>{const result=await rpc('piloto_comunicados_listar');if(!Array.isArray(result?.data))throw fail('Resposta do mural inválida.',503);return result;};
  if(legacy){
   if(request.method!=='GET'||path.startsWith('/api/notices/'))throw fail('Use o mural piloto atualizado para alterar comunicados com segurança.',409);
   const result=await list();
   if(path==='/api/v1/filho/home'||path==='/api/v1/dashboard/core'){
    // Replace the legacy notices completely; never append the service_role list.
    const original=await env.API.fetch(new Request(request.url,{headers:{Authorization:authorization}}));
    const home=await data(original);if(!home||typeof home!=='object'||Array.isArray(home))throw fail('Resposta do início inválida.',503);
    if(path==='/api/v1/dashboard/core'){
     if(!home.resources||typeof home.resources!=='object')throw fail('Resposta do início inválida.',503);
     return json({...home,resources:{...home.resources,notices:{data:legacyRows(result.data,tenant)}}});
    }
    return json({...home,notices:legacyRows(result.data)});
   }
   return json({data:legacyRows(result.data)});
  }
  if(path===ROOT&&request.method==='GET')return json(await list());
  if(!['POST','DELETE'].includes(request.method))throw fail('Método não permitido.',405);
  if(Number(request.headers.get('content-length'))>32000)throw fail('O comunicado excede o tamanho permitido.',413);
  const raw=await request.text();if(raw.length>32000)throw fail('O comunicado excede o tamanho permitido.',413);
  let input;try{input=JSON.parse(raw);}catch{throw fail('Dados do comunicado inválidos.');}
  if(!input||typeof input!=='object'||Array.isArray(input))throw fail('Dados do comunicado inválidos.');
  if(path===ROOT&&request.method==='POST'){
   if(!uuid(input.notice?.id)||input.expected!=null&&!revision(input.expected))throw fail('Identificação ou revisão inválida.');
   const result=await rpc('piloto_comunicados_salvar',{p_notice:input.notice,p_expected:input.expected??null});
   if(result?.id!==input.notice.id||!revision(result.revision)||result.status!==input.notice.status)throw fail('O servidor não confirmou o comunicado. Atualize antes de repetir.',503);
   return json({notice:result});
  }
  const match=path.match(/^\/api\/pilot\/notices\/([0-9a-f-]{36})(?:\/(restore|notify))?$/i);
  if(!match||!uuid(match[1]))throw fail('Rota do mural não encontrada.',404);
  const id=match[1],action=match[2];
  if(!revision(input.expected))throw fail('Atualize o comunicado antes de continuar.',409);
  if(!action&&request.method==='DELETE'){
   const result=await rpc('piloto_comunicados_excluir',{p_id:id,p_expected:input.expected});
   if(result?.id!==id||result.deleted!==true||!revision(result.revision))throw fail('A remoção não foi confirmada. Atualize antes de repetir.',503);
   return json(result);
  }
  if(action==='restore'&&request.method==='POST'){
   const result=await rpc('piloto_comunicados_restaurar',{p_id:id,p_expected:input.expected});
   if(result?.id!==id||!revision(result.revision))throw fail('A restauração não foi confirmada. Atualize antes de repetir.',503);
   return json({notice:result});
  }
  if(action!=='notify'||request.method!=='POST')throw fail('Rota do mural não encontrada.',404);
  if(!uuid(input.key))throw fail('Identificação do envio inválida.');
  const claim=await rpc('piloto_comunicados_iniciar_envio',{p_id:id,p_revision:input.expected,p_key:input.key});
  if(claim?.id!==id||typeof claim.send!=='boolean'||!Array.isArray(claim.recipients)||claim.recipients.some(recipient=>!uuid(recipient)))throw fail('O registro do envio não foi confirmado.',503);
  if(!claim.send)return json({notice:claim.notice,replayed:true});
  let cursor=0,auditPending=false;
  // Independent recipient claims ensure concurrent clicks cannot send twice.
  const outcomes=await Promise.allSettled(Array.from({length:Math.min(3,claim.recipients.length)},async()=>{
   while(cursor<claim.recipients.length){
    const recipient=claim.recipients[cursor++];
    const target=await rpc('piloto_comunicados_assumir_destinatario',{p_id:id,p_revision:input.expected,p_recipient:recipient,p_key:input.key});
    if(target?.id!==id||typeof target.send!=='boolean')throw fail('A autorização do destinatário não foi confirmada.',503);
    if(!target.send)continue;
    if(!uuid(target.attempt)||target.payload?.filhoId!==recipient||target.payload?.tipo!=='mural_aviso'||typeof target.payload?.variables?.comunicado!=='string')throw fail('Dados do envio não confirmados.',503);
    let state='uncertain',external=null,error='Envio não confirmado. Confira o histórico antes de repetir.';
    try{
     const response=await env.API.fetch(new Request('https://axecloud.com.br/api/whatsapp/send',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},
      // Only the server-derived target and notice text may reach the sender.
      body:JSON.stringify({tipo:'mural_aviso',filhoId:recipient,variables:target.payload.variables}),signal:AbortSignal.timeout(30000)}));
     const result=await response.json().catch(()=>null);
     if(response.ok&&result?.success===true&&typeof result.externalId==='string'&&result.externalId.trim()){state='confirmed';external=result.externalId;error=null;}
     else if([400,401,403,404,405,410,413,422,429].includes(response.status)){state='failed';error='O serviço recusou o envio para este destinatário.';}
    }catch{}
    try{
     const result=await rpc('piloto_comunicados_finalizar_envio',{p_id:id,p_revision:input.expected,p_recipient:recipient,p_attempt:target.attempt,p_state:state,p_external:external,p_error:error});
     if(result?.id!==id||!['confirmed','uncertain','failed'].includes(result.state))auditPending=true;
    }catch{auditPending=true;}
   }
  }));
  if(outcomes.some(outcome=>outcome.status==='rejected'))auditPending=true;
  const result=await list(),notice=result.data.find(row=>row.id===id);
  if(!notice)throw fail('Envio processado; atualize o mural para conferir o histórico.',503);
  return json({notice,auditPending});
 }catch(error){return json({error:error?.status?error.message:'Não foi possível concluir a operação do mural. Atualize antes de repetir.'},error?.status||503);}
}
