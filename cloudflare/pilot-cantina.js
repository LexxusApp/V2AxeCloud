import {PILOT_TENANT,PILOT_MANAGERS} from './pilot-interface-policy.js';
import {MEMBER_PILOT} from './member-pilot-policy.js';
import {readPilotOperationIdentity,requirePilotOperationAccess} from './pilot-operation-access.js';

const MAX_BODY=262144;
const json=(error,status)=>new Response(JSON.stringify({error}),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'}});
const canonical=value=>typeof value==='string'?value.trim().toLowerCase():'';
// JSON.parse accepts duplicate keys. Count decoded top-level tenantId names as
// well, including escaped names, so a pilot identity cannot exploit ambiguity.
function tenantKeyCount(raw){
 let depth=0,count=0;
 for(let i=0;i<raw.length;i++){
  if(raw[i]==='"'){
   const start=i++;for(;i<raw.length;i++){if(raw[i]==='\\'){i++;continue;}if(raw[i]==='"')break;}
   if(depth===1){let next=i+1;while(/\s/.test(raw[next]||'')&&next<raw.length)next++;if(raw[next]===':'&&JSON.parse(raw.slice(start,i+1))==='tenantId')count++;}
  }else if(raw[i]==='{'||raw[i]==='[')depth++;
  else if(raw[i]==='}'||raw[i]===']')depth--;
 }
 return count;
}
async function bodyScope(request){
 if(!request.body)return {values:[],ambiguous:false};
 const reader=request.clone().body.getReader(),chunks=[];let size=0;
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){void reader.cancel().catch(()=>{});return {values:[],ambiguous:true,tooLarge:true};}chunks.push(value);}
 if(!size)return {values:[],ambiguous:false};
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{
  const raw=new TextDecoder().decode(bytes),body=JSON.parse(raw);
  if(!body||Array.isArray(body)||typeof body!=='object')return {values:[],ambiguous:true};
  const count=tenantKeyCount(raw),present=Object.hasOwn(body,'tenantId');
  return {values:present?[body.tenantId]:[],ambiguous:count>1||(present&&(typeof body.tenantId!=='string'||!body.tenantId.trim()))};
 }catch{return {values:[],ambiguous:true};}
}

// Principal wires ONLY the explicit /api/v1/cantina/* routes after review. This
// module never selects UI/assets and never rewrites the original request body.
export async function handlePilotCantina(request,env,fetcher=fetch){
 const url=new URL(request.url);if(!/^\/api\/v1\/cantina(?:\/|$)/.test(url.pathname))return null;
 // Preserve CORS preflight; it cannot read or mutate a cantina record.
 if(request.method==='OPTIONS')return env.API.fetch(request);
 try{
  const mutation=!['GET','HEAD'].includes(request.method),query=url.searchParams.getAll('tenantId');
  const body=mutation?await bodyScope(request):{values:[],ambiguous:false};
  const supplied=[...query,...body.values],normalized=supplied.map(canonical);
  const ambiguous=body.ambiguous||query.length>1||normalized.some(value=>!value)||new Set(normalized).size>1;
  const pilot=normalized.some(value=>PILOT_MANAGERS.some(m=>m.id===value));
  if(ambiguous||!supplied.length){
   if(pilot)return json('Informe uma única casa válida para esta operação.',body.tooLarge?413:400);
   // Missing/ambiguous scope is forwarded for non-pilot identities. A verified
   // pilot identity must fail closed even when its body disguises the tenant.
   try{
    const {user}=await readPilotOperationIdentity(request,env,fetcher);
    if([...PILOT_MANAGERS.map(m=>m.id),MEMBER_PILOT.userId].includes(user.id))return json('Informe uma única casa válida para esta operação.',body.tooLarge?413:400);
   }catch(error){if(error?.status!==401)throw error;}
   return env.API.fetch(request);
  }
  if(!pilot)return env.API.fetch(request);
  if(mutation&&!['https://axecloud.com.br','http://localhost:5188'].includes(request.headers.get('origin')))return json('Origem da solicitação inválida.',403);
  await requirePilotOperationAccess(request,env,fetcher);
  return env.API.fetch(request);
 }catch(error){return json(error?.status?error.message:'Não foi possível validar a operação da cantina.',error?.status||503);}
}
