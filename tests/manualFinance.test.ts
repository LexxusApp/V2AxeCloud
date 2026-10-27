import test from 'node:test';
import assert from 'node:assert/strict';
import { buildManualFinanceEntry, isPendingMonthlyEntry } from '../lib/manualFinance.ts';
import { countsTowardSaldo } from '../src/lib/financeiroSaldo.ts';
import { isPaidMensalidadeFinanceRow } from '../src/lib/mensalidadeFinanceRow.ts';
const input = { tipo:'entrada',valor:'100',categoria:'Mensalidade',data:'2026-09-10',descricao:'Atraso de setembro',filho_id:'11111111-1111-4111-8111-111111111111',status:'pendente' };
test('mensalidade manual atrasada mantém membro, vencimento e juros sem virar receita recebida',()=>{
 const row=buildManualFinanceEntry({...input,jurosTipo:'porcentagem',jurosValor:'2'});
 assert.equal(row.valor,102);assert.equal(row.data_vencimento,'2026-09-10');assert.equal(row.filho_id,input.filho_id);
 assert.equal(isPendingMonthlyEntry(row),true);assert.equal(countsTowardSaldo(row),false);assert.equal(isPaidMensalidadeFinanceRow(row),false);
 assert.match(row.descricao,/2%/);assert.match(row.descricao,/vencimento 2026-09-10/);
});
test('mensalidade quitada aparece no histórico e compõe caixa, sem voltar como pendência',()=>{
 const row=buildManualFinanceEntry({...input,status:'pago',jurosTipo:'valor',jurosValor:'5.50'});
 assert.equal(row.valor,105.5);assert.equal(isPendingMonthlyEntry(row),false);assert.equal(countsTowardSaldo(row),true);assert.equal(isPaidMensalidadeFinanceRow(row),true);
 assert.match(row.descricao,/competência 2026-09-10/);assert.doesNotMatch(row.descricao,/vencimento/);
});
for(const tipo of ['entrada','saida']) test(`${tipo} comum ignora situação residual e entra no extrato, preservando vínculo opcional`,()=>{
 const row=buildManualFinanceEntry({...input,tipo,categoria:tipo==='entrada'?'Doação':'Contas',jurosTipo:'porcentagem',jurosValor:'2'});
 assert.equal(row.status,'pago');assert.equal(row.valor,100);assert.equal(countsTowardSaldo(row),true);assert.equal(isPendingMonthlyEntry(row),false);
 assert.equal(row.filho_id,input.filho_id);assert.equal(row.data_vencimento,null);
});
test('não permite mensalidade sem membro ou como despesa nem aceita dados monetários/datas inválidos',()=>{
 for(const patch of [{filho_id:''},{filho_id:'errado'},{tipo:'saida'},{valor:0},{valor:-1},{valor:'NaN'},{valor:Infinity},{data:'2026-02-30'},{data:''},{descricao:''},{status:'errado'},{jurosTipo:'valor',jurosValor:-1}]) assert.throws(()=>buildManualFinanceEntry({...input,...patch}));
});
test('status quitado prevalece sobre marcador legado de vencimento',()=>{
 assert.equal(isPendingMonthlyEntry({...input,descricao:'teste (vencimento 2026-09-10)',status:'confirmado'}),false);
 assert.equal(isPendingMonthlyEntry({...input,status:'cancelado'}),false);
});
