import {readChatPage,preserveLoadedHistory} from './chatHistory';
import './notices';
import { uploadFile } from './uploads';
import { supabase } from '../../../src/lib/supabase';
import { request,scoped,previewSession } from './session';
import { registerLoader,registerWriter,publishValue,readValue,ensureResource,refreshResource } from './runtime';
import { equal,singleChange,checked,tableRows } from './helpers';
import type { LocalInbox,LocalMessage } from '../messages';
import type { LocalSupport } from '../completion';
registerLoader('inbox',async()=>{
  const {conversations}=await request(scoped('/api/v1/chat/conversations'));if(!Array.isArray(conversations))throw new Error('Resposta das conversas inválida.');
  const previous=readValue<LocalInbox>('inbox');
  const preferences=await tableRows('piloto_chat_preferencias','*','conversa_id');
  const rows:any[]=new Array(conversations.length);let cursor=0;
  await Promise.all(Array.from({length:Math.min(4,conversations.length)},async()=>{while(cursor<conversations.length){const index=cursor++,row=conversations[index],page=await readChatPage(row.id),history=preserveLoadedHistory(previous?.conversations.find(thread=>thread.id===row.id),page),preference=preferences.find(item=>item.conversa_id===row.id);rows[index]={id:row.id,kind:row.type==='group'?'group':'direct',title:row.title||'',memberIds:(row.participants||[]).map((item:any)=>item.filhoId).filter(Boolean),unread:!!preference?.nao_lida||Number(row.unreadCount)>0,archived:!!preference?.arquivada,...history,created:row.lastMessageAt||page.messages[0]?.date||row.createdAt||previous?.conversations.find(thread=>thread.id===row.id)?.created||new Date().toISOString()};}}));
  publishValue('inbox',{conversations:rows,drafts:previous?.drafts||{}});
});
registerWriter('inbox',async(next:LocalInbox,before:LocalInbox,operation)=>{
  if(equal(next.conversations,before.conversations)){publishValue('inbox',next);return;}
  const {row,old,removed}=singleChange(next.conversations,before.conversations),tenantId=previewSession().tenantId;
  if(removed)throw Error('Arquive a conversa para preservar o histórico.');
  if(old&&row.archived!==old.archived){const result:any=await checked(supabase.rpc('piloto_arquivar_conversa',{p_tenant:tenantId,p_conversa:row.id,p_arquivada:row.archived}));if(result.id!==row.id||result.archived!==row.archived)throw Error('O servidor não confirmou o arquivo da conversa.');}
  else
  if(!old){
    const created=row.kind==='group'?await checked(supabase.rpc('piloto_criar_grupo',{p_tenant:tenantId,p_id:row.id,p_titulo:row.title,p_filhos:row.memberIds})):await request('/api/v1/chat/conversations','POST',{tenantId,type:'direct',targetFilhoId:row.memberIds[0]});
    if(!(created as any).conversationId)throw new Error('O servidor não confirmou a conversa.');
    row.id=String((created as any).conversationId);
  }else if(!equal(row.messages,old.messages)){
    const messages=row.messages.filter(message=>!old.messages.some(item=>item.id===message.id));if(messages.length!==1)throw new Error('Envie uma mensagem por vez.');const message=messages[0];let media:any={};
    if(message.attachment){const file=message.attachment;operation?.files([{id:message.id,name:file.name,bytes:file.size}]);operation?.file(message.id,{phase:'preparing'});const upload=await request('/api/v1/chat/upload-url','POST',{tenantId,conversationId:row.id,fileName:file.name,contentType:file.type,sizeBytes:file.size});await uploadFile(upload.uploadUrl,file,operation,message.id);media={messageType:upload.messageType,mediaUrl:upload.publicUrl,mediaPath:upload.storageKey,mediaMime:upload.contentType};}
    const sent=await request(`/api/v1/chat/conversations/${encodeURIComponent(row.id)}/messages`,'POST',{body:message.body,...media});if(!sent.message?.id)throw new Error('O servidor não confirmou a mensagem.');if(message.attachment)operation?.file(message.id,{phase:'done',progress:1});
  }else if(old.unread!==row.unread){if(!row.unread)await request(`/api/v1/chat/conversations/${encodeURIComponent(row.id)}/read`,'POST',{});const result:any=await checked(supabase.rpc('piloto_marcar_conversa',{p_tenant:tenantId,p_conversa:row.id,p_nao_lida:row.unread}));if(result.id!==row.id||result.unread!==row.unread)throw Error('A leitura não foi confirmada.');}
  else throw new Error('A API não confirmou uma alteração compatível nessa conversa.');
  publishValue('inbox',{...before,drafts:next.drafts});await refreshResource('inbox');
});
registerLoader('support',async()=>{await ensureResource('account');const result=await request(scoped('/api/pilot/support'));if(!Array.isArray(result.tickets))throw Error('Histórico do suporte inválido.');publishValue('support',{draft:readValue<LocalSupport>('support')?.draft||{category:'Uso do sistema',subject:'',text:''},tickets:result.tickets});});
registerWriter('support',async(next:LocalSupport,before:LocalSupport)=>{
  if(equal(next.tickets,before.tickets)){publishValue('support',next);return;}
  const {row,old,removed}=singleChange(next.tickets,before.tickets);if(removed)throw Error('Encerre o acompanhamento para preservar o histórico do pedido.');
  let result:any;
  if(old&&row.status!==old.status){
    if(!equal({...row,status:old.status},old))throw Error('Altere a situação separadamente do conteúdo.');
    result=await request(scoped('/api/pilot/support'),'PATCH',{id:row.id,status:row.status,before:old.status});if(result.id!==row.id||result.status!==row.status)throw Error('O acompanhamento não foi confirmado.');
  }else{
    let messageId:string|undefined,data:any=row,retry=false;
    if(old){
      const added=row.messages.filter(message=>!old.messages.some(item=>item.id===message.id));
      if(added.length===1&&equal({...row,messages:old.messages},old)){messageId=added[0].id;data={text:added[0].text};}
      else if(row.retry&&old.delivery==='failed'&&equal({...row,retry:old.retry},old)){retry=true;}
      else {const changed=row.messages.filter(message=>message.retry&&old.messages.some(item=>item.id===message.id&&item.delivery==='failed'&&equal({...message,retry:item.retry},item)));if(changed.length!==1||!equal({...row,messages:old.messages},old)||!equal(row.messages.map(message=>message.id===changed[0].id?old.messages.find(item=>item.id===message.id):message),old.messages))throw Error('Envie um complemento por vez e preserve o conteúdo do pedido.');messageId=changed[0].id;data={text:changed[0].text};retry=true;}
    }
    result=await request(scoped('/api/pilot/support'),'POST',{id:row.id,messageId,data,retry});
    if(result.id!==row.id||(result.messageId||undefined)!==messageId||!['sending','confirmed','uncertain','failed'].includes(result.delivery))throw Error('O serviço não confirmou o registro do envio. Consulte o histórico antes de repetir.');
  }
  publishValue('support',{...before,draft:next.draft});await refreshResource('support');
});
registerWriter('subscription',async()=>{throw new Error('O pagamento da assinatura exige o checkout seguro e identificação do pagador. Esta interface não pode simular quitação nem alterar o prazo de acesso.');});
