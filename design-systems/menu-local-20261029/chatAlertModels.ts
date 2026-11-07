import type {ChatConversationSummary} from '../../src/lib/chatTypes';
export function unreadChatAlerts(rows:ChatConversationSummary[]){
 return rows.filter(row=>row.unreadCount>0).sort((a,b)=>Date.parse(b.lastMessageAt||'')-Date.parse(a.lastMessageAt||'')).map(row=>({id:row.id,title:row.type==='group'?row.title||'Corrente':row.peer?.nome||'Nova mensagem',body:row.lastMessagePreview||'Você recebeu uma mensagem.',count:row.unreadCount,date:row.lastMessageAt}));
}
