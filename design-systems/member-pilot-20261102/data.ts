import {useCallback,useEffect,useRef,useState} from 'react';
import {authFetch} from './authenticatedFetch';
export async function readJson(url:string,init:RequestInit={}){const response=await authFetch(url,{cache:'no-store',...init});const data=await response.json();if(!response.ok)throw Error(data.error||data.message||'Não foi possível consultar os dados da casa.');return data;}
export function useRead<T=any>(url:string){
 const [data,setData]=useState<T|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const active=useRef(true),inflight=useRef<AbortController|null>(null);
 const refresh=useCallback(async()=>{if(inflight.current)return;const controller=new AbortController();inflight.current=controller;setLoading(true);setError('');try{const result=await readJson(url,{signal:controller.signal});if(active.current&&!controller.signal.aborted)setData(result);}catch(reason){if(active.current&&!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Não foi possível atualizar.');}finally{if(inflight.current===controller)inflight.current=null;if(active.current&&!controller.signal.aborted)setLoading(false);}},[url]);
 useEffect(()=>{active.current=true;setData(null);void refresh();const visible=()=>{if(document.visibilityState!=='hidden'&&navigator.onLine!==false)void refresh();};const timer=setInterval(visible,30000);window.addEventListener('focus',visible);window.addEventListener('online',visible);window.addEventListener('axecloud:finance-updated',visible);return()=>{active.current=false;inflight.current?.abort();inflight.current=null;clearInterval(timer);window.removeEventListener('focus',visible);window.removeEventListener('online',visible);window.removeEventListener('axecloud:finance-updated',visible);};},[refresh]);
 return {data,loading,error,refresh};
}
