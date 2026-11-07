import {PILOT_TENANT,isPilotCoAdmin} from './pilot-interface-policy.js';

export async function isDelegatedPilotCoAdmin({user,profile,config,authorization,fetcher=fetch}){
 if(!user?.id||!profile||!config||!authorization)return false;
 if(profile.is_co_admin===true||isPilotCoAdmin(user))return true;
 if(String(profile.tenant_id||'').trim().toLowerCase()!==PILOT_TENANT)return false;
 const base=new URL(String(config.supabaseUrl||''));
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)return false;
 const anonKey=String(config.supabaseAnonKey||'').trim();
 if(!anonKey)return false;
 const query=new URLSearchParams({
  select:'ativo,cargo_delegado',
  tenant_id:'eq.'+PILOT_TENANT,
  user_id:'eq.'+user.id,
  ativo:'eq.true',
  limit:'1',
 });
 try{
  const response=await fetcher(base.origin+'/rest/v1/piloto_coadministradores?'+query,{
   headers:{apikey:anonKey,Authorization:authorization,Accept:'application/json'},
   cache:'no-store',
   signal:AbortSignal.timeout(10000),
  });
  if(!response.ok)return false;
  const rows=await response.json();
  return Array.isArray(rows)&&rows.length>0&&rows[0]?.ativo===true;
 }catch{
  return false;
 }
}
