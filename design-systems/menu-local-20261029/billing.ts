import { parseFinancialAmount } from './finance';
export type InterestMode = 'none' | 'fixed' | 'percent';
export type MonthlyCharge = { id: string; memberId: string; memberName: string; description: string; reference: string; dueDate: string; baseCents: number; interestMode: InterestMode; interestValue: string; extraCents: number; totalCents: number; status: 'pending' | 'paid'; createdAt: number; receivedDate?: string; paidAt?: number; source: 'seed' | 'manual' };
export type ChargeDraft = { id: string; memberId: string; description: string; dueDate: string; amount: string; interestMode: InterestMode; interestValue: string; status: 'pending' | 'paid'; receivedDate: string };
export function validFinancialDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value; }
export const financialToday = () => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date());
export function monthlyAmounts(amount: string, mode: InterestMode, value: string) {
 const base = parseFinancialAmount(amount); if (!base) return null;
 let extra = 0;
 if (mode !== 'none') {
  if (!/^(?:\d+)(?:[,.]\d{1,2})?$/.test(value.trim())) return null;
  const n = Number(value.replace(',', '.')); if (!Number.isFinite(n) || n < 0) return null;
  if (mode === 'percent') { if (n > 1000) return null; const basisPoints = Math.round(n * 100); extra = Math.round(base * basisPoints / 10000); }
  else { extra = Math.round(n * 100); }
 }
 const total = base + extra; return Number.isSafeInteger(total) && total <= 9999999999 ? { baseCents: base, extraCents: extra, totalCents: total } : null;
}
export function createMonthlyCharge(draft: ChargeDraft, members: readonly { id: string; name: string }[], existing: readonly MonthlyCharge[], now = Date.now()): MonthlyCharge {
 const member = members.find(m => m.id === draft.memberId); if (!member) throw new Error('Selecione o filho de santo para vincular a mensalidade.');
 if (!draft.description.trim() || draft.description.trim().length > 1500) throw new Error('Informe a descrição, com até 1.500 caracteres.');
 if (!validFinancialDate(draft.dueDate)) throw new Error('Informe uma data de vencimento válida. Ela define a competência da mensalidade.');
 const reference = draft.dueDate.slice(0, 7), before = existing.find(c => c.id === draft.id);
 if (before?.status === 'paid') throw new Error('Uma mensalidade quitada não pode ser alterada por este formulário.');
 if (existing.some(c => c.id !== draft.id && c.memberId === member.id && c.reference === reference)) throw new Error('Este membro já tem uma mensalidade nessa competência. Abra a cobrança existente para conferir ou editar.');
 const amounts = monthlyAmounts(draft.amount, draft.interestMode, draft.interestValue); if (!amounts) throw new Error('Revise o valor base e os juros. Use até duas casas decimais; percentual entre 0 e 1.000%.');
 if (draft.status === 'paid' && (!validFinancialDate(draft.receivedDate) || draft.receivedDate > financialToday())) throw new Error('Informe a data em que o valor foi recebido, até hoje.');
 return { id: draft.id, memberId: member.id, memberName: member.name, description: draft.description.trim(), reference, dueDate: draft.dueDate, ...amounts, interestMode: draft.interestMode, interestValue: draft.interestMode === 'none' ? '' : draft.interestValue.replace(',', '.'), status: draft.status, createdAt: before?.createdAt ?? now, source: before?.source ?? 'manual', ...(draft.status === 'paid' ? { receivedDate: draft.receivedDate, paidAt: now } : {}) };
}
export function seedMonthlyCharges(members: readonly { id: string; name: string; hasInvoice: boolean; paid: boolean }[]): MonthlyCharge[] {
 return members.filter(m => m.hasInvoice).map((m, i) => ({ id: `monthly-${m.id}`, memberId: m.id, memberName: m.name, description: 'Mensalidade de outubro', reference: '2026-10', dueDate: '2026-10-10', baseCents: 20000, extraCents: 0, totalCents: 20000, interestMode: 'none', interestValue: '', status: m.paid ? 'paid' : 'pending', createdAt: Date.parse('2026-10-01T12:00:00Z'), source: 'seed', ...(m.paid ? { receivedDate: `2026-10-${['03', '09', '13', '17', '22', '26'][i % 6]}`, paidAt: Date.parse('2026-10-26T12:00:00Z') } : {}) }));
}
export function receiveMonthlyCharge(charges: readonly MonthlyCharge[], id: string, date: string, at = Date.now()): MonthlyCharge[] {
 if (!validFinancialDate(date) || date > financialToday()) throw new Error('Informe uma data de recebimento válida, até hoje.');
 return charges.map(c => c.id === id && c.status === 'pending' ? { ...c, status: 'paid', receivedDate: date, paidAt: at } : c);
}
export const monthlyLabel = (reference: string) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${reference}-01T12:00:00Z`));
export const shortFinancialDate = (date: string) => validFinancialDate(date) ? date.split('-').reverse().join('/') : 'Não informada';
