import {PILOT_TENANT} from './pilot-interface-policy.js';
import {requirePilotOperationAccess} from './pilot-operation-access.js';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const delivery=row=>row.envio_estado==='sending'&&Date.now()-Date.parse(row.updated_at||row.created_at)>120000?'uncertain':row.envio_estado;
export async function handlePilotSupport(request,env,fetcher=fetch){
 const url=new URL(request.url);if(!/^\/api\/pilot\/support\/?$/.test(url.pathname))return null;
 try{
  if(!['GET','POST','PATCH'].includes(request.method))throw fail('Método não permitido.',405);
  const authorization=request.headers.get('authorization');if(!authorization?.startsWith('Bearer '))throw fail('Entre na sua conta para acessar o suporte.',401);
  if(request.method!=='GET'&&!['https://axecloud.com.br','http://localhost:5188'].includes(request.headers.get('origin')))throw fail('Origem da solicitação inválida.',403);
  const {user,config,headers,profile,tenantId}=await requirePilotOperationAccess(request,env,fetcher);
  const callerTenant=(tenantId||profile?.tenant_id||user.id).trim().toLowerCase();
  const data=async response=>{const body=await response.json().catch(()=>null);if(!response.ok)throw fail(body?.message||body?.error||'O suporte não confirmou a operação.',response.status>=500?503:response.status);return body;};
  const rpc=async(name,args)=>data(await fetcher(config.supabaseUrl+'/rest/v1/rpc/'+name,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_tenant:callerTenant,...args})}));
  if(request.method==='GET'){
   const read=async table=>{const all=[];let cursor;for(;;){const query=new URLSearchParams({select:'*',tenant_id:'eq.'+callerTenant,order:'id.asc',limit:'500',...(cursor?{id:'gt.'+cursor}:{})});const rows=await data(await fetcher(config.supabaseUrl+'/rest/v1/'+table+'?'+query,{headers}));if(!Array.isArray(rows))throw fail('Histórico de suporte inválido.',503);all.push(...rows);if(rows.length<500)break;const next=rows.at(-1)?.id;if(!uuid(next)||next===cursor)throw fail('Paginação do suporte inválida.',503);cursor=next;}return all;};
   const [tickets,messages]=await Promise.all([read('piloto_suporte_chamados'),read('piloto_suporte_complementos')]);
   return json({tickets:tickets.map(row=>({...row.dados,id:row.id,status:row.status,created:row.created_at,delivery:delivery(row),deliveryError:row.envio_erro||'',messages:messages.filter(message=>message.chamado_id===row.id).map(message=>({id:message.id,text:message.texto,created:message.created_at,delivery:delivery(message),deliveryError:message.envio_erro||''})).sort((a,b)=>a.created.localeCompare(b.created)||a.id.localeCompare(b.id))})).sort((a,b)=>a.created.localeCompare(b.created)||a.id.localeCompare(b.id))});
  }
  if(Number(request.headers.get('content-length'))>20000)throw fail('O pedido excede o tamanho permitido.',413);
  const raw=await request.text();if(raw.length>20000)throw fail('O pedido excede o tamanho permitido.',413);
  let input;try{input=JSON.parse(raw);}catch{throw fail('Dados do pedido inválidos.');}
  if(!uuid(input?.id))throw fail('Identificação do pedido inválida.');
  if(request.method==='PATCH')return json(await rpc('piloto_suporte_situacao',{p_ticket:input.id,p_status:input.status,p_antes:input.before}));
  if(input.messageId!=null&&!uuid(input.messageId))throw fail('Identificação do complemento inválida.');
  const claim=await rpc('piloto_suporte_iniciar',{p_ticket:input.id,p_message:input.messageId||null,p_dados:input.data,p_retry:input.retry===true});
  if(claim?.id!==input.id||typeof claim.send!=='boolean')throw fail('O registro do pedido não foi confirmado.',503);
  if(!claim.send)return json({id:input.id,messageId:input.messageId||null,delivery:claim.state,replayed:true});
  if(!uuid(claim.attempt)||!claim.payload)throw fail('A tentativa de envio não foi confirmada.',503);
  let state='uncertain',external=null,error='Não foi possível confirmar o envio. Confira o histórico antes de repetir.';
  try{
   const response=await env.API.fetch(new Request('https://axecloud.com.br/api/v1/support',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify(claim.payload),signal:AbortSignal.timeout(30000)}));
   const result=await response.json().catch(()=>null);
   if(response.ok&&result?.ok===true&&typeof result.messageId==='string'&&result.messageId.trim()) {state='confirmed';external=result.messageId;error=null;}
   else if([400,401,403,404,405,413,422,429].includes(response.status)){state='failed';error=typeof result?.error==='string'?result.error.slice(0,1000):'O serviço recusou o envio. Seu pedido ficou salvo para uma nova tentativa.';}
  }catch{}
  try{
   const result=await rpc('piloto_suporte_finalizar',{p_ticket:input.id,p_message:input.messageId||null,p_state:state,p_external:external,p_error:error,p_attempt:claim.attempt});
   if(result?.id!==input.id||!['confirmed','uncertain','failed'].includes(result.state))throw Error('Invalid confirmation');
   return json({id:input.id,messageId:input.messageId||null,delivery:result.state,deliveryError:error});
  }catch{
   // A provider receipt is not permission to send again if saving that receipt failed.
   return json({id:input.id,messageId:input.messageId||null,delivery:state==='confirmed'?'confirmed':'uncertain',auditPending:true,deliveryError:state==='confirmed'?'Envio confirmado; atualização do histórico pendente.':error});
  }
 }catch(error){return json({error:error?.status?error.message:'Não foi possível concluir a operação do suporte. Consulte o histórico antes de repetir.'},error?.status||503);}
}
