import {supabase} from '../../../src/lib/supabase';
import {previewSession} from './session';
import {checked} from './helpers';
import {publishValue,readValue} from './runtime';
import type {LocalConversation,LocalInbox,LocalMessage} from '../messages';

export async function readChatPage(conversationId:string,cursor?:{date:string;id:string}){
 const session=previewSession();
 const result:any=await checked(supabase.rpc('piloto_mensagens',{p_tenant:session.tenantId,p_conversa:conversationId,p_antes_data:cursor?.date||null,p_antes_id:cursor?.id||null}));
 if(!Array.isArray(result.messages))throw Error('Não foi possível consultar o histórico.');
 const page=result.messages.slice(0,100),oldest=page.at(-1);
 const messages:LocalMessage[]=page.reverse().map((row:any)=>({id:row.id,sender:row.sender_user_id===session.userId?'self':row.sender_filho_id||row.sender_user_id,body:row.body||'',date:row.created_at,state:'sent',media:row.media_path||row.media_url?{url:row.media_path?'/api/v1/chat/media?key='+encodeURIComponent(row.media_path):row.media_url,type:row.message_type,mime:row.media_mime}:undefined}));
 return {messages,historyCursor:oldest?{id:oldest.id,date:oldest.created_at}:undefined,hasMore:!!result.hasMore};
}
export function mergeMessages(older:LocalMessage[],newer:LocalMessage[]){
 return [...new Map([...older,...newer].map(row=>[row.id,row])).values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
export async function loadEarlierMessages(conversationId:string){
 const startSession=previewSession(),start=readValue<LocalInbox>('inbox')?.conversations.find(row=>row.id===conversationId);
 if(!start?.hasMore||!start.historyCursor)return;
 const page=await readChatPage(conversationId,start.historyCursor);
 if(previewSession().userId!==startSession.userId||previewSession().tenantId!==startSession.tenantId)return;
 const current=readValue<LocalInbox>('inbox');if(!current)return;
 const thread=current.conversations.find(row=>row.id===conversationId);
 // A refresh may have replaced this window while the older page was in flight.
 if(!thread||JSON.stringify(thread.historyCursor)!==JSON.stringify(start.historyCursor))return;
 publishValue('inbox',{...current,conversations:current.conversations.map(row=>row.id===conversationId?{...row,...page,messages:mergeMessages(page.messages,row.messages)}:row)});
}
export function preserveLoadedHistory(previous:LocalConversation|undefined,page:Awaited<ReturnType<typeof readChatPage>>){
 if(!previous||!page.messages.some(row=>previous.messages.some(old=>old.id===row.id)))return page;
 if(previous.messages.length<=page.messages.length)return page;
 return {...page,messages:mergeMessages(previous.messages,page.messages),historyCursor:previous.historyCursor,hasMore:previous.hasMore};
}
