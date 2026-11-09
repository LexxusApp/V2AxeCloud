import type { SupabaseClient } from '@supabase/supabase-js';
import { classifyPilotDelegatedOperation, grantAllows, PILOT_MODULE_KEYS } from '../../lib/delegatedPolicy.js';
import { isPilotPersonalMemberOperation, matchesActivePilotChild } from '../../lib/memberOperationScope.js';

export function cleanDelegatedPermissions(value: unknown): Record<string,string> {
  const result: Record<string,string> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const key of PILOT_MODULE_KEYS) {
    const level = (value as Record<string,unknown>)[key];
    if (level === 'visualizar' || level === 'gerenciar') result[key] = level;
  }
  return result;
}

export async function readActiveDelegation(sb: SupabaseClient, userId: string, tenantId: string) {
  if (!tenantId || tenantId === userId) return null;
  const {data,error} = await sb.from('piloto_coadministradores')
    .select('tenant_id,filho_id,user_id,ativo,permissoes')
    .eq('tenant_id',tenantId).eq('user_id',userId).eq('ativo',true).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const {data:child,error:childError} = await sb.from('filhos_de_santo')
    .select('id,user_id,tenant_id,lider_id,status').eq('id',data.filho_id).maybeSingle();
  if (childError) throw childError;
  const {data:house,error:houseError}=await sb.from('perfil_lider').select('id,is_blocked,deleted_at').eq('id',tenantId).maybeSingle();
  if(houseError)throw houseError;
  if(!house||house.is_blocked||house.deleted_at)return null;
  const permissions = cleanDelegatedPermissions(data.permissoes);
  return matchesActivePilotChild(child,tenantId,userId) && Object.keys(permissions).length
    ? {...data,permissoes:permissions} : null;
}

export async function resolveDelegatedModuleTenant(sb:SupabaseClient,userId:string,module:string,level='visualizar'){
 const {data,error}=await sb.from('piloto_coadministradores').select('tenant_id').eq('user_id',userId).eq('ativo',true).maybeSingle();
 if(error)throw error;
 if(!data)return userId;
 const delegation=await readActiveDelegation(sb,userId,data.tenant_id);
 if(!delegation||!grantAllows(delegation.permissoes,module,level))throw Object.assign(Error('O zelador não liberou esta área.'),{code:'42501'});
 return delegation.tenant_id;
}

type Denial = {status:number;error:string;code:string};
const denied = (error:string):Denial => ({status:403,error,code:'PILOT_PERMISSION_DENIED'});

/** Shared by Express and the Cloudflare entry point. No cross-request grant cache. */
export async function checkDelegatedApiRequest({sb,user,url,method,body}: {
  sb:SupabaseClient;user:{id:string};url:URL;method:string;body?:any;
}):Promise<Denial|null> {
  const action = classifyPilotDelegatedOperation(url.pathname,method,body);
  if (action.type === 'public' || url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/v1/auth/')) return null;
  // Include revoked rows. Dropping an inactive delegation from this check would
  // restore legacy service-role endpoints to a revoked manager.
  const {data:entries,error} = await sb.from('piloto_coadministradores')
    .select('tenant_id,filho_id,user_id,ativo,permissoes').eq('user_id',user.id);
  if (error) throw error;
  if (!entries?.length) return null;
  const targets = ['tenantId','tenant_id','terreiroId','terreiro_id'].flatMap(key=>url.searchParams.getAll(key));
  for (const source of [body,body?.childData,body?.data]) {
    if (!source || typeof source !== 'object') continue;
    for (const key of ['tenantId','tenant_id','terreiroId','terreiro_id']) {
      if (source[key] !== undefined && source[key] !== null) targets.push(source[key]);
    }
  }
  if (targets.some(id=>typeof id !== 'string' || !entries.some(entry=>entry.tenant_id === id.trim().toLowerCase())))
    return denied('Esta solicitação aponta para outra casa.');
  const entry = targets.length ? entries.find(row=>row.tenant_id === targets[0].trim().toLowerCase()) : entries[0];
  if (!entry || targets.some(id=>id.trim().toLowerCase() !== entry.tenant_id)) return denied('Terreiro não autorizado.');
  const {data:child,error:childError} = await sb.from('filhos_de_santo')
    .select('id,user_id,tenant_id,lider_id,status').eq('id',entry.filho_id).maybeSingle();
  if (childError) throw childError;
  if (!matchesActivePilotChild(child,entry.tenant_id,user.id)) return denied('Seu vínculo de membro não está ativo.');
  const {data:house,error:houseError}=await sb.from('perfil_lider').select('id,is_blocked,deleted_at,access_block_reason').eq('id',entry.tenant_id).maybeSingle();
  if(houseError)throw houseError;
  if(!house||house.deleted_at||(house.is_blocked&&house.access_block_reason!=='subscription_expired'))return denied('O acesso a esta casa está suspenso.');
  if (action.type === 'personal' || isPilotPersonalMemberOperation(url,method)) {
    if (url.pathname === '/api/v1/chat/conversations' && method === 'POST' && body?.type !== 'direct')
      return denied('A criação de grupos precisa de permissão de gerenciamento.');
    return null;
  }
  if(house.is_blocked)return denied('A gestão da casa está suspensa. Continue no seu espaço de membro.');
  if (action.type === 'blocked') return denied(action.reason || 'Função exclusiva do zelador titular.');
  if (entry.ativo !== true || !grantAllows(entry.permissoes,action.module,action.level))
    return denied('O zelador não concedeu esta permissão. Volte ao seu espaço ou solicite a liberação da área.');
  return null;
}
