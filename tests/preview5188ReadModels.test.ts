import test from 'node:test';
import assert from 'node:assert/strict';
import { memberFromServer,financeFromServer } from '../design-systems/menu-local-20261029/remote/readModels';
import { buildManualFinanceEntry } from '../lib/manualFinance';
import { ledgerTotals, preferredLedgerPeriod } from '../design-systems/menu-local-20261029/finance';
const memberId='f34a6a14-076f-4b09-9cb0-cc703f102100';
const member=memberFromServer({id:memberId,nome:'Membro de teste',whatsapp_phone:'11999999999',adjunto:'Adjunto informado',endereco:'Endereço informado',quizilas:['Restrição informada'],status:'Ativo',user_id:'account'});
const row=(id:string,values:Record<string,unknown>)=>({id,data:'2026-09-10',created_at:'2026-09-01T12:00:00Z',tipo:'entrada',categoria:'Mensalidade',valor:100,filho_id:memberId,status:'pendente',...values});
test('uses persisted member fields rather than unsupported aliases',()=>{assert.equal(member.phone,'11999999999');assert.equal(member.adjunto,'Adjunto informado');assert.equal(member.city,'Endereço informado');assert.equal(member.restrictions,'Restrição informada');assert.equal(member.hasApp,true);});
test('an old contribution with server-calculated interest remains linked and outside cash until paid',()=>{
 const entry=buildManualFinanceEntry({tipo:'entrada',categoria:'Mensalidade',descricao:'Contribuição anterior',valor:100,data:'2026-09-10',filho_id:memberId,status:'pendente',jurosTipo:'porcentagem',jurosValor:2});
 const mapped=financeFromServer([row('monthly',entry)],[member]);
 assert.equal(mapped.charges[0].memberId,memberId);assert.equal(mapped.charges[0].reference,'2026-09');assert.equal(mapped.charges[0].baseCents,10000);assert.equal(mapped.charges[0].extraCents,200);assert.equal(mapped.charges[0].totalCents,10200);assert.equal(mapped.cashLedger.length,0);
});
test('settlement enters cash once on the actual payment date without changing contribution reference',()=>{
 const mapped=financeFromServer([row('monthly',{data:'2026-11-01',data_vencimento:'2026-09-10',data_pagamento:'2026-11-01',status:'pago',valor:102})],[member]);
 assert.equal(mapped.charges[0].reference,'2026-09');assert.equal(mapped.charges[0].receivedDate,'2026-11-01');assert.equal(mapped.cashLedger.length,1);assert.equal(mapped.manualCash.length,0);assert.equal(ledgerTotals(mapped.cashLedger,'2026-11').income,10200);
});
test('cash overview opens the latest populated month when the current month has no movement',()=>{
 const mapped=financeFromServer([row('october',{data:'2026-10-25',data_pagamento:'2026-10-26',categoria:'Cantina',status:'pago',valor:50})],[member]);
 assert.equal(ledgerTotals(mapped.cashLedger,'2026-11').income,0);
 assert.equal(ledgerTotals(mapped.cashLedger,'2026-11').balance,5000);
 assert.equal(preferredLedgerPeriod(mapped.cashLedger,'2026-11'),'2026-10');
});
test('cash overview keeps the current month when it contains a confirmed movement',()=>{
 const mapped=financeFromServer([row('november',{data:'2026-11-05',categoria:'Doação',status:'pago',valor:20})],[member]);
 assert.equal(preferredLedgerPeriod(mapped.cashLedger,'2026-11'),'2026-11');
});
test('cancelled records and unpaid canteen consumption do not inflate the cash balance',()=>{
 const mapped=financeFromServer([row('cancelled',{status:'excluido'}),row('canteen',{categoria:'Cantina',status:'pendente',valor:50}),row('income',{categoria:'Doação',status:'pago',valor:20}),row('expense',{categoria:'Insumos',tipo:'saida',status:'pago',valor:5})],[member]);
 assert.equal(mapped.charges.length,0);assert.equal(mapped.cashLedger.length,2);const totals=ledgerTotals(mapped.cashLedger,'2026-09');assert.equal(totals.income,2000);assert.equal(totals.expense,500);
});
test('does not invent sample expenses or opening balances for an empty house',()=>{assert.deepEqual(financeFromServer([],[]),{charges:[],cashLedger:[],manualCash:[]});});

test('rejected contributions cannot reappear as collectible debt or income',()=>{assert.deepEqual(financeFromServer([row('rejected',{status:' rejeitado '})],[member]),{charges:[],cashLedger:[],manualCash:[]});});
test('rejects invalid amounts rather than showing a false zero balance',()=>{assert.throws(()=>financeFromServer([row('bad',{valor:'indisponível'})],[member]),/inválida/);});
test('legacy member links in descriptions retain the correct member identity',()=>{const result=financeFromServer([row('legacy',{filho_id:null,descricao:`Mensalidade (ID:${memberId})`})],[member]);assert.equal(result.charges[0].memberId,memberId);assert.equal(result.charges[0].memberName,member.name);});
test('store receipts keep their module ownership and cannot appear as editable manual cash',()=>{const result=financeFromServer([row('sale',{categoria:'Loja',status:'pago'})],[member]);assert.equal(result.cashLedger[0].source,'store');assert.equal(result.manualCash.length,0);});
test('editing a displayed contribution does not append interest and technical identifiers twice',()=>{const payload=buildManualFinanceEntry({tipo:'entrada',categoria:'Mensalidade',descricao:'Setembro',valor:100,data:'2026-09-10',filho_id:memberId,status:'pendente',jurosTipo:'porcentagem',jurosValor:2});const result=financeFromServer([row('month',payload)],[member]);assert.equal(result.charges[0].description,'Setembro');});
test('legacy paid monthly entries use the same rule as the current system cash ledger',()=>{const result=financeFromServer([row('legacy-paid',{status:null,descricao:`Mensalidade (competência 2026-09-10) (ID:${memberId})`})],[member]);assert.equal(result.charges[0].status,'paid');assert.equal(result.cashLedger.length,1);});
