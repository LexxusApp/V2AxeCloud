import {useCallback,useEffect,useRef,useState} from 'react';
import {authFetch} from './authenticatedFetch';
import type {ReceiptReview} from '../../lib/receiptReview';
export const RECEIPT_UPDATED='axecloud:receipt-review-updated';
export async function receiptRequest(url:string,init:RequestInit={},timeout=25_000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await authFetch(url,{...init,signal:controller.signal});const body=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(body.error||'Não foi possível concluir. Tente novamente.');return body;
  }catch(error){if(controller.signal.aborted)throw Error('A conexão demorou demais. Tente novamente; um envio já recebido não será duplicado.');throw error;}
  finally{clearTimeout(timer);}
}
export function signalReceiptUpdate(){window.dispatchEvent(new Event(RECEIPT_UPDATED));window.dispatchEvent(new Event('axecloud:finance-updated'));}
export function useReceiptReviews(userId:string|undefined|null,tenantId:string|undefined|null,enabled:boolean,initialStatus='em_analise'){
  const [filter,setFilter]=useState(initialStatus),[rows,setRows]=useState<ReceiptReview[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false),[cursor,setCursor]=useState<string|null>(null),[pendingCount,setPendingCount]=useState(0),[openIds,setOpenIds]=useState<string[]>([]);
  const scope=`${userId}:${tenantId}:${filter}:${enabled}`,scopeRef=useRef(scope);scopeRef.current=scope;
  const inFlight=useRef(new Set<string>()),revision=useRef(0);
  const load=useCallback(async(more=false)=>{
    if(!enabled||!userId||!tenantId)return;const key=scopeRef.current+':'+(more?cursor:'first');if(inFlight.current.has(key))return;
    inFlight.current.add(key);const ownScope=scopeRef.current,version=++revision.current;setLoading(true);setError('');
    try{
      const body=await receiptRequest(`/api/v1/financial/comprovantes?tenantId=${encodeURIComponent(tenantId)}&status=${encodeURIComponent(filter)}&limit=30${more&&cursor?'&cursor='+encodeURIComponent(cursor):''}`);
      if(scopeRef.current!==ownScope||version!==revision.current)return;
      setRows(previous=>more?[...new Map([...previous,...body.data].map(row=>[row.id,row])).values()]:body.data||[]);
      setCursor(body.next_cursor||null);setPendingCount(Number(body.pending_count)||0);setOpenIds(body.open_financeiro_ids||[]);
    }catch(e){if(scopeRef.current===ownScope&&version===revision.current)setError(e instanceof Error?e.message:'Não foi possível consultar os comprovantes.');}
    finally{inFlight.current.delete(key);if(scopeRef.current===ownScope&&version===revision.current)setLoading(false);}
  },[userId,tenantId,enabled,filter,cursor]);
  const loadRef=useRef(load);loadRef.current=load;
  useEffect(()=>{
    setRows([]);setCursor(null);setError('');setPendingCount(0);setOpenIds([]);setLoading(false);
    void loadRef.current();if(!enabled)return;
    const refresh=()=>{if(document.visibilityState==='visible')void loadRef.current();};
    const interval=window.setInterval(refresh,30_000);window.addEventListener(RECEIPT_UPDATED,refresh);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
    return()=>{window.clearInterval(interval);window.removeEventListener(RECEIPT_UPDATED,refresh);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);};
  },[userId,tenantId,enabled,filter]);
  return {rows,error,loading,cursor,pendingCount,openIds,filter,setFilter,refresh:()=>load(false),loadMore:()=>load(true)};
}
export type ReceiptFeed=ReturnType<typeof useReceiptReviews>;
