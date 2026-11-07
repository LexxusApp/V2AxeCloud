import type {ChatMessage} from '../../src/lib/chatTypes';
export function mergeChatMessages(current:ChatMessage[],incoming:ChatMessage[]):ChatMessage[]{
 const confirmed=new Map(current.filter(row=>!row.pending).map(row=>[row.id,row]));
 incoming.filter(row=>!row.pending).forEach(row=>confirmed.set(row.id,row));
 return [...[...confirmed.values()].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(-200),...current.filter(row=>row.pending&&!confirmed.has(row.id))];
}
export function confirmChatMessage(rows:ChatMessage[],clientId:string,serverId:string,createdAt:string):ChatMessage[]{
 if(rows.some(row=>row.id===serverId))return rows.filter(row=>row.id!==clientId);
 return rows.map(row=>row.id===clientId?{...row,id:serverId,createdAt,pending:false}:row);
}
