import {supabase} from '../../src/lib/supabase';
import {authFetch} from '../../src/lib/authenticatedFetch';
import {isPilotMember} from '../../cloudflare/member-pilot-policy.js';
import type {User} from '@supabase/supabase-js';
export type MemberSession={user:User;tenant:Record<string,any>;member:Record<string,any>};
let connected:MemberSession;
const sessionListeners=new Set<()=>void>();
export const onMemberSessionChange=(listener:()=>void)=>{sessionListeners.add(listener);return()=>{sessionListeners.delete(listener);};};
export const memberSession=()=>{if(!connected)throw Error('Entre na sua conta para continuar.');return connected;};
export async function connectMember(signal:AbortSignal){
 const {data:{session},error}=await supabase.auth.getSession();signal.throwIfAborted();if(error)throw error;
 if(!session){location.replace('/entrar');return false;}
 const accessResponse=await authFetch('/api/pilot/interface-access?space=member',{method:'POST',cache:'no-store',signal});const access=await accessResponse.json();
 if(!accessResponse.ok){if(accessResponse.status>=500)throw Error('Não foi possível validar seu acesso. Tente novamente.');location.replace('/dashboard?classic=1');return false;}
 if(!access.enabled||access.interface!=='member'){location.replace('/dashboard?classic=1');return false;}
 let tenant=access.profile,member=access.member;
 if(!tenant||!member){const query=new URLSearchParams({userId:session.user.id,email:session.user.email||''});const [tenantResponse,profileResponse]=await Promise.all([authFetch('/api/tenant-info?'+query,{signal}),authFetch('/api/v1/filho/profile',{signal})]);if(!tenantResponse.ok||!profileResponse.ok)throw Error('Não foi possível carregar seu vínculo com a casa.');tenant=await tenantResponse.json();member=(await profileResponse.json()).data;}
 signal.throwIfAborted();
 if(!isPilotMember(session.user,tenant,member)){location.replace('/dashboard?classic=1');return false;}
 connected={user:session.user,tenant,member};
 supabase.auth.onAuthStateChange((event,next)=>{if(event==='SIGNED_OUT'||next&&next.user.id!==connected.user.id)location.replace('/entrar');});
 let renewing=false,verifiedAt=Date.now();
 const renew=async()=>{if(document.visibilityState==='hidden'||renewing||Date.now()-verifiedAt<60_000)return;renewing=true;try{const response=await authFetch('/api/pilot/interface-access?space=member',{method:'POST',cache:'no-store'});if(response.status>=500)return;const result=await response.json();if(!response.ok||!result.enabled||result.interface!=='member'||!isPilotMember(connected.user,result.profile,result.member)){location.replace('/dashboard?classic=1');return;}verifiedAt=Date.now();connected={...connected,tenant:result.profile,member:result.member};sessionListeners.forEach(listener=>listener());}catch{/* Connectivity never triggers a logout. */}finally{renewing=false;}};
 setInterval(()=>void renew(),60_000);document.addEventListener('visibilitychange',()=>void renew());
 return true;
}
