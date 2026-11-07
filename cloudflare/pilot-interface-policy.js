export const PILOT_MANAGERS = [
  { id: 'fad75b91-d2eb-4805-b5a3-c19e8a073bed', email: 'vendasmercadolivrev1@gmail.com' },
  { id: 'ab2eef13-604c-4c8f-9d14-f3da41cc5a81', email: 'lucasteste@gmail.com', isCoAdmin: true, tenantId: 'fad75b91-d2eb-4805-b5a3-c19e8a073bed' }
];
export const PILOT_TENANT=PILOT_MANAGERS[0].id;
export const PILOT_EMAIL=PILOT_MANAGERS[0].email;
export const PILOT_PREFIX='/assets/pilot-20261101/';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isPilotCoAdmin(user){
  if(!user||!user.id)return false;
  return PILOT_MANAGERS.some(m=>m.isCoAdmin&&m.id===user.id&&m.tenantId===PILOT_TENANT);
}
export function isManagerIdentity(user,profile){
  if(!user||!profile)return false;
  if(profile.is_co_admin===true){
    const tenantId=profile.tenant_id||PILOT_TENANT;
    return tenantId===PILOT_TENANT;
  }
  const tenantId=profile.tenant_id||profile.id;
  if(!UUID.test(String(user.id||''))||!UUID.test(String(tenantId||'')))return false;
  if(tenantId!==user.id)return false;
  if(!['admin','zelador','lider','leader'].includes(String(profile.role||'').toLowerCase()))return false;
  if(profile.is_blocked===true||profile.deleted_at)return false;
  if(['blocked','deleted'].includes(String(profile.status||'').toLowerCase()))return false;
  return true;
}
export function isPilotManager(user,profile,rollout='pilot'){
  if(!isManagerIdentity(user,profile))return false;
  if(rollout==='managers')return true;
  const userEmail=String(user.email||'').toLowerCase().trim();
  if(profile.is_co_admin === true && (profile.tenant_id === PILOT_TENANT || profile.id === PILOT_TENANT)) return true;
  return PILOT_MANAGERS.some(m=>!m.isCoAdmin&&m.id===user.id&&m.email===userEmail);
}
