import { previewSession, request, scoped } from './session';
import { refreshResource, readValue, registerWriter } from './runtime';
import { financialToday,validFinancialDate, type MonthlyCharge } from '../billing';
import { parseFinancialAmount, type CashEntry } from '../finance';
import { supabase } from '../../../src/lib/supabase';
import { buildManualFinanceEntry } from '../../../lib/manualFinance';
import { checked } from './helpers';
const ids=new Map<string,string>();
const requestId=(key:string)=>{if(!ids.has(key))ids.set(key,crypto.randomUUID());return ids.get(key)!;};
const changed=(before:any,next:any)=>JSON.stringify(before)!==JSON.stringify(next);
registerWriter('pixSettings',async next=>{
  if(!next)throw new Error('Confira a configuração do Pix.');
  const {tenantId}=previewSession();
  const result=await request('/api/v1/financial/pix-config','POST',{terreiro_id:tenantId,chave_pix:next.key,tipo_chave:({phone:'telefone',random:'aleatoria'}as any)[next.keyType]||next.keyType,nome_beneficiario:next.beneficiary,valor_mensalidade:(parseFinancialAmount(next.amount)||0)/100,dia_vencimento:Number(next.day),mensalidade_ativa:next.enabled!==false});
  if(result.success!==true)throw Error('O servidor não confirmou a configuração Pix.');
  await refreshResource('pix');
  if((readValue<any>('pixSettings')?.enabled!==false)!==(next.enabled!==false))throw Error('O servidor não confirmou a preferência de cobrança. Atualize a página antes de repetir.');
});
registerWriter('charges',async(next:MonthlyCharge[],before:MonthlyCharge[])=>{
  const {tenantId}=previewSession();
  const edits=next.filter(charge=>changed(before.find(old=>old.id===charge.id),charge));
  if(edits.length!==1)throw new Error('Salve uma mensalidade por vez.');
  const charge=edits[0],old=before.find(row=>row.id===charge.id);
  if(old){
    if(old.status==='pending'&&charge.status==='paid'){
      if(!charge.receivedDate||!validFinancialDate(charge.receivedDate)||charge.receivedDate>financialToday())throw Error('Informe a data efetiva do recebimento, sem data futura.');
      const key=`settle:${old.id}:${charge.receivedDate}`;
      const result:any=await checked(supabase.rpc('piloto_liquidar_mensalidade',{p_tenant:tenantId,p_financeiro:old.id,p_data_pagamento:charge.receivedDate,p_valor:charge.totalCents/100,p_request:requestId(key)}));
      if(result.id!==old.id||result.status!=='pago'||result.data_pagamento!==charge.receivedDate)throw Error('O servidor não confirmou a baixa na data informada. Atualize antes de repetir.');
      ids.delete(key);
    }else if(old.status==='paid'&&charge.status==='pending'){
      if(!old.receivedDate||!validFinancialDate(old.receivedDate))throw Error('Atualize a mensalidade para conferir a data da baixa original.');
      const key=`reopen:${old.id}:${old.receivedDate}`;
      const result:any=await checked(supabase.rpc('piloto_reabrir_mensalidade',{p_tenant:tenantId,p_financeiro:old.id,p_data_pagamento:old.receivedDate,p_valor:old.totalCents/100,p_request:requestId(key)}));
      if(result.id!==old.id||result.status!=='pendente'||result.data_pagamento!==null||result.data_vencimento!==old.dueDate)throw Error('O servidor não confirmou a reabertura. Atualize antes de repetir.');
      ids.delete(key);
    }
    else {
      if(charge.memberId!==old.memberId||charge.reference!==old.reference)throw new Error('Para preservar a competência, esta edição mantém o membro e o mês originais. Nenhuma cobrança foi movida.');
      const raw=(readValue<any[]>('financeRows')||[]).find(row=>row.id===old.id);
      if(!raw||raw.status!=='pendente')throw new Error('A situação da mensalidade mudou. Atualize antes de editar.');
      const payload=buildManualFinanceEntry({tipo:'entrada',categoria:'Mensalidade',descricao:charge.description,valor:charge.baseCents/100,data:charge.dueDate,filho_id:charge.memberId,status:'pendente',jurosTipo:({none:'nenhum',fixed:'valor',percent:'porcentagem'}as const)[charge.interestMode],jurosValor:charge.interestValue.replace(',','.')});
      await checked(supabase.from('financeiro').update({...payload,lancamento_manual:true}).eq('id',old.id).eq('tenant_id',tenantId).eq('status',raw.status).eq('valor',raw.valor).eq('descricao',raw.descricao).select('id').single());
    }
  }else{
    const body={tenantId,requestId:requestId(charge.id),tipo:'entrada',categoria:'Mensalidade',descricao:charge.description,valor:charge.baseCents/100,data:charge.dueDate,filho_id:charge.memberId,status:charge.status==='paid'?'pago':'pendente',jurosTipo:({none:'nenhum',fixed:'valor',percent:'porcentagem'}as const)[charge.interestMode],jurosValor:charge.interestValue.replace(',','.')};
    let result:any;
    if(charge.status==='paid'){
      if(!charge.receivedDate||!validFinancialDate(charge.receivedDate)||charge.receivedDate>financialToday())throw Error('Informe a data efetiva do recebimento, sem data futura.');
      const data:any=await checked(supabase.rpc('piloto_criar_mensalidade_quitada',{p_tenant:tenantId,p_request:body.requestId,p_input:body,p_data_pagamento:charge.receivedDate}));
      if(data.status!=='pago'||data.data_pagamento!==charge.receivedDate)throw Error('O servidor não confirmou o recebimento na data informada.');
      result={data};
    }else result=await request('/api/transactions','POST',body);
    if(!result.data?.id)throw new Error('O servidor não confirmou a cobrança.');
    charge.id=result.data.id;
  }
  await refreshResource('finance');
});
registerWriter('manualCash',async(next:CashEntry[],before:CashEntry[])=>{
  const removed=before.filter(row=>!next.some(item=>item.id===row.id));
  const edits=next.filter(row=>changed(before.find(item=>item.id===row.id),row));
  if(removed.length+edits.length!==1)throw new Error('Salve um lançamento por vez.');
  if(removed.length)await request(scoped(`/api/transactions/${encodeURIComponent(removed[0].id)}`),'DELETE');
  else{
    const entry=edits[0];
    if(before.some(row=>row.id===entry.id)){
      const raw=(readValue<any[]>('financeRows')||[]).find(row=>row.id===entry.id);
      if(!raw||['Mensalidade','Cantina','Loja'].includes(raw.categoria)||['Mensalidade','Cantina','Loja'].includes(entry.category))throw new Error('Este registro deve ser alterado pelo módulo de origem.');
      const payload=buildManualFinanceEntry({tipo:entry.kind==='income'?'entrada':'saida',categoria:entry.category,descricao:entry.description,valor:entry.cents/100,data:entry.date,filho_id:entry.memberId||null,status:'pago'});
      await checked(supabase.from('financeiro').update({...payload,data_pagamento:entry.date}).eq('id',entry.id).eq('tenant_id',previewSession().tenantId).eq('valor',raw.valor).eq('status',raw.status).eq('data',raw.data).eq('descricao',raw.descricao).select('id').single());
    }else{
      const result=await request('/api/transactions','POST',{tenantId:previewSession().tenantId,requestId:requestId(entry.id),tipo:entry.kind==='income'?'entrada':'saida',categoria:entry.category,descricao:entry.description,valor:entry.cents/100,data:entry.date,filho_id:entry.memberId||null,status:'pago'});
      if(!result.data?.id)throw new Error('O servidor não confirmou o lançamento.');entry.id=result.data.id;
    }
  }
  await refreshResource('finance');
});
registerWriter('members',async(next:any[],before:any[])=>{
  const comparable=(row:any)=>{if(!row)return row;const {paid,hasInvoice,...persisted}=row;return persisted;};
  if(next.length<before.length){const removed=before.filter(row=>!next.some(item=>item.id===row.id));if(removed.length!==1||next.some(row=>!before.some(item=>item.id===row.id&&!changed(comparable(item),comparable(row)))))throw new Error('Exclua um membro por vez, sem outras alterações.');const result=await request(scoped(`/api/children/${encodeURIComponent(removed[0].id)}`),'DELETE');if(result.success!==true)throw new Error('O servidor não confirmou a exclusão.');await refreshResource('members');await refreshResource('finance');return;}
  const edits=next.filter(row=>changed(comparable(before.find(old=>old.id===row.id)),comparable(row)));
  if(edits.length!==1)throw new Error('Salve um cadastro por vez.');
  const member=edits[0],old=before.find(row=>row.id===member.id);
  if(old&&(member.hasApp!==old.hasApp))throw new Error('Acesso e anotações usam serviços próprios, que ainda estão sendo conectados. Nenhum cadastro foi alterado.');
  const body={nome:member.name,email:member.email,whatsapp_phone:member.phone,data_nascimento:member.birthday||null,cpf:member.cpf||null,cargo:member.role,status:member.status,orixa_frente:member.orixa,adjunto:member.adjunto,endereco:member.city,data_feitura:member.feitura||null,quizilas:member.restrictions.split(',').map((s:string)=>s.trim()).filter(Boolean),data_entrada:member.joined||null,...(old&&changed(member.notes,old.notes)?{notas_sigilosas:member.notes.map((note:any)=>note.text).join('\n\n')}:{})};
  if(old)await request(scoped(`/api/children/${encodeURIComponent(old.id)}`),'PUT',body);
  else {const result=await request('/api/children','POST',{userId:previewSession().userId,tenantId:previewSession().tenantId,childData:body});if(result.data?.id)member.id=result.data.id;}
  await refreshResource('members');
  await refreshResource('finance');
});
