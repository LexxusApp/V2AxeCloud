import {supabase} from '../../../src/lib/supabase';
import {checked} from './helpers';
import { currentOperation, operations, type Operation } from '../operations';
import { previewSession, request } from './session';
import { ensureResource, readValue, loadResource } from './runtime';
import type { MonthlyCharge } from '../billing';

const sending=new Set<string>();
async function send(memberId:string,kind:string,variables:Record<string,string>,operation:Operation){
  operation.resource(`whatsapp:${memberId}`);operation.sending();operation.phase('Solicitando o envio ao WhatsApp…');
  const key=`${kind}:${memberId}`;
  if(sending.has(key))throw new Error('Este aviso já está sendo enviado. Aguarde.');
  sending.add(key);
  try{
    const member=(readValue<any[]>('members')||[]).find(row=>row.id===memberId);
    const profile=previewSession().profile;
    if(!member||(!member.phone&&!(profile.is_co_admin===true&&!profile.permissoes?.members)))throw new Error('Cadastre o WhatsApp deste membro antes de enviar o aviso.');
    const result=await request('/api/whatsapp/send','POST',{tipo:kind,filhoId:memberId,tenant_id:previewSession().tenantId,variables:{...variables,nome_filho:member.name,nome_terreiro:readValue('account')?.profile.house||previewSession().profile.nome||'Terreiro'}});
    if(result.success!==true)throw new Error('O serviço não confirmou o envio. Confira o histórico antes de repetir.');
    operation.sent(String(result.externalId||`request:${operation.id}`),result.externalId?'sent':'unknown');
    // Refreshing can never repeat a send. Delivery is confirmed only by the server log.
    void loadResource('dispatches',true);return result;
  }finally{sending.delete(key);}
}
async function tracked(label:string,run:(operation:Operation)=>Promise<void>){const parent=currentOperation(),operation=parent||operations.begin(label);try{await run(operation);if(!parent)operation.complete();}catch(error){if(!parent)operation.fail(error);throw error;}}
export function sendMonthlyReminder(id:string){return tracked('Enviando cobrança de mensalidade',async operation=>{
  await Promise.all(['finance','members','account'].map(ensureResource));
  const charge=(readValue<MonthlyCharge[]>('charges')||[]).find(row=>row.id===id);
  if(!charge||charge.status!=='pending')throw new Error('Esta contribuição não está mais pendente. Atualize a lista.');
  const [year,month]=charge.reference.split('-');
  await send(charge.memberId,'cobranca_mensalidade',{mes_ano:`${month}/${year}`,valor:(charge.totalCents/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})},operation);
});}
export function sendCantinaReminder(memberId:string){return tracked('Enviando cobrança da cantina',async operation=>{
  await Promise.all(['cantina','members','account'].map(ensureResource));
  const total=(readValue<any[]>('cantinaFinanceRows')||[]).filter(row=>row.categoria==='Cantina'&&row.status==='pendente'&&row.filho_id===memberId).reduce((sum,row)=>sum+Math.round(Number(row.valor)*100),0);
  if(!Number.isSafeInteger(total)||total<=0)throw new Error('Não há consumo em aberto para enviar a este membro.');
  await send(memberId,'cobranca_cantina',{valor:(total/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}),chave_pix:readValue('pixSettings')?.key||'Consulte a zeladoria'},operation);
});}
export function sendMemberAccess(memberId:string){return tracked('Enviando dados de acesso',async operation=>{
  await Promise.all(['members','account'].map(ensureResource));
  const member=(readValue<any[]>('members')||[]).find(row=>row.id===memberId);
  if(!member||String(member.cpf||'').replace(/\D/g,'').length!==11)throw new Error('Cadastre um CPF válido para enviar as instruções de acesso deste membro.');
  await send(memberId,'dados_acesso',{
    email_filho: member.email || '',
    codigo_cpf: String(member.cpf || '').replace(/\D/g, ''),
    filho_login_id: member.registration || member.matricula || '',
  },operation);
});}

// One automatic notice per confirmed consumption. A lost acknowledgement is
// retained as uncertain instead of automatically sending the same message twice.
export async function sendAutomaticCantinaNotice(financeId:string){
 const scope=previewSession(),requestId=crypto.randomUUID();let claimed=false,operation:Operation|undefined,external='';
 try{
  const claim:any=await checked(supabase.rpc('piloto_iniciar_aviso_cantina',{p_tenant:scope.tenantId,p_financeiro:financeId,p_request:requestId}));
  if(claim.send!==true)return;claimed=true;
  operation=operations.begin('Enviando aviso da nova comanda');
  await Promise.all(['cantina','account','members'].map(ensureResource));
  const total=(readValue<any[]>('cantinaFinanceRows')||[]).filter(row=>row.categoria==='Cantina'&&row.status==='pendente'&&row.filho_id===claim.member_id).reduce((sum,row)=>sum+Math.round(Number(row.valor)*100),0);
  if(!Number.isSafeInteger(total)||total<=0)throw Error('A comanda já foi acertada. Nenhum aviso de cobrança foi enviado.');
  if(previewSession().tenantId!==scope.tenantId||previewSession().userId!==scope.userId)throw Error('A conta mudou antes do envio.');
  const result=await send(claim.member_id,'cobranca_cantina',{valor:(total/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}),chave_pix:readValue('pixSettings')?.key||'Consulte a zeladoria'},operation);
  external=typeof result.externalId==='string'?result.externalId:'';
  await checked(supabase.rpc('piloto_finalizar_aviso_cantina',{p_tenant:scope.tenantId,p_financeiro:financeId,p_request:requestId,p_external:external||null,p_error:external?null:'Solicitação confirmada sem identificador. Confira o histórico antes de repetir.'}));
  operation.complete('Comanda registrada e aviso solicitado. A entrega será atualizada pelo WhatsApp.');
 }catch(reason){
  const message=reason instanceof Error?reason.message:'Não foi possível confirmar o aviso.';
  if(claimed){await checked(supabase.rpc('piloto_finalizar_aviso_cantina',{p_tenant:scope.tenantId,p_financeiro:financeId,p_request:requestId,p_external:external||null,p_error:message.slice(0,1000)})).catch(()=>{});
   if(!operation)operation=operations.begin('Aviso da cantina');
   if(external)operation.complete('Aviso solicitado. A atualização do registro falhou; confira o histórico antes de repetir.');
   else operation.fail(Error('A comanda foi salva. O aviso não foi confirmado: '+message+' Confira o histórico antes de reenviar.'));
  }else{const failed=operations.begin('Aviso da cantina');failed.fail(Error('A comanda foi salva, mas não foi possível conferir a preferência do aviso. '+message));}
 }
}
