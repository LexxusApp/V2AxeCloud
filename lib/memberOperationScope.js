// Member privileges are independent of delegated management permissions.
// These are member-facing operations, not a bypass for arbitrary manager APIs.
// The edge caller must also verify a live child binding against the JWT user.
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const cycleAction=new RegExp('^/api/v1/preceitos/'+UUID+'/(?:acknowledge|guidance)$','i');
const chatMessage=new RegExp('^/api/v1/chat/conversations/'+UUID+'/(?:messages|read)$','i');
const chatThread=new RegExp('^/api/v1/chat/conversations/'+UUID+'(?:/messages)?$','i');
export function isPilotPersonalMemberOperation(url,method='GET'){
 const parsed=typeof url==='string'?new URL(url,'https://axecloud.com.br'):url;
 const path=parsed.pathname.replace(/\/$/,'');
 const verb=String(method).toUpperCase();
 if(verb==='GET'){
  if(path==='/api/events')return parsed.searchParams.get('scope')==='calendar';
  if(path==='/api/v1/preceitos/current')return true;
  if(path==='/api/transactions')return parsed.searchParams.get('userRole')==='filho';
  if(path==='/api/v1/financial/pix-config')return true;
  if(path==='/api/notices')return true;
  if(/^\/api\/v1\/(?:library\/(?:materials|pdf-proxy|material\/[0-9a-f-]+)|gallery\/(?:albums|media\/[0-9a-f-]+)|store\/(?:products|orders)|chat\/(?:contacts|conversations|media))$/i.test(path))return true;
  if(chatThread.test(path))return true;
 }
 if(verb==='POST'){
  if(cycleAction.test(path))return true;
  if(path==='/api/v1/store/checkout')return true;
  if(path==='/api/v1/chat/conversations'||path==='/api/v1/chat/upload-url'||chatMessage.test(path))return true;
 }
 return false;
}
export function matchesActivePilotChild(child,tenant,userId){
 const status=String(child?.status||'').trim().toLowerCase();
 return Boolean(child&&child.user_id===userId&&
   (child.tenant_id||child.lider_id)===tenant&&
   ['ativo','active'].includes(status));
}
