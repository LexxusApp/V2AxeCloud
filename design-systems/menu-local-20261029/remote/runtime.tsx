import PageLoading from '../../shared/PageLoading';
import { useEffect, useSyncExternalStore, type ReactNode, type SetStateAction } from 'react';
import { previewSession, request, scoped, onPreviewSessionChange } from './session';
import { memberFromServer, giraFromServer, financeFromServer } from './readModels';
import { readFinance } from './financeRead';
import { currentOperation, operations, isRemoteMutation, type Operation } from '../operations';
import {supabase} from '../../../src/lib/supabase';
import {grantAllows} from '../../../cloudflare/pilot-granular-policy.js';
type Writer = (next:any,before:any,operation?:Operation)=>Promise<void>;
const values = new Map<string,any>(), states = new Map<string,{loading:boolean;error:string;ready:boolean}>();
const listeners = new Set<()=>void>(), inflight = new Map<string,Promise<void>>(), writes = new Set<string>(), writers = new Map<string,Writer>();
const queuedRefreshes = new Map<string,{after:Promise<void>;promise:Promise<void>}>();
const idle = {loading:false,error:'',ready:false};
// Memory only, scoped to this authenticated document. Mutations bypass this window.
const resourceMaxAge = 30_000;
const loadedAt = new Map<string,number>();
let activeScope: string | undefined;
const notify=()=>listeners.forEach(fn=>fn());
function clearResources() { activeScope=undefined; values.clear(); states.clear(); loadedAt.clear(); inflight.clear(); queuedRefreshes.clear(); writes.clear(); notify(); }
onPreviewSessionChange?.(clearResources);
function resourceScope() {
  const session=previewSession(), scope=JSON.stringify([session.userId,session.tenantId]);
  if(activeScope!==scope){clearResources();activeScope=scope;}
  return scope;
}
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export function useResourceStatus(keys:string[]){resourceScope();useSyncExternalStore(subscribe,()=>keys.map(key=>{const row=states.get(key)||idle;return `${key}:${row.ready}:${row.loading}:${row.error}`;}).join('|'));return Object.fromEntries(keys.map(key=>[key,states.get(key)||idle]));}
const put=(key:string,value:any)=>{resourceScope();return values.set(key,value);};
export function readValue<T=any>(key:string):T { resourceScope();return values.get(key); }
export function isResourceWriting(key:string){return writes.has(key);}
const loaders:Record<string,()=>Promise<void>>={
  members:async()=>{ const p=previewSession();const reference=p.profile?.is_co_admin===true&&!grantAllows(p.profile.permissoes,'members','visualizar');const result=reference?await supabase.rpc('piloto_referencias_membros',{p_tenant:p.tenantId}):await request(scoped('/api/children'));if(result.error)throw result.error;if(!Array.isArray(result.data))throw new Error('Resposta de membros inválida.');put('memberRows',result.data);put('members',result.data.map(memberFromServer)); },
  giras:async()=>{ const result=await request(scoped('/api/events'));if(!Array.isArray(result.data))throw new Error('Resposta da agenda inválida.');put('giras',result.data.filter((row:any)=>!String(row.tipo||'').toLowerCase().includes('obrig')).map(giraFromServer)); },
  finance:async()=>{ const [,rows]=await Promise.all([ensureResource('members'),readFinance()]);put('financeRows',rows);const mapped=financeFromServer(rows,readValue('members'));Object.entries(mapped).forEach(([key,value])=>put(key,value)); },
  pix:async()=>{const {data}=await request(scoped('/api/v1/financial/pix-config'));put('pixSettings',data?{enabled:data.mensalidade_ativa!==false,key:data.chave_pix||'',keyType:({telefone:'phone',aleatoria:'random'}as any)[data.tipo_chave]||data.tipo_chave||'email',beneficiary:data.nome_beneficiario||'',amount:Number(data.valor_mensalidade||0).toFixed(2).replace('.',','),day:String(data.dia_vencimento||10)}:null);},
  account:async()=>{const session=previewSession(),p=session.profile;const profile={house:p.nome_terreiro||p.nome||'',responsible:p.nome_zelador||'',role:p.cargo||'Zelador(a)',tradition:p.tradicao||'',city:p.cidade_publica||'',uf:p.estado_publico||'',phone:p.whatsapp_publico||p.telefone||'',email:session.email,photo:null};const [status,config]=await Promise.all([request('/api/whatsapp/status'),request('/api/whatsapp/config')]);const prefs=config.preferences||{};const whatsapp={connected:status.status==='CONNECTED',days:Number(prefs.giraReminderIntervalDays||3),sameDay:!!prefs.notifGiraNoDia,obligations:!!prefs.notifObrigacoes,monthly:!!prefs.notifFinanceiro,cantina:!!prefs.notifCantina};put('account',{profile,draft:{...profile},whatsapp,whatsDraft:{...whatsapp}});},
};
export async function loadResource(key:string,force=false):Promise<void>{
  const scope=resourceScope();
  if(!canReadResource(key))return;
  if(inflight.has(key)){
    if(!force)return inflight.get(key)!;
    const after=inflight.get(key)!;
    if(queuedRefreshes.get(key)?.after===after)return queuedRefreshes.get(key)!.promise;
    // A mutation may have finished after this read began. Its confirmation
    // needs a new snapshot, with concurrent refresh callers sharing that read.
    const queued=after.then(async()=>{if(activeScope!==scope)return;await loadResource(key,true);}).finally(()=>{if(queuedRefreshes.get(key)?.promise===queued)queuedRefreshes.delete(key);});
    queuedRefreshes.set(key,{after,promise:queued});return queued;
  }
  if(!force&&states.get(key)?.ready&&Date.now()-(loadedAt.get(key)||0)<resourceMaxAge)return;
  states.set(key,{loading:true,error:'',ready:!!states.get(key)?.ready});notify();
  const operation=Promise.resolve().then(async()=>{try{if(!loaders[key])throw new Error('Esta função ainda está sendo conectada ao servidor. Nenhuma alteração local será tratada como salva.');await loaders[key]();if(resourceScope()!==scope)throw new Error('A conta ou a casa mudou durante a consulta.');states.set(key,{loading:false,error:'',ready:true});loadedAt.set(key,Date.now());}catch(error){if(activeScope===scope)states.set(key,{loading:false,error:error instanceof Error?error.message:'Não foi possível carregar os dados reais.',ready:false});}finally{if(inflight.get(key)===operation){inflight.delete(key);notify();}}});
  inflight.set(key,operation);return operation;
}
const delegatedResourceModules:Record<string,string>={
 members:'members',giras:'giras',obligations:'giras',attendance:'giras',preceito:'giras',preceitoId:'giras',
 finance:'finance',charges:'finance',manualCash:'finance',cantina:'cantina',
 inventory:'inventory',notices:'communications',inbox:'communications',
 gallery:'gallery',galleryUsage:'gallery',library:'library',shop:'store',radar:'radar',
 dashboardRadar:'radar',dashboardWhatsApp:'communications',dispatches:'communications',notifications:'communications',
};
export function canReadResource(key:string){
 const profile=previewSession().profile;
 if(profile?.is_co_admin!==true)return true;
 if(['account','support'].includes(key))return true;
 if(key==='members'&&['giras','finance','cantina','communications','library','store'].some(module=>grantAllows(profile.permissoes,module,'visualizar')))return true;
 if(key==='giras'&&grantAllows(profile.permissoes,'communications','visualizar'))return true;
 return grantAllows(profile.permissoes,delegatedResourceModules[key],'visualizar');
}
export function useRemoteState<T>(key:string,empty:T):[T,(next:SetStateAction<T>)=>Promise<void>]{
  resourceScope();
  if(!values.has(key))put(key,empty);
  const value=useSyncExternalStore(subscribe,()=>values.get(key),()=>empty) as T;
  return [value,async(next)=>{const scope=resourceScope();if(writes.has(key))throw new Error('Aguarde a operação em andamento.');const before=values.get(key),after=typeof next==='function'?(next as (old:T)=>T)(before):next;const writer=writers.get(key);if(!writer)throw new Error('Esta ação ainda não está ligada à API. Nenhum registro foi alterado.');
    const delegated=previewSession().profile;
    if(delegated?.is_co_admin===true){
      const module=delegatedResourceModules[key];
      if(key!=='support'&&(!module||delegated.permissoes?.[module]!=='gerenciar'))
        throw new Error('Este acesso está configurado apenas para consulta ou não foi liberado pelo zelador.');
    }const parent=currentOperation(),own=!parent&&isRemoteMutation(key,after,before),operation=parent||(own?operations.begin('Atualizando os dados da casa',key):undefined);operation?.resource(key);writes.add(key);try{await writer(after,before,operation);if(resourceScope()!==scope)throw new Error('A conta ou a casa mudou durante a operação.');if(own)operation?.complete();}catch(error){if(own)operation?.fail(error);throw error;}finally{writes.delete(key);notify();}}];
}
export function registerWriter(key:string,writer:Writer){writers.set(key,writer);}
export function registerLoader(key:string,loader:()=>Promise<void>){loaders[key]=loader;}
export async function ensureResource(key:string){await loadResource(key);const queued=queuedRefreshes.get(key);if(queued)await queued.promise;const state=states.get(key);if(!state?.ready)throw new Error(state?.error||`Não foi possível carregar ${key}.`);}
export async function refreshResource(key:string){if(!canReadResource(key))return;await loadResource(key,true);const state=states.get(key);if(!state?.ready)throw new Error(`A operação foi recebida, mas a atualização da tela falhou: ${state?.error||key}. Atualize antes de repetir.`);}
export function publishValue(key:string,value:any){put(key,value);notify();}
const routes:Record<string,string[]>={dashboard:['home','preceito'],children:['members','finance','giras','obligations'],'member-finance':['finance','cantina','shop'],calendar:['giras','members','preceito'],financial:['finance','members','pix'],'financial-mensalidades':['finance','members','pix'],'financial-configs':['pix'],'financial-cantina':['cantina','members'],settings:['account'],radar:['radar','account'],obligations:['obligations','members'],frequencia:['attendance','members','giras'],mural:['notices','members','giras'],chat:['inbox','members'],gallery:['gallery'],inventory:['inventory'],library:['library','members'],store:['shop','members','cantina'],subscription:['subscription','members'],suporte:[]};
export function RemotePageGate({tab,children}:{tab:string;children:ReactNode}){
  resourceScope();
  // A page may show supplemental data from other modules. A delegated
  // member must never load those resources without an explicit grant.
  const profile=previewSession().profile;
  const resources=(routes[tab]||[tab]).filter(key=>{
   if(profile?.is_co_admin!==true)return true;
   return canReadResource(key);
  });
  const signature=useSyncExternalStore(subscribe,()=>resources.map(key=>{const s=states.get(key)||idle;return `${key}:${s.loading}:${s.ready}:${s.error}`;}).join('|'));
  useEffect(()=>{void Promise.all(resources.map(key=>loadResource(key)));},[tab]);
  const error=resources.map(key=>states.get(key)?.error).find(Boolean),ready=resources.every(key=>states.get(key)?.ready);
  // The dashboard reveals each independently verified area as it arrives.
  // A slow integration must not prevent the greeting, menu or other cards.
  if(tab==='dashboard')return <>{children}</>;
  if(!ready&&!error)return <PageLoading route={tab}/>;
  if(!ready)return <section className="hs-state" role="alert"><h2>Não foi possível carregar esta área.</h2><p>{error}</p><button className="button secondary" onClick={()=>void Promise.all(resources.map(key=>loadResource(key,true)))}>Tentar novamente</button></section>;
  const module=({children:'members',calendar:'giras',obligations:'giras',frequencia:'giras',financial:'finance','financial-mensalidades':'finance','financial-cantina':'cantina',inventory:'inventory',mural:'communications',chat:'communications',gallery:'gallery',library:'library',store:'store',radar:'radar'} as Record<string,string>)[tab];
  const readOnly=profile?.is_co_admin===true&&profile.permissoes?.[module]==='visualizar';
  return <>{readOnly&&<p className="cap-readonly-note" role="note">Você tem acesso de consulta nesta área. Alterações precisam ser liberadas pelo zelador.</p>}{children}</>;
}
