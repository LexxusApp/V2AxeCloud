import {isPilotManager,PILOT_TENANT,PILOT_PREFIX,PILOT_MANAGERS} from './pilot-interface-policy.js';
import {canUseMemberInterface,memberInterfaceRolloutMode,MEMBER_PILOT,MEMBER_PREFIX} from './member-pilot-policy.js';
import {signedMemberCookie,validMemberCookie,readMemberCookie,memberCookieIdentity,memberCookieHeader} from './member-pilot-cookie.js';
import {pilotBootstrap} from './pilot-bootstrap.js';
import {handlePilotLibrary} from './pilot-library.js';
import {handlePilotNotices} from './pilot-notices.js';
import {handlePilotRadar} from './pilot-radar.js';
import {requirePilotOperationAccess} from './pilot-operation-access.js';
import {readDelegatedPilotPermissions} from './pilot-coadmin-access.js';
const COOKIE='__Host-axecloud-pilot';
const TTL=3600;
const rolloutMode=env=>env.INTERFACE_ROLLOUT_MODE==='managers'?'managers':'pilot';
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Authorization, Cookie',...extra}});
const deny=(data,status=200)=>{const response=json(data,status,{'Set-Cookie':cookieHeader('')});response.headers.append('Set-Cookie',memberCookieHeader(''));return response;};
const base64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const unbase64=text=>Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')),char=>char.charCodeAt(0));
async function key(secret){return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function signedCookie(secret,tenant=PILOT_TENANT,now=Date.now()){
 if(typeof tenant==='number'){now=tenant;tenant=PILOT_TENANT;}
 const payload=base64(new TextEncoder().encode(JSON.stringify({purpose:'manager-pilot-20261101',tenant,exp:Math.floor(now/1000)+TTL})));
 return payload+'.'+base64(await crypto.subtle.sign('HMAC',await key(secret),new TextEncoder().encode(payload)));
}
export async function validCookie(value,secret,now=Date.now(),mode='pilot'){
 try{if(!secret||!value)return false;const parts=value.split('.');if(parts.length!==2)return false;const [payload,signature]=parts;if(!await crypto.subtle.verify('HMAC',await key(secret),unbase64(signature),new TextEncoder().encode(payload)))return false;const data=JSON.parse(new TextDecoder().decode(unbase64(payload)));const tenantAllowed=mode==='managers'?/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.tenant):PILOT_MANAGERS.some(m=>m.id===data.tenant);return (data.purpose===undefined||data.purpose==='manager-pilot-20261101')&&tenantAllowed&&data.exp>Math.floor(now/1000)&&data.exp<=Math.floor(now/1000)+TTL;}catch{return false;}
}
const cookieHeader=value=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${value?TTL:0}`;
function readCookie(request){return (request.headers.get('cookie')||'').split(';').map(part=>part.trim()).find(part=>part.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
async function authenticatedPilotVersion(request,env){
 if(request.method!=='GET')return json({error:'Método não permitido.'},405);
 try{
  const access=await requirePilotOperationAccess(request,env,fetch,{allowMember:true});
  // A delegated co-admin also passes the manager authorization checks. The
  // version must reflect the displayed interface, not the strongest role.
  let viewingMember=false;
  try{
   const referringPage=new URL(request.headers.get('referer')||'');
   viewingMember=referringPage.origin===new URL(request.url).origin
    && /^\/dashboard\/?$/.test(referringPage.pathname)
    && referringPage.searchParams.get('space')==='member';
  }catch{}
  const memberCookie=viewingMember
   ?await memberCookieIdentity(readMemberCookie(request),env.PILOT_COOKIE_SECRET)
   :null;
  const verifiedMemberView=Boolean(
   memberCookie&&access.member
   &&memberCookie.user===access.user?.id
   &&memberCookie.member===access.member.id
   &&memberCookie.tenant===access.tenantId
  );
  const target=new URL(request.url);
  target.pathname=access.role==='member'||verifiedMemberView?'/member/pilot-version.json':'/pilot-version.json';
  target.search='';
  const asset=await env.ASSETS.fetch(new Request(target,request));
  if(!asset.ok)return json({error:'Versão indisponível.'},503);
  const headers=new Headers(asset.headers);headers.set('Cache-Control','private, no-store, no-cache, must-revalidate');headers.set('Vary','Authorization, Cookie, Referer');headers.set('X-Content-Type-Options','nosniff');
  return new Response(asset.body,{status:asset.status,headers});
 }catch(error){return json({error:error?.message||'Não foi possível verificar a atualização.'},error?.status||503);}
}
async function refreshPilotAssets(request,env){
 if(request.method!=='POST')return json({error:'Método não permitido.'},405);
 if(!['https://axecloud.com.br','http://localhost:5188'].includes(request.headers.get('origin')))return json({error:'Origem inválida.'},403);
 try{
  await requirePilotOperationAccess(request,env,fetch,{allowMember:true});
  return json({success:true},200,{'Clear-Site-Data':'"cache"'});
 }catch(error){return json({error:error?.message||'Não foi possível preparar a atualização.'},error?.status||503);}
}
async function checkAccess(request,env){
 if(request.method!=='POST')return json({enabled:false},405);
 if(request.headers.get('origin')!=='https://axecloud.com.br')return deny({enabled:false},403);
 const authorization=request.headers.get('authorization')||'';
 if(!/^Bearer \S+$/.test(authorization))return deny({enabled:false},401);
 try{
  const read=async(input)=>{let response=await env.API.fetch(input);if([500,502,503,504].includes(response.status)){await response.body?.cancel().catch(()=>{});response=await env.API.fetch(input);}return response;};
  const configResponse=await read('https://axecloud.com.br/api/public-config');
  if(!configResponse.ok)throw Error('config');const config=await configResponse.json();
  const userResponse=await fetch(config.supabaseUrl+'/auth/v1/user',{headers:{apikey:config.supabaseAnonKey,Authorization:authorization}});
  if(!userResponse.ok)return deny({enabled:false},401);
  const user=await userResponse.json();
  const mode=rolloutMode(env);
  if(mode==='pilot'&&memberInterfaceRolloutMode(env)!=='members'&&!PILOT_MANAGERS.some(m=>m.id===user.id)&&user.id!==MEMBER_PILOT.userId&&!user.email?.endsWith('@axecloud.internal')&&user.email!==MEMBER_PILOT.email)return deny({enabled:false});
  const query=new URLSearchParams({userId:user.id,email:user.email||''});
  const profileResponse=await read(new Request('https://axecloud.com.br/api/tenant-info?'+query,{headers:{Authorization:authorization}}));
  if(profileResponse.status>=500)throw Error('profile unavailable');
  if(!profileResponse.ok)return deny({enabled:false},403);
  const profile=await profileResponse.json();
  const url=new URL(request.url);
  const requestedSpace=url.searchParams.get('space');
  const delegation=await readDelegatedPilotPermissions({user,profile,config,authorization,fetcher:fetch});
  const coAdminEligible=Boolean(delegation);
  if(coAdminEligible&&requestedSpace!=='manager'){
   // The same verified account has two distinct roles. Resolve the actual
   // member record before switching; the manager role from tenant-info must
   // never be mistaken for proof of an active member relationship.
   const memberResponse=await read(new Request('https://axecloud.com.br/api/v1/filho/profile',{headers:{Authorization:authorization}}));
   if(memberResponse.status>=500)throw Error('member profile unavailable');
   const member=memberResponse.ok?(await memberResponse.json()).data:null;
   const memberProfile={...profile,role:'filho',is_co_admin:true,tenant_id:delegation.tenantId,permissoes:delegation.permissions};
   if(!canUseMemberInterface(user,memberProfile,member,memberInterfaceRolloutMode(env)))return json({enabled:false,error:'Vínculo de membro indisponível.'},403);
   if(!env.PILOT_COOKIE_SECRET)throw Error('secret');
   const tenantId=String(member.tenant_id||member.tenantId),memberId=String(member.id);
   const response=json({enabled:true,interface:'member',tenantId,memberId,profile:memberProfile,member,isCoAdmin:true});
   response.headers.append('Set-Cookie',memberCookieHeader(await signedMemberCookie(env.PILOT_COOKIE_SECRET,{user:user.id,member:memberId,tenant:tenantId})));
   response.headers.append('Set-Cookie',cookieHeader(await signedCookie(env.PILOT_COOKIE_SECRET,tenantId)));
   return response;
  }
  const coAdmin=coAdminEligible&&requestedSpace==='manager';

  if(coAdmin){
   const tenantId=delegation.tenantId;
   if(mode!=='managers'&&tenantId!==PILOT_TENANT)return deny({enabled:false},403);
   profile.role='admin';
   profile.cargo=profile.cargo||'Co-Administrador';
   profile.is_co_admin=true;
   profile.permissoes=delegation.permissions;
   profile.tenant_id=tenantId;
   if(!env.PILOT_COOKIE_SECRET)throw Error('secret');
   let member=null;
   try{
     const memberResponse=await read(new Request('https://axecloud.com.br/api/v1/filho/profile',{headers:{Authorization:authorization}}));
     if(memberResponse.ok){
       member=(await memberResponse.json()).data;
     }
   }catch{}
   const verifiedMember=canUseMemberInterface(user,{...profile,role:'filho'},member,memberInterfaceRolloutMode(env));
   if(!verifiedMember)return deny({enabled:false,error:'Seu vínculo de membro não está ativo.'},403);
   const memberId=verifiedMember?String(member.id):'';
   const managerCookieVal=await signedCookie(env.PILOT_COOKIE_SECRET,tenantId);
   const memberCookieVal=verifiedMember?await signedMemberCookie(env.PILOT_COOKIE_SECRET,{user:user.id,member:memberId,tenant:tenantId}):null;
   const response=json({enabled:true,interface:'manager',tenantId,profile,member:verifiedMember?member:null,isCoAdmin:true},200,{'Set-Cookie':cookieHeader(managerCookieVal)});
   if(memberCookieVal)response.headers.append('Set-Cookie',memberCookieHeader(memberCookieVal));
   return response;
  }

  if(String(profile?.role||'').toLowerCase()==='filho'||profile?.is_co_admin===true){
   profile.role='filho';profile.is_co_admin=false;profile.permissoes={};
   const memberResponse=await read(new Request('https://axecloud.com.br/api/v1/filho/profile',{headers:{Authorization:authorization}}));
   if(memberResponse.status>=500)throw Error('profile unavailable');
   const member=memberResponse.ok?(await memberResponse.json()).data:null;
   if(!canUseMemberInterface(user,profile,member,memberInterfaceRolloutMode(env)))return deny({enabled:false});
   if(requestedSpace==='manager')return deny({enabled:false,error:'O acesso de gestão foi revogado. Continue no seu espaço de membro.',code:'DELEGATION_REVOKED'},403);
   if(!env.PILOT_COOKIE_SECRET)throw Error('secret');
   const tenantId=String(member.tenant_id||member.tenantId),memberId=String(member.id);
   const response=json({enabled:true,interface:'member',tenantId,memberId,profile,member,isCoAdmin:coAdminEligible});
   response.headers.append('Set-Cookie',memberCookieHeader(await signedMemberCookie(env.PILOT_COOKIE_SECRET,{user:user.id,member:memberId,tenant:tenantId})));
   if(!coAdminEligible)response.headers.append('Set-Cookie',cookieHeader(''));return response;
  }
  if(!isPilotManager(user,profile,mode))return deny({enabled:false});
  if(!env.PILOT_COOKIE_SECRET)throw Error('secret');
  const tenantId=profile.tenant_id||user.id;const response=json({enabled:true,tenantId,profile},200,{'Set-Cookie':cookieHeader(await signedCookie(env.PILOT_COOKIE_SECRET,tenantId))});response.headers.append('Set-Cookie',memberCookieHeader(''));return response;
 }catch{return deny({enabled:false,error:'Não foi possível validar o acesso ao piloto.'},503);}
}
function secure(response,pilot=false){const headers=new Headers(response.headers);headers.set('Cache-Control','private, no-store');headers.set('Vary','Cookie');headers.set('X-Content-Type-Options','nosniff');headers.set('X-Robots-Tag','noindex,nofollow');headers.set('X-AxeCloud-Interface',pilot?'pilot-5188':'current');if(pilot){headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' https://sdk.pagseguro.uol.com.br https://*.efi.com.br https://*.gerencianet.com.br https://tokenizer.sejaefi.com.br https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.efi.com.br https://*.gerencianet.com.br https://tokenizer.sejaefi.com.br https://cloudflareinsights.com https://*.r2.cloudflarestorage.com https://*.r2.dev https://*.backblazeb2.com https://*.s3.us-east-005.backblazeb2.com; frame-src 'self' blob: https://vlaojhfwhqmwudqsumpi.supabase.co https://*.efi.com.br https://*.gerencianet.com.br https://tokenizer.sejaefi.com.br; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self' https://*.efi.com.br https://*.gerencianet.com.br; upgrade-insecure-requests");headers.set('Strict-Transport-Security','max-age=31536000; includeSubDomains; preload');headers.set('Referrer-Policy','strict-origin-when-cross-origin');}return new Response(response.body,{status:response.status,headers});}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(request.method==='GET'&&[PILOT_PREFIX+'pilot-version.json',MEMBER_PREFIX+'pilot-version.json'].includes(url.pathname)){
  const target=new URL(request.url);target.pathname=url.pathname.startsWith(MEMBER_PREFIX)?'/member/pilot-version.json':'/pilot-version.json';target.search='';
  const asset=await env.ASSETS.fetch(new Request(target,request));const headers=new Headers(asset.headers);headers.set('Cache-Control','public, no-store, no-cache, must-revalidate');headers.set('X-Content-Type-Options','nosniff');headers.set('X-Robots-Tag','noindex,nofollow');
  return new Response(asset.body,{status:asset.status,headers});
 }
 if(url.pathname==='/api/pilot/version')return authenticatedPilotVersion(request,env);
 if(url.pathname==='/api/pilot/refresh')return refreshPilotAssets(request,env);
 if(/^\/api\/pilot\/support\/?$/.test(url.pathname))return json({error:'Atualize o painel e abra o menu Suporte para acessar seus chamados.'},410);
 if(url.pathname.startsWith('/api/pilot/library/'))return handlePilotLibrary(request,env);
 if(/^\/api\/pilot\/notices(\/.*)?$/.test(url.pathname))return handlePilotNotices(request,env);
 if(/^\/api\/pilot\/radar\/?$/.test(url.pathname))return handlePilotRadar(request,env);
 if(['/api/pilot/signout','/api/pilot/member-signout'].includes(url.pathname)){
  if(request.method!=='POST'||!['https://axecloud.com.br','http://localhost:5188'].includes(request.headers.get('origin')))return json({success:false},403);
  const response=json({success:true},200,{'Set-Cookie':cookieHeader('')});response.headers.append('Set-Cookie',memberCookieHeader(''));return response;
 }
 if(url.pathname==='/api/pilot/interface-access')return checkAccess(request,env);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method Not Allowed',{status:405});
 // Match the aliases already declared by AppRouter without exposing pilot HTML.
 // Authorization and interface selection still happen at /dashboard.
 if(/^\/(financeiro|mensalidades)\/?$/.test(url.pathname)){
  const target=new URL(request.url);target.pathname='/dashboard';target.searchParams.set('tab','financial');
  return Response.redirect(target.toString(),301);
 }
 const mode=rolloutMode(env);
 const allowed=await validCookie(readCookie(request),env.PILOT_COOKIE_SECRET,Date.now(),mode);
 const memberAllowed=await validMemberCookie(readMemberCookie(request),env.PILOT_COOKIE_SECRET);
 if(url.pathname.startsWith(MEMBER_PREFIX)){
  if(!memberAllowed)return new Response('Forbidden',{status:403,headers:{'Cache-Control':'no-store'}});
  const target=new URL(request.url);target.pathname='/member/'+url.pathname.slice(MEMBER_PREFIX.length);target.search='';
  const response=secure(await env.ASSETS.fetch(new Request(target,request)),true);response.headers.set('X-AxeCloud-Interface','member-pilot');return response;
 }
 if(memberAllowed&&/^\/dashboard\/?$/.test(url.pathname)&&url.searchParams.get('space')!=='manager'&&!url.searchParams.has('classic')){
  const target=new URL(request.url);target.pathname='/member/index.html';target.search='';
  const response=secure(await env.ASSETS.fetch(new Request(target,request)),true);response.headers.set('X-AxeCloud-Interface','member-pilot');return response;
 }

 if(url.pathname.startsWith(PILOT_PREFIX)){
  if(!allowed)return new Response('Forbidden',{status:403,headers:{'Cache-Control':'no-store'}});
  const target=new URL(request.url);target.pathname='/'+url.pathname.slice(PILOT_PREFIX.length);target.search='';
  return secure(await env.ASSETS.fetch(new Request(target,request)),true);
 }
 if(allowed&&/^\/dashboard\/?$/.test(url.pathname)&&url.searchParams.get('space')!=='member'&&!url.searchParams.has('classic')){
  const target=new URL(request.url);target.pathname='/index.html';target.search='';
  return secure(await env.ASSETS.fetch(new Request(target,request)),true);
 }
 if(memberAllowed&&/^\/dashboard\/?$/.test(url.pathname)&&url.searchParams.get('space')!=='manager'&&!url.searchParams.has('classic')){
  const target=new URL(request.url);target.pathname='/member/index.html';target.search='';
  const response=secure(await env.ASSETS.fetch(new Request(target,request)),true);response.headers.set('X-AxeCloud-Interface','member-pilot');return response;
 }
 const original=await env.CURRENT_APP.fetch(request);
 if(!original.headers.get('content-type')?.includes('text/html'))return original;
 // The current application's assets and document stay owned by the existing Worker.
 // Only an authenticated allowlisted manager receives the reload into the pilot.
 const bootstrap=pilotBootstrap([...PILOT_MANAGERS.map(m=>m.id),MEMBER_PILOT.userId],mode==='managers'||memberInterfaceRolloutMode(env)==='members');
 return secure(new HTMLRewriter().on('head',{element(head){head.prepend('<script>'+bootstrap+'</script>',{html:true});}}).transform(original));
}};
