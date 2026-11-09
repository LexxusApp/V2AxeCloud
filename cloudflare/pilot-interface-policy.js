export const PILOT_MANAGERS = [
  { id: 'fad75b91-d2eb-4805-b5a3-c19e8a073bed', email: 'vendasmercadolivrev1@gmail.com' }
];
export const PILOT_TENANT=PILOT_MANAGERS[0].id;
export const PILOT_EMAIL=PILOT_MANAGERS[0].email;
export const PILOT_PREFIX='/assets/pilot-20261101/';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isManagerIdentity(user,profile){
  if(!user||!profile)return false;
  const tenantId=profile.tenant_id||profile.id;
  if(!UUID.test(String(user.id||''))||!UUID.test(String(tenantId||'')))return false;
  if(tenantId!==user.id)return false; // Delegates must pass a live grant check separately.
  if(!['admin','zelador','lider','leader'].includes(String(profile.role||'').toLowerCase()))return false;
  if(profile.is_blocked===true||profile.deleted_at)return false;
  if(['blocked','deleted'].includes(String(profile.status||'').toLowerCase()))return false;
  return true;
}
export function isPilotManager(user,profile,rollout='pilot'){
  if(!isManagerIdentity(user,profile))return false;
  if(rollout==='managers')return true;
  const userEmail=String(user.email||'').toLowerCase().trim();
  return PILOT_MANAGERS.some(m=>m.id===user.id&&m.email===userEmail);
}
