import test from 'node:test';
import assert from 'node:assert/strict';
import { brazilFinancialToday, brazilFinancialMonth, monthlyDueShortcut, cashOverview } from '../src/lib/financialOverview';
test('visão mensal usa data do recebimento, tipos legados e centavos; pendência nunca vira receita', () => {
  const result = cashOverview([
    { data: '2026-09-10', data_pagamento: '2026-10-31', categoria: 'Mensalidade', status: 'pago', tipo: 'entrada', valor: 102 },
    { data: '2026-10-10', categoria: 'Mensalidade', status: 'pendente', tipo: 'entrada', valor: 999 },
    { data: '02/10/2026', categoria: 'Conta', status: 'pago', tipo: 'despesa', valor: .1 },
    { data: '2026-10-02', categoria: 'Conta', status: 'pago', tipo: 'saida', valor: .2 },
    { data: '2026-11-01', status: 'pago', tipo: 'entrada', valor: 500 },
  ], '2026-10');
  assert.equal(result.income, 102); assert.equal(result.expense, .3); assert.equal(result.rows.length, 3);
  assert.equal(result.weeks[4].income, 102); assert.equal(result.weeks[0].expense, .3);
});
test('mês financeiro segue Brasília mesmo após meia-noite UTC; dias 29–31 são preservados e ajustados nos meses curtos', () => {
  assert.equal(brazilFinancialMonth(new Date('2026-11-01T01:30:00Z')), '2026-10');
  assert.equal(brazilFinancialToday(new Date('2026-11-01T01:30:00Z')), '2026-10-31');
  assert.equal(monthlyDueShortcut(0, 31, new Date('2026-11-01T01:30:00Z')), '2026-10-31');
  assert.equal(monthlyDueShortcut(0, 31, new Date('2026-02-15T12:00:00Z')), '2026-02-28');
  assert.equal(monthlyDueShortcut(-1, 31, new Date('2028-03-15T12:00:00Z')), '2028-02-29');
  assert.equal(monthlyDueShortcut(-1, 30, new Date('2026-01-15T12:00:00Z')), '2025-12-30');
});
