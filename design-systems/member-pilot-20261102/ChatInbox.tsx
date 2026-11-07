import {useCallback,useEffect,useRef,useState} from 'react';
import Chat from './Chat';
import {authFetch} from './authenticatedFetch';
import {supabase} from '../../src/lib/supabase';
import {createRefreshLoop} from '../menu-local-20261029/refreshLoop';
import type {ChatContact,ChatConversationSummary} from '../../src/lib/chatTypes';
export default function ChatInbox({tenantData,userId}:{tenantData?:{tenant_id?:string;id?:string}|null;userId:string;userRole?:string;setActiveTab?:(tab:string)=>void}){
 const tenantId=String(tenantData?.tenant_id||tenantData?.id||''),[conversations,setConversations]=useState<ChatConversationSummary[]>([]),[contacts,setContacts]=useState<ChatContact[]>([]),[selectedId,setSelectedId]=useState<string|null>(null),[loading,setLoading]=useState(true),[creating,setCreating]=useState(false),[showNewChat,setShowNewChat]=useState(false),[contactSearch,setContactSearch]=useState(''),[error,setError]=useState('');
 const lock=useRef(false),mounted=useRef(true),inflight=useRef<Promise<void>|null>(null);
 const load=useCallback(()=>{
  if(inflight.current)return inflight.current;
  const task=(async()=>{try{const response=await authFetch('/api/v1/chat/conversations?tenantId='+encodeURIComponent(tenantId));const result=await response.json();if(!response.ok||!Array.isArray(result.conversations))throw Error('Não foi possível atualizar suas conversas.');if(mounted.current){setConversations(result.conversations);setError('');}}catch(reason){if(mounted.current)setError(reason instanceof Error?reason.message:'Não foi possível atualizar suas conversas.');}finally{if(mounted.current)setLoading(false);inflight.current=null;}})();inflight.current=task;return task;
 },[tenantId]);
 useEffect(()=>{
  mounted.current=true;const controller=new AbortController();
  void authFetch(`/api/v1/chat/contacts?tenantId=${encodeURIComponent(tenantId)}&userRole=filho`,{signal:controller.signal}).then(async response=>{const data=await response.json();if(response.ok&&Array.isArray(data.contacts)&&mounted.current)setContacts(data.contacts);}).catch(()=>{});
  const loop=createRefreshLoop({available:()=>document.visibilityState!=='hidden'&&navigator.onLine!==false,refresh:load});const resume=()=>loop.resume();loop.resume();
  const channel=supabase.channel('member-chat-inbox:'+tenantId).on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages',filter:'tenant_id=eq.'+tenantId},resume).on('postgres_changes',{event:'UPDATE',schema:'public',table:'chat_conversations',filter:'tenant_id=eq.'+tenantId},resume).subscribe();
  window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
  return()=>{mounted.current=false;controller.abort();loop.stop();void supabase.removeChannel(channel);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};
 },[load,tenantId]);
 const open=async(withZelador:boolean,targetFilhoId?:string)=>{
  if(lock.current)return;
  const existing=conversations.find(row=>row.type==='direct'&&(withZelador?row.participants.some(person=>person.participantType==='admin'&&person.userId!==userId):row.participants.some(person=>person.filhoId===targetFilhoId)));
  if(existing){setSelectedId(existing.id);setShowNewChat(false);return;}
  lock.current=true;setCreating(true);setError('');
  try{const response=await authFetch('/api/v1/chat/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId,withZelador,targetFilhoId})});const data=await response.json();if(!response.ok||!data.conversationId)throw Error(data.error||'Não foi possível abrir a conversa.');await load();if(mounted.current){setSelectedId(data.conversationId);setShowNewChat(false);setContactSearch('');}}
  catch(reason){if(mounted.current)setError(reason instanceof Error?reason.message:'Não foi possível abrir a conversa.');}
  finally{lock.current=false;if(mounted.current)setCreating(false);}
 };
 return <Chat tenantId={tenantId} userId={userId} conversations={conversations} contacts={contacts.filter(row=>row.nome.toLocaleLowerCase('pt-BR').includes(contactSearch.toLocaleLowerCase('pt-BR')))} selected={conversations.find(row=>row.id===selectedId)||null} selectedId={selectedId} loading={loading} creating={creating} showNewChat={showNewChat} contactSearch={contactSearch} totalUnread={conversations.reduce((total,row)=>total+row.unreadCount,0)} onSelect={setSelectedId} onToggleNewChat={()=>setShowNewChat(value=>!value)} onContactSearch={setContactSearch} onTalkToLeader={()=>void open(true)} onTalkToContact={id=>void open(false,id)} onMessageSent={()=>void load()} onRead={id=>{setConversations(rows=>rows.map(row=>row.id===id?{...row,unreadCount:0}:row));void load();}} error={error} onRetry={()=>void load()}/>;
}
