import { Users, ReceiptText } from 'lucide-react';
import { previewSession, request, scoped } from './session';
import { registerLoader, registerWriter, publishValue, readValue, refreshResource, ensureResource } from './runtime';
import type { LiveDashboard } from '../DashboardPage';
import { giraTimestamp } from '../giras';

registerLoader('dashboardRadar',async()=>{publishValue('radarSummary',await request(scoped('/api/v1/settings/directory-profile')));});
registerLoader('dashboardWhatsApp',async()=>{const history=await request('/api/whatsapp/logs?limit=50');if(!Array.isArray(history.logs))throw new Error('Histórico do WhatsApp indisponível.');publishValue('whatsappLogs',history.logs);});
export function dashboardLive():LiveDashboard{
  const result=readValue<any>('radarSummary')||{},logs=readValue<any[]>('whatsappLogs')||[],metrics=result.metrics||{},members=readValue<any[]>('members')||[],giras=readValue<any[]>('giras')||[],account=readValue('account'),pix=readValue('pixSettings');
  const published=result.profile?.publicacaoStatus==='publicado';
  const setup=[...(account?.profile.house?['house']:[]),...(readValue('accountRow')?.foto_url?['photo']:[]),...(members.length?['members']:[]),...(pix?.key?['pix']:[]),...(giras.length?['gira']:[]),...(published?['radar']:[])];
  const cutoff=Date.now()-7*86400000;
  return {views7:Number(metrics.views7||0),whatsappClicks30:Number(metrics.whatsappClicks30||0),directoryClicks30:Number(metrics.directoryClicks30||0),googleViews30:Number(metrics.googleViews30||0),sent7:logs.filter((row:any)=>Date.parse(row.created_at)>=cutoff&&/sent|delivered|read|enviado|entregue|lido/i.test(row.status)).length,failed:logs.filter((row:any)=>/failed|error|falh/i.test(row.status)).length,setup,movements:[
    ...(readValue<any[]>('memberRows')||[]).filter(row=>Number.isFinite(Date.parse(row.created_at))).map(row=>({id:`member-${row.id}`,date:row.created_at,title:'Membro cadastrado',text:row.nome,tab:'children',icon:Users})),
    ...(readValue<any[]>('financeRows')||[]).filter(row=>row.created_at&&!['excluido','cancelado'].includes(row.status)).map(row=>({id:`transaction-${row.id}`,date:row.created_at,title:row.categoria||'Movimento financeiro',text:row.descricao||'',tab:'financial',icon:ReceiptText})),
  ]};
}
registerLoader('home',async()=>{
  await Promise.all(['finance','giras','account','pix','dashboardRadar','dashboardWhatsApp'].map(ensureResource));
  publishValue('home',dashboardLive());
});
registerLoader('preceito',async()=>{
  const {data}=await request(scoped('/api/v1/preceitos'));
  if(!Array.isArray(data))throw new Error('Resposta de preceitos inválida.');
  publishValue('preceitoCycles',data);
  publishValue('preceitoId',data.find((row:any)=>row.status==='ativo'&&row.publico_alvo==='corrente')?.id||null);
});
registerWriter('preceitoId',async(next,before)=>{
  if(next!==null){
    if(before)throw new Error('Encerre o ciclo ativo antes de iniciar outro.');
    const gira=(readValue<any[]>('giras')||[]).find(row=>row.id===next);
    if(!gira||Date.parse(giraTimestamp(gira))<=Date.now())throw new Error('Selecione uma gira futura para iniciar o ciclo.');
    if(String(gira.instructions||'').trim().length<3)throw new Error('Preencha as orientações da gira na agenda antes de ativar o preceito. Nenhuma orientação é gerada automaticamente.');
    await request('/api/v1/preceitos','POST',{tenantId:previewSession().tenantId,titulo:`Preceito · ${gira.title}`,motivo:`Preparação para ${gira.title}`,orientacoes:gira.instructions,publico_alvo:'corrente',tipo:'coletivo',status:'ativo',inicio_em:new Date().toISOString(),fim_em:new Date(giraTimestamp(gira)).toISOString()});
  }else{
    if(!before)throw new Error('Não há ciclo ativo para encerrar.');
    await request(`/api/v1/preceitos/${encodeURIComponent(before)}/status`,'PATCH',{tenantId:previewSession().tenantId,status:'encerrado'});
  }
  await refreshResource('preceito');
});
const notificationTabs=new Set(['dashboard','calendar','financial','financial-mensalidades','obligations','library','mural','chat']);
function notificationTab(row:any){
  const direct=String(row.link||'').trim().replace(/^.*#/,'').replace(/^\//,'');
  if(notificationTabs.has(direct))return direct;
  const kind=String(row.tipo||'');
  return /bibliotec/i.test(kind)?'library':/gira/i.test(kind)?'calendar':/financeir|mensal/i.test(kind)?'financial-mensalidades':/obrig|preceito/i.test(kind)?'obligations':'dashboard';
}
function notificationTitle(row:any){
  if(String(row.titulo||'').trim())return String(row.titulo).trim();
  const kind=String(row.tipo||'');
  return /bibliotec/i.test(kind)?'Nova atividade na Biblioteca':/preceito|orienta/i.test(kind)?'Pedido de orientação':/gira/i.test(kind)?'Atualização de gira':/financeir|mensal/i.test(kind)?'Atualização financeira':'Novo aviso da casa';
}
registerLoader('notifications',async()=>{
  const {data}=await request(scoped('/api/notifications?limit=100'));
  if(!Array.isArray(data))throw new Error('Não foi possível consultar as notificações.');
  publishValue('notifications',data.map((row:any)=>({id:row.id,title:notificationTitle(row),description:row.mensagem||row.descricao||'',time:row.created_at?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(row.created_at)):'Data não informada',tab:notificationTab(row),read:row.lida===true})));
});
registerWriter('notifications',async(next:any[],before:any[])=>{
  const previous=new Map(before.map(row=>[row.id,row]));
  const read=next.filter(row=>row.read&&previous.has(row.id)&&!previous.get(row.id).read);
  if(!read.length)return;
  let failure:unknown;
  // Only the chosen IDs may be marked read. A new unseen notice arriving while
  // the request is running must not be included by a server-wide read-all.
  for(let offset=0;offset<read.length;offset+=4){const results=await Promise.allSettled(read.slice(offset,offset+4).map(async row=>{const result=await request(`/api/notifications/${encodeURIComponent(row.id)}/read`,'PATCH',{tenantId:previewSession().tenantId});if(result.success!==true)throw Error('Não foi possível confirmar a leitura deste aviso. Tente novamente.');}));const failed=results.find(result=>result.status==='rejected');if(failed?.status==='rejected'){failure=failed.reason;break;}}
  try{await refreshResource('notifications');}catch(reason){if(!failure)failure=reason;}
  if(failure)throw failure;
});
