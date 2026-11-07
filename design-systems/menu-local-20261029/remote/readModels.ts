import type { DemoMember } from '../MembersPage';
import type { DemoGira } from '../giras';
import type { MonthlyCharge } from '../billing';
import type { LedgerEntry, CashEntry } from '../finance';
import { countsTowardSaldo, normalizeMovimentoTipo } from '../../../src/lib/financeiroSaldo';
const cents = (value: unknown) => Math.round(Number(value || 0) * 100);
export function cleanManualDescription(value:unknown){return String(value||'').replace(/\s*\(ID:[0-9a-f-]{36}\)\s*$/i,'').replace(/\s*\((?:vencimento|compet[êe]ncia) \d{4}-\d{2}-\d{2}\)\s*$/i,'').replace(/\s*\(\+\s*(?:\d+(?:\.\d+)?%:\s*)?R\$\s*[\d.]+\s+juros\/multa\)\s*$/i,'').trim();}
export function memberFromServer(row: Record<string, any>): DemoMember {
  const name = String(row.nome || '');
  return { id: String(row.id), name, role: row.cargo || 'Filho de Santo', initials: name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase(), color: 'sage', paid: false,
    registration: row.registro || row.matricula || '', joined: String(row.data_entrada || row.created_at || '').slice(0,10), birthday: String(row.data_nascimento || '').slice(0,10), email: row.email || '', phone: row.whatsapp_phone || '', city: row.endereco || '',
    orixa: row.orixa_frente || '', adjunto: row.adjunto || '', feitura: row.data_feitura || '', cpf: row.cpf || '', status: /inativ/i.test(row.status || '') ? 'Inativo' : /pendent/i.test(row.status || '') ? 'Pendente' : 'Ativo', restrictions: Array.isArray(row.quizilas)?row.quizilas.join(', '):row.quizilas||'', hasApp: Boolean(row.user_id), hasInvoice: false, notes: row.notas_sigilosas?[{id:`notes-${row.id}`,text:String(row.notas_sigilosas),date:row.updated_at||row.created_at}]:[],
  };
}
export function giraFromServer(row: Record<string, any>): DemoGira {
  return { id: String(row.id), title: row.titulo || '', date: String(row.data || '').slice(0,10), time: String(row.hora || '').slice(0,5), place: row.local || '', type: /trabalho/i.test(row.tipo || '') ? 'Trabalho' : /encontro/i.test(row.tipo || '') ? 'Encontro' : 'Gira', status: /concluid|finalizad|encerrad/i.test(row.status || '') ? 'done' : 'scheduled', responses: {}, instructions: row.descricao || '', noticeDraft: '', noticeSaved: false, tasks: [], queue: [], highlight: Boolean(row.destaque), reminder: Boolean(row.wa_reminder_enabled || row.wa_reminder_interval_days), capacity: Number(row.vagas_maximas) || undefined };
}
export function financeFromServer(rows: Record<string, any>[], members: DemoMember[]) {
  const names = new Map(members.map(member=>[member.id,member.name]));
  const live = rows.filter(row=>!['excluido','cancelado','rejeitado'].includes(String(row.status || '').trim().toLowerCase()));
  if(live.some(row=>!Number.isFinite(Number(row.valor))||Number(row.valor)<0||!/^\d{4}-\d{2}-\d{2}/.test(String(row.data||''))))throw new Error('Há um lançamento com valor ou data inválida. O saldo não foi calculado com dados incompletos.');
  const charges: MonthlyCharge[] = live.filter(row=>String(row.categoria || '').toLowerCase()==='mensalidade').map(row=>{
    const memberId = row.filho_id || String(row.descricao || '').match(/\(ID:([0-9a-f-]{36})\)/i)?.[1] || '';
    const paid = countsTowardSaldo(row);
    const dueDate = String(row.data_vencimento || row.data || '').slice(0,10);
    const totalCents = cents(row.valor);
    const feeMatch = String(row.descricao || '').match(/\(\+\s*(?:(\d+(?:\.\d+)?)%:\s*)?R\$\s*([\d.]+)\s+juros\/multa\)/i);
    const extraCents = feeMatch ? cents(feeMatch[2]) : 0;
    return { id:String(row.id),memberId,memberName:names.get(memberId)||'',description:cleanManualDescription(row.descricao),reference:dueDate.slice(0,7),dueDate,baseCents:totalCents-extraCents,extraCents,totalCents,interestMode:feeMatch?.[1]?'percent':extraCents?'fixed':'none',interestValue:feeMatch?.[1] || (extraCents ? String(extraCents/100) : ''),status:paid?'paid':'pending',createdAt:Date.parse(row.created_at || row.data) || 0,source:'manual',...(paid ? {receivedDate:String(row.data_pagamento || row.data).slice(0,10),paidAt:Date.parse(row.data_pagamento || row.data)} : {}) };
  });
  const ledger: LedgerEntry[] = live.filter(countsTowardSaldo).map(row=>({id:String(row.id),description:cleanManualDescription(row.descricao),date:String(row.data_pagamento || row.data).slice(0,10),category:row.categoria || '',kind:normalizeMovimentoTipo(row.tipo)==='saida'?'expense':'income',cents:cents(row.valor),memberId:row.filho_id || undefined,memberName:names.get(row.filho_id),createdAt:Date.parse(row.created_at || row.data)||0,source:String(row.categoria || '').toLowerCase()==='mensalidade'?'monthly':String(row.categoria || '').toLowerCase()==='cantina'?'cantina':String(row.categoria || '').toLowerCase()==='loja'?'store':'manual'}));
  return { charges, cashLedger:ledger, manualCash:ledger.filter(row=>row.source==='manual') as CashEntry[] };
}
