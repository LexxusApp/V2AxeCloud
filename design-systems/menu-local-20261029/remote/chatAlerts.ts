import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '../../../src/lib/supabase';
import {request,scoped,previewSession} from './session';
import {refreshResource,isResourceWriting} from './runtime';
import {createRefreshLoop} from '../refreshLoop';
import {unreadChatAlerts} from '../chatAlertModels';
import type {ChatConversationSummary} from '../../../src/lib/chatTypes';
export function useChatAlerts(active:boolean,enabled=true){
 const {tenantId,userId}=previewSession(),[rows,setRows]=useState<ChatConversationSummary[]>([]),[error,setError]=useState('');
 const activeRef=useRef(active),signature=useRef(''),refresh=useRef(()=>{});activeRef.current=active;
 useEffect(()=>{
  if(!enabled){setRows([]);setError('');return;}
  let alive=true;
  const loop=createRefreshLoop({available:()=>document.visibilityState!=='hidden'&&navigator.onLine!==false,refresh:async()=>{
   try{
    const result=await request(scoped('/api/v1/chat/conversations'));if(!Array.isArray(result.conversations))throw Error('Conversas indisponíveis');
    if(!alive)return;
    setRows(result.conversations);setError('');
    const next=JSON.stringify(result.conversations.map((row:ChatConversationSummary)=>[row.id,row.lastMessageAt,row.unreadCount]));
    if(activeRef.current&&!isResourceWriting('inbox')){if(next!==signature.current)await refreshResource('inbox');signature.current=next;}
   }catch(reason){if(alive)setError('Não foi possível atualizar os avisos de mensagens.');throw reason;}
  }});
  const resume=()=>loop.resume();refresh.current=resume;loop.resume();
  const channel=supabase.channel('pilot-manager-chat-alerts:'+userId).on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages',filter:'tenant_id=eq.'+tenantId},resume).on('postgres_changes',{event:'UPDATE',schema:'public',table:'chat_conversations',filter:'tenant_id=eq.'+tenantId},resume).subscribe();
  window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
  return()=>{alive=false;loop.stop();void supabase.removeChannel(channel);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);refresh.current=()=>{};};
 },[tenantId,userId,enabled]);
 useEffect(()=>{if(active){signature.current='';refresh.current();}},[active]);
 return {alerts:unreadChatAlerts(rows),error,refresh:useCallback(()=>refresh.current(),[])};
}
