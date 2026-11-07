import {MEMBER_PILOT} from './member-pilot-policy.js';
export const MEMBER_COOKIE='__Host-axecloud-member-pilot';
const TTL=3600;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encode=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const decode=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const key=secret=>crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
const pilotBinding={user:MEMBER_PILOT.userId,member:MEMBER_PILOT.memberId,tenant:MEMBER_PILOT.tenantId};
const validBinding=value=>value&&UUID.test(String(value.user||''))&&UUID.test(String(value.member||''))&&UUID.test(String(value.tenant||''));
export async function signedMemberCookie(secret,binding=pilotBinding,now=Date.now()){
 if(typeof binding==='number'){now=binding;binding=pilotBinding;}
 if(!validBinding(binding))throw Error('Vínculo de membro inválido.');
 const payload=encode(new TextEncoder().encode(JSON.stringify({purpose:'member-pilot-20261102',user:binding.user,member:binding.member,tenant:binding.tenant,exp:Math.floor(now/1000)+TTL})));
 return payload+'.'+encode(await crypto.subtle.sign('HMAC',await key(secret),new TextEncoder().encode(payload)));
}
export async function memberCookieIdentity(value,secret,now=Date.now()){
 try{if(!secret||!value||value.length>2048)return null;const parts=value.split('.');if(parts.length!==2)return null;const [payload,signature]=parts;if(!await crypto.subtle.verify('HMAC',await key(secret),decode(signature),new TextEncoder().encode(payload)))return null;const data=JSON.parse(new TextDecoder().decode(decode(payload)));return data.purpose==='member-pilot-20261102'&&validBinding(data)&&data.exp>Math.floor(now/1000)&&data.exp<=Math.floor(now/1000)+TTL?data:null;}catch{return null;}
}
export async function validMemberCookie(value,secret,now=Date.now()){return Boolean(await memberCookieIdentity(value,secret,now));}
export const memberCookieHeader=value=>`${MEMBER_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${value?TTL:0}`;
export const readMemberCookie=request=>(request.headers.get('cookie')||'').split(';').map(part=>part.trim()).find(part=>part.startsWith(MEMBER_COOKIE+'='))?.slice(MEMBER_COOKIE.length+1)||'';
