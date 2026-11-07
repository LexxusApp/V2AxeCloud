export const MEMBER_PILOT = Object.freeze({
 userId:'ab2eef13-604c-4c8f-9d14-f3da41cc5a81',
 memberId:'3666b777-1066-4eb7-a0c3-f63c2e01ae90',
 tenantId:'fad75b91-d2eb-4805-b5a3-c19e8a073bed',
 email:'lucasteste@gmail.com',
 authEmail:'f_3666b777-1066-4eb7-a0c3-f63c2e01ae90@axecloud.internal',
});
export const MEMBER_PREFIX='/assets/member-pilot-20261102/';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const email=value=>String(value||'').trim().toLowerCase();
export function isPilotMember(user,tenant,member){
 if(!user||!tenant||!member)return false;
 const userId=String(user.id||''),memberId=String(member.id||''),tenantId=String(tenant.tenant_id||''),memberTenant=String(member.tenant_id||member.tenantId||'');
 const authEmail=email(user.email),memberEmail=email(member.email),shadowEmail=`f_${memberId.toLowerCase()}@axecloud.internal`;
 const tenantStatus=email(tenant.status),memberStatus=email(member.status);
 return Boolean(UUID.test(userId)&&UUID.test(memberId)&&UUID.test(tenantId)&&memberTenant===tenantId
  &&email(tenant.role)==='filho'&&String(member.user_id||'')===userId
  &&(authEmail===shadowEmail||Boolean(memberEmail&&authEmail===memberEmail))
  &&['ativo','active'].includes(memberStatus)
  &&tenant.is_blocked!==true&&!tenant.deleted_at&&!['blocked','deleted','inativo','inactive'].includes(tenantStatus));
}
export function isAllowlistedPilotMember(user,tenant,member){
 return isPilotMember(user,tenant,member)&&user.id===MEMBER_PILOT.userId&&member.id===MEMBER_PILOT.memberId&&String(member.tenant_id||member.tenantId||'')===MEMBER_PILOT.tenantId&&[MEMBER_PILOT.email,MEMBER_PILOT.authEmail].includes(email(user.email));
}
export const memberInterfaceRolloutMode=env=>env?.MEMBER_INTERFACE_ROLLOUT_MODE==='members'?'members':'pilot';
export const memberOperationRolloutMode=env=>env?.MEMBER_OPERATION_ROLLOUT_MODE==='members'?'members':'pilot';
export function canUseMemberInterface(user,tenant,member,mode='pilot'){
 return isPilotMember(user,tenant,member)&&(mode==='members'||isAllowlistedPilotMember(user,tenant,member));
}
