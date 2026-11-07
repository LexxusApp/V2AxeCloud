import type { MonthlyCharge } from './billing';
import type { DemoMember } from './MembersPage';
import { cantinaDay, type CantinaReceipt } from './cantina';

// Integer cents, synthetic records, and no production dependencies.
export type CashEntry = {
  id: string; description: string; date: string; category: string;
  kind: 'income' | 'expense'; cents: number; memberId?: string; createdAt: number;
};
export type LedgerEntry = CashEntry & { source: 'manual' | 'monthly' | 'cantina' | 'example' | 'store'; memberName?: string };
export const financialMoney = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function buildLocalLedger(members: DemoMember[], paid: string[], cantinaReceived: number | readonly CantinaReceipt[], manual: CashEntry[], charges?: readonly MonthlyCharge[]): LedgerEntry[] {
  const seedDays = ['03', '09', '13', '17', '22', '26'];
  let dayIndex = 0;
  const monthly: LedgerEntry[] = charges ? charges.filter(charge => charge.status === 'paid').map(charge => ({ id: `receipt-${charge.id}`, description: charge.description, category: 'Mensalidades', kind: 'income' as const, cents: charge.totalCents, date: charge.receivedDate!, createdAt: charge.paidAt || charge.createdAt, memberId: charge.memberId, memberName: members.find(member => member.id === charge.memberId)?.name || charge.memberName, source: 'monthly' as const })) : members.filter(m => m.hasInvoice && (m.paid || paid.includes(m.name))).map(m => ({
    id: `monthly-${m.id}`, description: 'Mensalidade de outubro', category: 'Mensalidades', kind: 'income', cents: 20000,
    date: `2026-10-${m.paid ? seedDays[dayIndex++ % seedDays.length] : '29'}`, createdAt: 0, memberId: m.id, memberName: m.name, source: 'monthly',
  }));
  const expenses: LedgerEntry[] = [
    { id: 'example-materials', description: 'Materiais para a casa', category: 'Insumos', kind: 'expense', cents: 28000, date: '2026-10-12', createdAt: 0, source: 'example' },
    { id: 'example-energy', description: 'Conta de energia', category: 'Contas', kind: 'expense', cents: 12000, date: '2026-10-24', createdAt: 0, source: 'example' },
  ];
  const cantina: LedgerEntry[] = typeof cantinaReceived === 'number' ? cantinaReceived > 0 ? [{ id: 'cantina-received', description: 'Recebimentos da cantina', category: 'Cantina', kind: 'income', cents: Math.round(cantinaReceived * 100), date: '2026-10-29', createdAt: 1, source: 'cantina' }] : [] : cantinaReceived.map(receipt => ({ id: `cantina-${receipt.id}`, description: `Cantina · ${receipt.code} · ${receipt.origin === 'book' ? 'Acerto da caderneta' : 'Recebimento no balcão'}`, category: 'Cantina', kind: 'income', cents: receipt.cents, date: cantinaDay(receipt.receivedAt), createdAt: receipt.receivedAt, source: 'cantina', memberId: receipt.memberId || undefined, memberName: receipt.memberName }));
  return [...monthly, ...expenses, ...cantina, ...manual.map(e => ({ ...e, source: 'manual' as const, memberName: members.find(m => m.id === e.memberId)?.name }))]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}
export function ledgerTotals(entries: LedgerEntry[], month = '2026-10') {
  const monthEntries = entries.filter(e => e.date.startsWith(month));
  return { balance: entries.reduce((v, e) => v + (e.kind === 'income' ? e.cents : -e.cents), 0), income: monthEntries.filter(e => e.kind === 'income').reduce((v, e) => v + e.cents, 0), expense: monthEntries.filter(e => e.kind === 'expense').reduce((v, e) => v + e.cents, 0) };
}
/** Opens the current month when it has cash activity; otherwise shows the latest populated month. */
export function preferredLedgerPeriod(entries: readonly LedgerEntry[], currentMonth: string) {
  const periods = [...new Set(entries.map(entry => entry.date.slice(0, 7)).filter(period => /^\d{4}-\d{2}$/.test(period)))].sort();
  if (periods.includes(currentMonth)) return currentMonth;
  return periods.filter(period => period <= currentMonth).at(-1) || currentMonth;
}
export function parseFinancialAmount(value: string): number | null {
  const cleaned = value.trim();
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned.replaceAll('.', '').replace(',', '.')) * 100);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 9999999999 ? cents : null;
}
