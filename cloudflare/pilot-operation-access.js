import {PILOT_TENANT,isPilotManager,isPilotCoAdmin,PILOT_MANAGERS} from './pilot-interface-policy.js';
import {canUseMemberInterface,memberOperationRolloutMode} from './member-pilot-policy.js';
import {isDelegatedPilotCoAdmin} from './pilot-coadmin-access.js';

const fail=(message,status,code)=>Object.assign(new Error(message),{status,code});
const unavailable=()=>fail('Não foi possível validar o acesso ao piloto. Tente novamente.',503,'PILOT_ACCESS_UNAVAILABLE');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Interface selection and operation authorization are deliberately separate.
// A visual rollout can never unlock writes until the database release gate has
// also enabled this exact flag.
export const operationRolloutMode=env=>env.PILOT_OPERATION_ROLLOUT_MODE==='managers'?'managers':'pilot';
async function readJson(response){
 if(!response.ok){
  if(response.status===401)throw fail('Sua sessão precisa ser renovada.',401,'PILOT_SESSION_INVALID');
  if(response.status===403||response.status===404)throw fail('Acesso não autorizado ao piloto.',403,'PILOT_ACCESS_DENIED');
  throw unavailable();
 }
 try{const value=await response.json();if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{throw unavailable();}
}

// Read-only identity step, also used to distinguish a pilot account when a legacy
// cantina request has no unambiguous tenant. Never trust request/body user IDs.
export async function readPilotOperationIdentity(request,env,fetcher=fetch){
 const authorization=request.headers.get('authorization')||'';
 if(!/^Bearer \S+$/.test(authorization))throw fail('Entre na sua conta para continuar.',401,'PILOT_SESSION_INVALID');
 try{
  const config=await readJson(await env.API.fetch(new Request('https://axecloud.com.br/api/public-config',{cache:'no-store'})));
  if(typeof config.supabaseUrl!=='string'||typeof config.supabaseAnonKey!=='string'||!config.supabaseAnonKey)throw unavailable();
  const base=new URL(config.supabaseUrl);if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw unavailable();
  const headers={apikey:config.supabaseAnonKey,Authorization:authorization};
  const user=await readJson(await fetcher(base.origin+'/auth/v1/user',{headers,cache:'no-store',signal:AbortSignal.timeout(10000)}));
  if(typeof user.id!=='string'||!user.id)throw unavailable();
  return {user,config,headers,authorization};
 }catch(error){if(error?.status)throw error;throw unavailable();}
}

// Library integration: requirePilotOperationAccess(request,env,fetcher,{allowMember:true}).
// Keep all downstream REST/Storage calls under the returned caller bearer/anon key.
// Do not use this helper's result as a cross-request cache: every operation checks
// the current auth user and the actual tenant-info/member binding again.
export async function requirePilotOperationAccess(request,env,fetcher=fetch,{allowMember=false}={}){
 const mode=operationRolloutMode(env),tenantIds=new URL(request.url).searchParams.getAll('tenantId').map(value=>value.trim().toLowerCase());
 if(tenantIds.length>1||tenantIds.some(value=>!UUID.test(value)))throw fail('Acesso negado a esta casa.',403,'PILOT_ACCESS_DENIED');
 if(mode==='pilot'&&tenantIds.some(value=>value!==PILOT_TENANT))throw fail('Acesso negado a esta casa.',403,'PILOT_ACCESS_DENIED');
 const identity=await readPilotOperationIdentity(request,env,fetcher),{user,authorization,config}=identity;
 try{
  const query=new URLSearchParams({userId:user.id,email:user.email||''});
  const read=path=>env.API.fetch(new Request('https://axecloud.com.br'+path,{headers:{Authorization:authorization,'Cache-Control':'no-cache'},cache:'no-store',signal:AbortSignal.timeout(10000)})).then(readJson);
  const profile=await read('/api/tenant-info?'+query),memberRole=String(profile?.role||'').toLowerCase()==='filho';
  const memberBody=allowMember&&memberRole?await read('/api/v1/filho/profile'):null;
  const member=memberBody?.data||null;
  const coAdmin=await isDelegatedPilotCoAdmin({user,profile,config,authorization,fetcher});
  if (coAdmin) {
    profile.role = 'admin';
    profile.cargo = 'Co-Administrador';
    profile.is_co_admin = true;
    profile.tenant_id = PILOT_TENANT;
  }
  const manager=isPilotManager(user,profile,mode),authorizedMember=allowMember&&canUseMemberInterface(user,profile,member,memberOperationRolloutMode(env));
  if(!manager&&!authorizedMember)throw fail('O vínculo desta conta não autoriza a operação no piloto.',403,'PILOT_ACCESS_DENIED');
  const callerTenant=String(profile?.tenant_id||(manager?user.id:(member?.tenant_id||member?.tenantId||PILOT_TENANT))).trim().toLowerCase();
  if(tenantIds.length&&tenantIds[0].trim().toLowerCase()!==callerTenant)throw fail('Acesso negado a esta casa.',403,'PILOT_ACCESS_DENIED');
  return {...identity,profile,member,manager,role:manager?'manager':'member',tenantId:callerTenant,rollout:mode,memberRollout:memberOperationRolloutMode(env)};
 }catch(error){if(error?.status)throw error;throw unavailable();}
}
