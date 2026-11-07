import type { DispatchKind, DispatchStatus, WhatsAppDispatch } from './whatsappDispatches';
const statuses: Record<string,DispatchStatus> = { queued:'queued',pending:'queued',na_fila:'queued',sending:'sending',enviando:'sending',accepted:'accepted',sent:'sent',enviado:'sent',delivered:'delivered',entregue:'delivered',read:'read',lido:'read',failed:'failed',error:'failed',falhou:'failed' };
export const serverDispatchStatus = (value: unknown): DispatchStatus => statuses[String(value||'').trim().toLowerCase()] || 'unknown';
export function dispatchesFromServer(rows: Record<string,any>[], tenantId: string, members: {id?:string;name?:string}[] = []): WhatsAppDispatch[] {
  if(rows.some(row=>row.tenant_id!==tenantId))throw new Error('O histórico retornou um registro sem vínculo com esta casa.');
  return rows.map(row=>{
    const status=serverDispatchStatus(row.status),kind:DispatchKind=/mensal|financeir/i.test(row.tipo)?'monthly':/cantina/i.test(row.tipo)?'cantina':/obrig/i.test(row.tipo)?'obligation':/gira/i.test(row.tipo)?'gira':'notice';
    const at=String(row.created_at||''),rawMessage=String(row.mensagem||'');
    // Failure reasons are appended by the verified Meta webhook, not by the UI.
    const markers=[...rawMessage.matchAll(/\[meta:falha ([^\]]+)\]/g)];
    const reason=markers.at(-1)?.[1]?.trim();
    return {id:String(row.id),externalId:row.external_id||undefined,memberId:row.filho_id||undefined,currentStatus:status,recipient:members.find(member=>member.id===row.filho_id)?.name||'Destinatário',maskedPhone:`•••• ${String(row.telefone||'').slice(-4)}`,kind,title:String(row.tipo||'Aviso da casa'),template:'Não informado pelo serviço',message:rawMessage.replace(/\s*\[meta:falha [^\]]+\]/g,'').trim(),createdAt:at,events:Number.isFinite(Date.parse(at))?[{status,at}]:[],statusTimestampUnknown:true,...(status==='failed'?{failure:{reason:reason||'O serviço registrou falha neste disparo, sem disponibilizar o motivo detalhado nesta consulta.',guidance:'Confira a mensagem, o destinatário e o histórico antes de decidir por um novo envio.'}}:{})};
  });
}
