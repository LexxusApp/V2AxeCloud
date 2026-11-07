import { uploadSignedFile } from './uploads';
import { supabase } from '../../../src/lib/supabase';
import { previewSession,request,scoped } from './session';
import { registerLoader,registerWriter,ensureResource,refreshResource,readValue,publishValue } from './runtime';
import { giraFromServer } from './readModels';
import { singleChange,equal,tableRows,checked } from './helpers';
import type { DemoGira } from '../giras';
import type { HouseObligation,HouseAttendance } from '../house';
registerLoader('giras',async()=>{
  const {data}=await request(scoped('/api/events'));if(!Array.isArray(data))throw new Error('Resposta de agenda inválida.');
  const [participants,tickets,preparations]=await Promise.all([tableRows('evento_participantes'),tableRows('evento_senhas'),tableRows('piloto_gira_preparacao','*','event_id')]);
  publishValue('eventRows',data);publishValue('participants',participants);publishValue('ticketRows',tickets);
  publishValue('giras',data.filter(row=>row.tipo!=='Obrigação'&&row.status_confirmacao!=='Cancelado').map(row=>{
    const gira=giraFromServer(row),preparation=preparations.find(item=>item.event_id===row.id);if(preparation)Object.assign(gira,{highlight:preparation.destaque,tasks:preparation.tarefas,noticeDraft:preparation.aviso_rascunho,noticeSaved:preparation.aviso_salvo});const location=String(row.descricao||'').match(/^Local: ([^\n]+)\n?/);if(location){gira.place=location[1];gira.instructions=String(row.descricao).slice(location[0].length);}
    gira.status=preparation?.encerrada?'done':'scheduled';
    gira.responses=Object.fromEntries(participants.filter(item=>item.event_id===row.id&&['confirmado','presente','recusado'].includes(item.status)).map(item=>[item.filho_id,item.status==='recusado'?'absent':'confirmed']));
    gira.queue=tickets.filter(item=>item.event_id===row.id&&!['cancelada','cancelado'].includes(item.status)).map(item=>({id:item.id,name:item.nome,phone:item.telefone||'',number:Number(item.numero),state:/atendido|concluid/.test(item.status)?'done' as const:/chamad|atendimento/.test(item.status)?'called' as const:'waiting' as const}));
    return gira;
  }));
});
registerWriter('giras',async(next:DemoGira[],before:DemoGira[])=>{
  const {row,old,removed}=singleChange(next,before),tenantId=previewSession().tenantId;
  if(removed)await request(scoped(`/api/events/${encodeURIComponent(row.id)}`),'DELETE');
  else if(old&&!equal(row.responses,old.responses)){
    const changes=[...new Set([...Object.keys(old.responses),...Object.keys(row.responses)])].filter(id=>old.responses[id]!==row.responses[id]);if(changes.length!==1)throw new Error('Atualize uma resposta por vez.');const filhoId=changes[0];
    if(!row.responses[filhoId]){await checked(supabase.from('evento_participantes').update({status:'pendente',responded_at:null}).eq('tenant_id',tenantId).eq('event_id',row.id).eq('filho_id',filhoId).select('id').single());}
    else await request(`/api/v1/events/${encodeURIComponent(row.id)}/participantes/respond`,'POST',{tenantId,filhoId,action:row.responses[filhoId]==='confirmed'?'confirmar':'declinar'});
  }else if(old&&!equal(row.queue,old.queue)){
    const changed=row.queue.filter(item=>!equal(item,old.queue.find(prev=>prev.number===item.number)));
    if(changed.length!==1)throw new Error('Atualize uma senha por vez.');const ticket=changed[0],server=(readValue<any[]>('ticketRows')||[]).find(item=>item.event_id===row.id&&Number(item.numero)===ticket.number);
    if(!server){const issued:any=await checked(supabase.rpc('piloto_emitir_senha',{p_tenant:tenantId,p_event:row.id,p_id:ticket.id,p_nome:ticket.name||'',p_telefone:ticket.phone||''}));if(issued.id!==ticket.id||!issued.numero)throw Error('O servidor não confirmou a senha.');}
    else {const status=ticket.state==='called'?'chamado':ticket.state==='done'?'atendido':'aguardando',result:any=await checked(supabase.rpc('piloto_atualizar_senha',{p_tenant:tenantId,p_event:row.id,p_senha:server.id,p_status:status,p_antes:server.status}));if(result.id!==server.id||result.status!==status)throw Error('O servidor não confirmou o estado do atendimento.');}
  }else{
    const preparation=(g:DemoGira|undefined)=>({highlight:!!g?.highlight,tasks:g?.tasks||[],noticeDraft:g?.noticeDraft||'',noticeSaved:!!g?.noticeSaved});
    const details=(g:DemoGira)=>[g.title,g.date,g.time,g.type,g.place,g.instructions,g.status,g.capacity||0,!!g.reminder];
    if(!old||!equal(details(row),details(old))){
    const raw=(readValue<any[]>('eventRows')||[]).find(item=>item.id===row.id)||{};
    const result=await request(`/api/events${old?`/${encodeURIComponent(row.id)}`:''}`,old?'PATCH':'POST',{...raw,titulo:row.title,data:row.date,hora:row.time,tipo:row.type,descricao:`Local: ${row.place}\n${row.instructions}`,status_confirmacao:'Confirmado',vagas_maximas:row.capacity||null,wa_reminder_interval_days:row.reminder?(raw.wa_reminder_interval_days||3):null});
    if(!result.success||!result.data?.id)throw new Error('O servidor não confirmou a gravação da gira.');
    row.id=String(result.data.id);
    if(!old){void request('/api/events/' + encodeURIComponent(row.id) + '/notify-whatsapp','POST').catch(err=>{console.warn('[giras] Envio automático do aviso na criação falhou:',err);});}
    if(!old||!!row.reminder!==!!old.reminder){const schedule:any=await checked(supabase.rpc('piloto_agendar_lembrete_gira',{p_tenant:tenantId,p_event:row.id,p_ativo:!!row.reminder&&row.status!=='done'}));if(schedule.event_id!==row.id)throw Error('O servidor não confirmou o agendamento do lembrete.');}
    }
    if((row.status==='done')!==(old?.status==='done')){const result:any=await checked(supabase.rpc('piloto_situacao_gira',{p_tenant:tenantId,p_event:row.id,p_encerrada:row.status==='done',p_antes:old?.status==='done'}));if(result.event_id!==row.id)throw Error('A situação da gira não foi confirmada.');}
    if(!equal(preparation(row),preparation(old))){const result:any=await checked(supabase.rpc('piloto_preparar_gira',{p_tenant:tenantId,p_event:row.id,p_dados:preparation(row),p_antes:preparation(old)}));if(result.event_id!==row.id)throw Error('A preparação não foi confirmada.');}
  }
  await refreshResource('giras');
});
registerLoader('obligations',async()=>{
  const {data}=await request(scoped('/api/events'));if(!Array.isArray(data))throw new Error('Resposta de compromissos inválida.');publishValue('obligationRows',data.filter(row=>row.tipo==='Obrigação'));
  publishValue('obligations',data.filter(row=>row.tipo==='Obrigação').map(row=>({id:row.id,memberId:String(row.descricao||'').match(/FILHO_ID:([0-9a-f-]+)/i)?.[1]||'',title:row.titulo||'',date:String(row.data).slice(0,10),time:String(row.hora||'').slice(0,5),description:String(row.descricao||'').split('=== METADADOS ===')[0].trim(),done:/conclu|confirmad/i.test(row.status_confirmacao||''),reminder:false,attachment:null,attachmentPath:row.pdf_storage_path||null,created:row.created_at})));
});
registerWriter('obligations',async(next:HouseObligation[],before:HouseObligation[],operation)=>{
  const {row,old,removed}=singleChange(next,before),{tenantId,userId}=previewSession();
  if(removed){await checked(supabase.from('calendario_axe').delete().eq('tenant_id',tenantId).eq('id',row.id).select('id').single());}
  else{
    let path=row.attachmentPath===null?null:row.attachmentPath||(readValue<any[]>('obligationRows')||[]).find(item=>item.id===row.id)?.pdf_storage_path||null;
    if(path&&!path.startsWith(`${tenantId}/obrigacoes/${row.memberId}/`))throw Error('O PDF pertence ao membro anterior. Remova-o ou escolha um novo documento para mudar o responsável.');
    if(row.attachment&&row.attachment!==old?.attachment){const file=row.attachment;operation?.files([{id:row.id,name:file.name,bytes:file.size}]);operation?.file(row.id,{phase:'preparing'});const upload=await request('/api/v1/obrigacao-pdf/upload-url','POST',{tenantId,childId:row.memberId,fileName:file.name,contentType:'application/pdf'});await uploadSignedFile('biblioteca_estudos',upload.path,upload.token,file,operation,row.id);path=upload.path;}
    const payload={titulo:row.title,data:row.date,hora:row.time,tipo:'Obrigação',descricao:`${row.description}\n\n=== METADADOS ===\nFILHO_ID:${row.memberId}`,status_confirmacao:row.done?'Confirmado':'Pendente',pdf_storage_path:path};
    if(old)await checked(supabase.from('calendario_axe').update(payload).eq('tenant_id',tenantId).eq('id',row.id).select('id').single());
    else await checked(supabase.from('calendario_axe').insert({...payload,id:row.id,tenant_id:tenantId,lider_id:userId,...(row.created?{created_at:row.created}:{})}).select('id').single());
    if(row.attachment&&row.attachment!==old?.attachment)operation?.file(row.id,{phase:'done',progress:1});
    if(row.reminder&&(!old||!old.reminder))await request('/api/push-direct','POST',{childId:row.memberId,title:'Novo compromisso da casa',body:`${row.title} · ${row.date}`,url:'/dashboard#obrigacoes'});
  }await refreshResource('obligations');
});
registerLoader('attendance',async()=>{
  await ensureResource('giras');const calls:HouseAttendance={};
  for(const event of readValue<DemoGira[]>('giras')||[])calls[event.id]={marks:{},closed:event.status==='done'};
  for(const row of readValue<any[]>('participants')||[]){if(!['presente','recusado'].includes(row.status))continue;calls[row.event_id]??={marks:{},closed:false};calls[row.event_id].marks[row.filho_id]=row.status==='presente'?'present':row.justificativa==='Ausência justificada pela zeladoria'?'excused':'absent';}
  publishValue('attendance',calls);
});
registerWriter('attendance',async(next:HouseAttendance,before:HouseAttendance)=>{
  const tenantId=previewSession().tenantId,events=Object.keys(next).filter(id=>!equal(next[id],before[id]));if(events.length!==1)throw new Error('Salve uma chamada por vez.');const event=events[0],call=next[event];
  const members=readValue<any[]>('members')||[];if(Object.keys(call.marks).some(id=>!members.some(member=>member.id===id)))throw new Error('Uma pessoa desta chamada não está vinculada à casa.');
  const result:any=await checked(supabase.rpc('piloto_salvar_chamada',{p_tenant:tenantId,p_event:event,p_chamada:call,p_antes:before[event]||{marks:{},closed:false}}));if(result.event_id!==event)throw Error('O servidor não confirmou a chamada.');
  await refreshResource('giras');await refreshResource('attendance');
});
