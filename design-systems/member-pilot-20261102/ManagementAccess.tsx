import {useId,useState,useSyncExternalStore} from 'react';
import {ArrowRight,Loader2,ShieldCheck} from 'lucide-react';
import {authFetch} from '../../src/lib/authenticatedFetch';
import {memberSession,onMemberSessionChange} from './session';
export default function ManagementAccess({banner=false}:{banner?:boolean}){
 useSyncExternalStore(onMemberSessionChange,()=>memberSession().tenant);
 const {tenant}=memberSession();const [busy,setBusy]=useState(false),[error,setError]=useState('');const errorId=useId();
 if(tenant.is_co_admin!==true)return null;
 const open=async()=>{
  if(busy)return;setBusy(true);setError('');
  try{
   const response=await authFetch('/api/pilot/interface-access?space=manager',{method:'POST',cache:'no-store'});
   const access=await response.json();
   if(!response.ok||access.enabled!==true||access.interface!=='manager')throw Error(access.error||'Não foi possível confirmar seu acesso. Tente novamente.');
   location.assign('/dashboard?space=manager');
  }catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível abrir a gestão. Tente novamente.');setBusy(false);}
 };
 return <div className={banner?'mp-management-banner':'mp-management-nav'}>
  {banner&&<div className="mp-management-copy"><ShieldCheck size={25}/><div><strong>Você também ajuda a cuidar da casa</strong><p>Acesse as áreas liberadas pelo zelador. Seu espaço de membro continua aqui.</p></div></div>}
  <a href="/dashboard?space=manager" aria-disabled={busy} aria-describedby={error?errorId:undefined} aria-label={busy?'Abrindo Gestão da Casa':'Gestão da Casa'} onClick={event=>{event.preventDefault();void open();}}>{busy?<Loader2 size={19} className="mp-management-spinner"/>:<ShieldCheck size={19}/>}<span>{busy?'Abrindo gestão…':banner?'Acessar Gestão da Casa':'Gestão da Casa'}</span><ArrowRight size={16}/></a>
  {error&&<p id={errorId} className="mp-management-error" role="alert">{error}</p>}
 </div>;
}
