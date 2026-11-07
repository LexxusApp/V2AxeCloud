import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '../../../src/lib/supabase';
import { previewSession } from './session';
import { readValue, publishValue, registerLoader, refreshResource } from './runtime';
import { dispatchesFromServer } from '../dispatchReadModels';
import { operations } from '../operations';
import { dispatchStatus } from '../whatsappDispatches';
import { createRefreshLoop } from '../refreshLoop';
import {announceBackgroundDispatch} from '../activityLifecycle';

let sync={refreshing:false,loaded:false,error:'',updatedAt:''};
const listeners=new Set<()=>void>(),seen=new Map<string,string>();
let initialized=false;
const update=(patch:Partial<typeof sync>)=>{sync={...sync,...patch};listeners.forEach(listener=>listener());};
export function useDispatchSync(){return useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},()=>sync,()=>sync);}
registerLoader('dispatches',async()=>{
  update({refreshing:true,error:''});
  try{
    const {tenantId}=previewSession();
    const columns='id,tenant_id,filho_id,tipo,telefone,mensagem,status,external_id,created_at';
    const {data,error}=await supabase.from('whatsapp_logs').select(columns).eq('tenant_id',tenantId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(200);
    if(error)throw error;
    const rows=data||[],ids=operations.externalIds().filter(id=>id&&!id.startsWith('log:')&&!id.startsWith('request:')&&!rows.some(row=>row.external_id===id));
    if(ids.length){const extra=await supabase.from('whatsapp_logs').select(columns).eq('tenant_id',tenantId).in('external_id',ids);if(extra.error)throw extra.error;rows.push(...(extra.data||[]));}
    const records=dispatchesFromServer(rows,tenantId,readValue<any[]>('members')||[]);
    publishValue('dispatches',records);
    for(const record of records){
      const status=dispatchStatus(record),externalId=record.externalId||`log:${record.id}`;
      operations.delivery(externalId,status);operations.delivery(`log:${record.id}`,status);
      const represented=operations.snapshot().some(row=>row.delivery?.externalId===externalId||row.delivery?.externalId===`log:${record.id}`||row.state==='working'&&row.key===`whatsapp:${record.memberId}`);
      if(initialized&&seen.get(record.id)!=='failed'&&!represented&&announceBackgroundDispatch(status)){const activity=operations.begin(`WhatsApp: ${record.title} para ${record.recipient}`);activity.sent(externalId,status);activity.complete();operations.delivery(externalId,status);}
      seen.set(record.id,status);
    }
    initialized=true;update({loaded:true,updatedAt:new Date().toISOString(),error:''});
  }catch(error){update({error:error instanceof Error?error.message:'Não foi possível atualizar os disparos. Os últimos registros foram preservados.'});throw error;}
  finally{update({refreshing:false});}
});
export const refreshDispatches=()=>refreshResource('dispatches');
export function useDispatchPolling(){
  useEffect(()=>{
    const loop=createRefreshLoop({available:()=>document.visibilityState!=='hidden'&&navigator.onLine!==false,refresh:refreshDispatches});
    const resume=()=>loop.resume();
    loop.resume();document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);window.addEventListener('offline',resume);
    return()=>{loop.stop();document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);window.removeEventListener('offline',resume);};
  },[]);
}
