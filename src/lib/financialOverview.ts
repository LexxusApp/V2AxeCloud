import { countsTowardSaldo, normalizeMovimentoTipo, parseFinanceiroDataRef } from './financeiroSaldo';
type CashRow = { data?: string; data_pagamento?: string; created_at?: string; tipo?: string; status?: string; categoria?: string; descricao?: string; valor?: number | string };
export function brazilFinancialToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year','month','day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
export function brazilFinancialMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(now);
  return `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}`;
}
export function monthlyDueShortcut(offset: number, wantedDay: number, now = new Date()): string {
  const [year, month] = brazilFinancialMonth(now).split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + offset, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(last, Math.max(1, Math.min(31, Math.floor(wantedDay) || 10)));
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function cashOverview<T extends CashRow>(transactions: T[], period: string) {
  const rows = transactions.filter(row => {
    if (!countsTowardSaldo(row)) return false;
    const date = parseFinanceiroDataRef(row);
    return date && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` === period;
  });
  const total = (group: T[], type: 'entrada' | 'saida') => group.filter(row => normalizeMovimentoTipo(row.tipo) === type).reduce((sum, row) => sum + Math.round(Number(row.valor || 0) * 100), 0) / 100;
  return { rows, income: total(rows, 'entrada'), expense: total(rows, 'saida'), weeks: Array.from({ length: 5 }, (_, index) => {
    const group = rows.filter(row => Math.min(4, Math.floor((parseFinanceiroDataRef(row)!.getDate() - 1) / 7)) === index);
    return { income: total(group, 'entrada'), expense: total(group, 'saida') };
  }) };
}
