import type {HouseNotice} from '../house';
import {request,scoped,previewSession} from './session';
import {registerLoader,registerWriter,publishValue,readValue,refreshResource} from './runtime';
import {equal,singleChange} from './helpers';

const ROOT='/api/pilot/notices';
// Undo holds the server's tombstone revision, never invents a new publication.
const tombstones=new Map<string,{revision:number;notice:HouseNotice}>();
const scope=()=>{const session=previewSession();return `${session.userId}:${session.tenantId}:`;};
const key=(id:string)=>scope()+id;
const content=(row:HouseNotice)=>({id:row.id,title:row.title,body:row.body,audience:row.audience,memberIds:row.memberIds,giraId:row.giraId,status:row.status,category:row.category||'Geral',expires:row.expires||''});
function confirmed(row:HouseNotice,id:string){
 if(row?.id!==id||!Number.isSafeInteger(row.revision)||Number(row.revision)<1||!['draft','published'].includes(row.status))throw Error('O servidor não confirmou o comunicado. Atualize antes de repetir.');
 return {...row,notifyWhatsApp:false,notifyKey:undefined};
}
const sameScope=(context:string)=>{if(scope()!==context)throw Error('A conta mudou durante a operação. Entre novamente para consultar o mural.');};
function put(row:HouseNotice,context:string){
 sameScope(context);
 const current=readValue<HouseNotice[]>('notices')||[];
 publishValue('notices',current.some(item=>item.id===row.id)?current.map(item=>item.id===row.id?row:item):[...current,row]);
}
registerLoader('notices',async()=>{
 const context=scope();
 const {data}=await request(scoped(ROOT));if(!Array.isArray(data))throw Error('Resposta do mural inválida.');
 sameScope(context);
 publishValue('notices',data.map(row=>confirmed(row,row.id)));
});
registerWriter('notices',async(next:HouseNotice[],before:HouseNotice[],operation)=>{
 const {row,old,removed}=singleChange(next,before),context=scope(),stamp=key(row.id);
 if(removed){
  if(!old?.revision)throw Error('Atualize o comunicado antes de remover.');
  operation?.phase('Removendo o comunicado do mural…');
  const result=await request(scoped(`${ROOT}/${encodeURIComponent(row.id)}`),'DELETE',{expected:old.revision});
  if(result.id!==row.id||result.deleted!==true||!Number.isSafeInteger(result.revision))throw Error('A remoção não foi confirmada. Atualize antes de repetir.');
  sameScope(context);tombstones.set(stamp,{revision:result.revision,notice:old});
  publishValue('notices',before.filter(item=>item.id!==row.id));
  return;
 }
 const deleted=tombstones.get(stamp);
 if(!old&&deleted){
  if(!equal(content(row),content(deleted.notice)))throw Error('Restaure o comunicado antes de alterar o conteúdo.');
  operation?.phase('Restaurando o comunicado sem notificações…');
  const result=await request(scoped(`${ROOT}/${encodeURIComponent(row.id)}/restore`),'POST',{expected:deleted.revision});
  put(confirmed(result.notice,row.id),context);tombstones.delete(stamp);return;
 }
 const notify=row.status==='published'&&row.notifyWhatsApp===true&&!!row.notifyKey&&row.notifyKey!==old?.notifyKey;
 let saved=old;
 if(!old||!equal(content(row),content(old))){
  operation?.phase(row.status==='draft'?'Salvando o rascunho privado…':'Salvando a publicação e seu público…');
  const result=await request(scoped(ROOT),'POST',{notice:content(row),expected:old?.revision??null});
  saved=confirmed(result.notice,row.id);put(saved,context);
 }
 if(!saved?.revision)throw Error('Atualize o comunicado antes de continuar.');
 if(notify){
  sameScope(context);operation?.sending();operation?.phase('Registrando e processando o WhatsApp para o público escolhido…');
  try{
   const result=await request(scoped(`${ROOT}/${encodeURIComponent(row.id)}/notify`),'POST',{expected:saved.revision,key:row.notifyKey});
   const notice=confirmed(result.notice,row.id);
   put({...notice,...(result.auditPending?{delivery:'uncertain' as const}:{})},context);
  }catch(error){
   // Saving the notice is independent of delivery. Never create another notice,
   // roll back its publication, or retry a send after losing the response.
   sameScope(context);try{await refreshResource('notices');}catch{}
   throw Object.assign(Error(`Comunicado salvo. O envio pelo WhatsApp não foi confirmado. Atualize o mural antes de repetir. ${error instanceof Error?error.message:''}`),{savedNotice:saved});
  }
 }
});
