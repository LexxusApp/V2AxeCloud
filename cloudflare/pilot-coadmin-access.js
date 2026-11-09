import {PILOT_MODULE_KEYS} from './pilot-granular-policy.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Never grant rights from a cached profile flag or an old static allowlist.
// Read the currently active owner-approved permissions under the caller JWT.
export async function readDelegatedPilotPermissions({user,profile,config,authorization,fetcher=fetch}){
 if(!user?.id||!profile||!config||!authorization)return null;
 if(profile.is_co_admin===false)return null;
 const tenantId=String(profile.tenant_id||'').trim().toLowerCase();
 if(!UUID.test(tenantId)||tenantId===user.id)return null;
 if(profile.is_blocked===true||profile.deleted_at||['blocked','deleted'].includes(String(profile.status||'').toLowerCase()))return null;
 let base;
 try{base=new URL(String(config.supabaseUrl||''));}
 catch{return null;}
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)return null;
 const anonKey=String(config.supabaseAnonKey||'').trim();
 if(!anonKey)return null;
 const query=new URLSearchParams({
  select:'ativo,permissoes',tenant_id:'eq.'+tenantId,
  user_id:'eq.'+user.id,ativo:'eq.true',limit:'1',
 });
 try{
  const response=await fetcher(base.origin+'/rest/v1/piloto_coadministradores?'+query,{
   headers:{apikey:anonKey,Authorization:authorization,Accept:'application/json'},
   cache:'no-store',signal:AbortSignal.timeout(10000),
  });
  if(!response.ok)return null;
  const rows=await response.json();
  const row=Array.isArray(rows)?rows[0]:null;
  if(row?.ativo!==true)return null;
  const permissions={};
  for(const key of PILOT_MODULE_KEYS){
   if(['visualizar','gerenciar'].includes(row.permissoes?.[key]))permissions[key]=row.permissoes[key];
  }
  if(!Object.keys(permissions).length)return null;
  return {tenantId,permissions};
 }catch{return null;}
}

export async function isDelegatedPilotCoAdmin(args){
 return Boolean(await readDelegatedPilotPermissions(args));
}
